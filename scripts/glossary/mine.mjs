#!/usr/bin/env node
import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

import { createGlossaryProvider } from '../translation/api/index.mjs';
import { commitAndOpenPullRequest } from '../translation/ci/github.mjs';
import { buildPullRequestPlan } from '../translation/ci/open-pull-request.mjs';
import { TranslationError } from '../translation/translate-docs.mjs';
import { readGlossary } from '../translation/validate-translations.mjs';
import { classifyCandidates, summarizeVerdicts } from './classify.mjs';
import { extractCandidates } from './extract.mjs';

const ROOT = path.resolve(import.meta.dirname, '..', '..');
const SOURCE_ROOT = 'assets/ru';
const TARGET_ROOT = 'assets/en';
const DO_NOT_TRANSLATE_PATH = '.github/prompts/do-not-translate.md';
const DO_NOT_TRANSLATE_FILE = path.join(ROOT, DO_NOT_TRANSLATE_PATH);
const TERM_LINE_RE = /^`[^`]+`$/;

/**
 * Merges freshly mined terms into the existing machine word list: a
 * duplicate-free union, resorted in full. Sorting the whole list rather than
 * appending is deliberate — the diff stays readable, and nobody has to guess
 * where a term landed.
 *
 * @param {string[]} existing
 * @param {string[]} added
 * @returns {string[]}
 */
export function mergeDoNotTranslate(existing, added) {
  return [...new Set([...existing, ...added])].sort((a, b) => a.localeCompare(b));
}

/**
 * Builds the pull request body for a glossary mining run: how many terms
 * were added, what the run cost, which spellings disagree with themselves
 * and need a human decision, and what was found and dropped as noise.
 *
 * @param {{
 *   added: string[],
 *   disagreements: Array<{spellings: string[], evidence: Array<{file: string, line: number, sentence: string}>}>,
 *   dropped: Array<{term: string, why: string}>,
 *   summary: string,
 * }} input
 * @returns {string}
 */
export function buildGlossaryPullRequestBody({ added, disagreements, dropped, summary }) {
  const sections = [
    added.length
      ? `Added ${added.length} new term(s) to \`${DO_NOT_TRANSLATE_PATH}\`: ${added.map(term => `\`${term}\``).join(', ')}.`
      : `No new terms were added to \`${DO_NOT_TRANSLATE_PATH}\` this run.`,
  ];

  if (summary) sections.push(summary);

  if (disagreements.length) {
    sections.push([
      '## Needs a decision',
      '',
      'The same term is written more than one way in the documentation. Both spellings are now protected; pick the right one and remove the other by hand:',
      '',
      ...disagreements.flatMap(({ spellings, evidence }) => [
        `- ${spellings.join(' vs. ')}`,
        ...evidence.map(entry => `  - \`${entry.file}:${entry.line}\`: ${entry.sentence}`),
      ]),
    ].join('\n'));
  }

  if (dropped.length) {
    sections.push([
      '## Dropped',
      '',
      'These looked like candidates but were judged not to be terms:',
      '',
      ...dropped.map(({ term, why }) => `- \`${term}\` — ${why}`),
    ].join('\n'));
  }

  return sections.join('\n\n');
}

function corpusDocuments() {
  const sourceDir = path.join(ROOT, SOURCE_ROOT);
  return readdirSync(sourceDir)
    .filter(name => /\.mdx?$/i.test(name))
    .map(name => {
      const enFile = path.join(ROOT, TARGET_ROOT, name);
      if (!existsSync(enFile)) return null;
      return {
        path: name,
        ru: readFileSync(path.join(sourceDir, name), 'utf8'),
        en: readFileSync(enFile, 'utf8'),
      };
    })
    .filter(Boolean);
}

/**
 * Every spelling a verdict's candidate carries — both case variants of a
 * disputed term must be protected, not just the canonical one, so the
 * unification of their wording stays a human decision rather than one this
 * run makes silently by keeping only one form.
 */
function spellingsFor(verdict) {
  return verdict.candidate.spellings?.length ? verdict.candidate.spellings : [verdict.candidate.term];
}

function readDoNotTranslateFile() {
  return existsSync(DO_NOT_TRANSLATE_FILE) ? readFileSync(DO_NOT_TRANSLATE_FILE, 'utf8') : '';
}

/**
 * Splits the machine word list into its hand-written header and rewrites it
 * with a new, fully sorted body — never appended to blindly.
 * @param {string} content
 * @param {string[]} terms already merged and sorted
 * @returns {string}
 */
function renderDoNotTranslateFile(content, terms) {
  const lines = content.split('\n');
  const firstTermIndex = lines.findIndex(line => TERM_LINE_RE.test(line));
  const header = (firstTermIndex === -1 ? lines : lines.slice(0, firstTermIndex)).join('\n').replace(/\n+$/, '');
  const body = terms.map(term => `\`${term}\``).join('\n');
  return `${header}\n\n${body}\n`;
}

function buildSummary(report) {
  return `Produced by \`${report.model}\`: ${report.summary}.`;
}

async function run({ dryRun }) {
  const docs = corpusDocuments();
  const known = readGlossary().verbatim;

  const candidates = extractCandidates({ docs, known });
  if (!candidates.length) {
    console.log('No new candidate terms found.');
    return;
  }

  const provider = createGlossaryProvider();
  const verdicts = await classifyCandidates({ candidates, provider });
  const { glossary, dropped, disagreements } = summarizeVerdicts(verdicts);

  const verdictByTerm = new Map(verdicts.map(verdict => [verdict.candidate.term, verdict]));
  const added = [...new Set(glossary.flatMap(term => spellingsFor(verdictByTerm.get(term))))].sort((a, b) => a.localeCompare(b));

  const existingContent = readDoNotTranslateFile();
  const merged = mergeDoNotTranslate(known, added);

  const body = buildGlossaryPullRequestBody({
    added,
    disagreements: disagreements.map(({ spellings, verdicts: group }) => ({
      spellings,
      evidence: group.flatMap(verdict => verdict.candidate.evidence),
    })),
    dropped: dropped.map(({ term, why }) => ({ term, why })),
    summary: buildSummary(provider.usageReport()),
  });

  if (dryRun) {
    console.log(body);
    return;
  }

  if (!added.length) {
    console.log('No new terms to add to the machine glossary.');
    return;
  }

  writeFileSync(DO_NOT_TRANSLATE_FILE, renderDoNotTranslateFile(existingContent, merged), 'utf8');

  const plan = buildPullRequestPlan({
    paths: [DO_NOT_TRANSLATE_PATH],
    title: 'docs: extend the machine glossary',
    body,
  });

  if (!commitAndOpenPullRequest(plan, process.env.BASE_BRANCH)) {
    console.log('No glossary changes to propose.');
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    await run({ dryRun: process.argv.includes('--dry-run') });
  } catch (error) {
    if (!(error instanceof TranslationError)) throw error;
    console.error(`glossary mining: ${error.message}`);
    process.exit(1);
  }
}
