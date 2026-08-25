import { TranslationError } from '../translation/translate-docs.mjs';

const KINDS = ['identifier', 'ui-label', 'product-name', 'noise', 'should-be-translated'];
const GLOSSARY_KINDS = new Set(['identifier', 'ui-label', 'product-name']);

// Small enough that a batch's request stays short even for a candidate with
// three evidence sentences each; large enough that a corpus-sized candidate
// list does not turn into hundreds of round trips.
const BATCH_SIZE = 20;

const INSTRUCTIONS = [
  'You are classifying candidate terms found inside Russian technical documentation.',
  'Each candidate is Latin text that already appears, verbatim, in the matching English document.',
  '',
  'For every candidate, answer exactly one closed question with exactly one of these five verdicts:',
  '- identifier: a parameter, field, or code-level name that must stay as written',
  '- ui-label: text copied from the product interface (a button, a menu, a column header)',
  '- product-name: the name of a product, company, or service',
  '- noise: a fragment of ordinary English prose left over from tokenisation, not a term on its own',
  '- should-be-translated: ordinary English prose that should have been translated into Russian',
  '',
  'Judge each candidate from its frequency and its example sentences — do not guess from the term alone.',
  'Reply with a verdict for every single candidate in the batch. Do not skip any and do not invent new ones.',
].join('\n');

const RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    verdicts: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          term: { type: 'string' },
          kind: { type: 'string', enum: KINDS },
          why: { type: 'string' },
        },
        required: ['term', 'kind', 'why'],
      },
    },
  },
  required: ['verdicts'],
};

/**
 * @typedef {object} Verdict
 * @property {import('./extract.mjs').Candidate} candidate
 * @property {'identifier'|'ui-label'|'product-name'|'noise'|'should-be-translated'} kind
 * @property {string} why   one short sentence, shown in the pull request body
 */

function candidateForPayload(candidate) {
  return {
    term: candidate.term,
    count: candidate.count,
    examples: candidate.evidence.map(entry => entry.sentence),
  };
}

/**
 * Turns one batch's model reply into a Verdict per candidate, in the order
 * the batch was given. The model's own order is not trusted — replies are
 * matched back onto candidates by term.
 *
 * A reply that leaves any candidate out is an error, not a gap to fill in:
 * silence from the model is not a verdict, and treating an unanswered
 * candidate as noise would drop it without anyone ever seeing it.
 *
 * @param {import('./extract.mjs').Candidate[]} batch
 * @param {{verdicts: Array<{term: string, kind: string, why: string}>}} reply
 * @returns {Verdict[]}
 */
function parseBatchReply(batch, reply) {
  const byTerm = new Map((reply.verdicts ?? []).map(verdict => [verdict.term, verdict]));
  const missing = batch.filter(candidate => !byTerm.has(candidate.term)).map(candidate => candidate.term);
  if (missing.length) {
    throw new TranslationError(`glossary classification reply is missing a verdict for: ${missing.join(', ')}`);
  }

  return batch.map(candidate => {
    const verdict = byTerm.get(candidate.term);
    return { candidate, kind: verdict.kind, why: verdict.why };
  });
}

async function classifyBatch(batch, provider) {
  const payload = { candidates: batch.map(candidateForPayload) };
  const reply = await provider.translate({ instructions: INSTRUCTIONS, payload, schema: RESPONSE_SCHEMA });
  return parseBatchReply(batch, reply);
}

/**
 * @param {{candidates: import('./extract.mjs').Candidate[], provider: import('../translation/api/provider.mjs').TranslationProvider}} input
 * @returns {Promise<Verdict[]>} one per candidate, in the order given
 */
export async function classifyCandidates({ candidates, provider }) {
  const verdicts = [];
  for (let start = 0; start < candidates.length; start += BATCH_SIZE) {
    const batch = candidates.slice(start, start + BATCH_SIZE);
    verdicts.push(...(await classifyBatch(batch, provider)));
  }
  return verdicts;
}

/**
 * Groups verdicts whose candidate terms differ only by case into one
 * disagreement entry. A candidate that already carries multiple spellings of
 * its own (merged by the extractor) counts too — its own `spellings` field
 * is folded in alongside any other candidate sharing the same lowercase key.
 *
 * @param {Verdict[]} verdicts
 * @returns {Array<{spellings: string[], verdicts: Verdict[]}>}
 */
function groupDisagreements(verdicts) {
  const byKey = new Map();

  for (const verdict of verdicts) {
    const spellings = verdict.candidate.spellings?.length ? verdict.candidate.spellings : [verdict.candidate.term];
    const key = verdict.candidate.term.toLowerCase();
    if (!byKey.has(key)) byKey.set(key, { spellings: new Set(), verdicts: [] });
    const entry = byKey.get(key);
    for (const spelling of spellings) entry.spellings.add(spelling);
    entry.verdicts.push(verdict);
  }

  return [...byKey.values()]
    .filter(entry => entry.spellings.size > 1)
    .map(entry => ({ spellings: [...entry.spellings].sort((a, b) => a.localeCompare(b)), verdicts: entry.verdicts }));
}

/**
 * Sorts a batch's verdicts into what the glossary keeps, what it drops, and
 * what should have been translated in the first place, and separately flags
 * terms that disagree with themselves only in case.
 *
 * @param {Verdict[]} verdicts
 * @returns {{
 *   glossary: string[],
 *   dropped: Array<{term: string, why: string, candidate: import('./extract.mjs').Candidate}>,
 *   shouldBeTranslated: string[],
 *   disagreements: Array<{spellings: string[], verdicts: Verdict[]}>,
 * }}
 */
export function summarizeVerdicts(verdicts) {
  const glossary = [];
  const dropped = [];
  const shouldBeTranslated = [];

  for (const verdict of verdicts) {
    const { candidate, kind, why } = verdict;
    if (GLOSSARY_KINDS.has(kind)) {
      glossary.push(candidate.term);
    } else if (kind === 'noise') {
      dropped.push({ term: candidate.term, why, candidate });
    } else if (kind === 'should-be-translated') {
      shouldBeTranslated.push(candidate.term);
    }
  }

  return { glossary, dropped, shouldBeTranslated, disagreements: groupDisagreements(verdicts) };
}
