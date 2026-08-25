#!/usr/bin/env node

import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

import { createTranslationProvider } from './api/index.mjs';
import { splitUnit } from './scope/chunks.mjs';
import { maskFences, restoreFences } from './scope/fences.mjs';
import { parseSections } from './scope/sections.mjs';
import { spliceUnits } from './scope/splice.mjs';
import { resolveUnits } from './scope/unit.mjs';

const ROOT = path.resolve(import.meta.dirname, '..', '..');
const SOURCE_ROOT = 'assets/ru';
const TARGET_ROOT = 'assets/en';
const PROMPT_FILE = path.join(ROOT, '.github', 'prompts', 'translate-docs.md');
const TERMINOLOGY_FILE = path.join(ROOT, '.github', 'prompts', 'terminology.md');
const DO_NOT_TRANSLATE_FILE = path.join(ROOT, '.github', 'prompts', 'do-not-translate.md');
export const TRANSLATION_INSTRUCTIONS = [PROMPT_FILE, TERMINOLOGY_FILE, DO_NOT_TRANSLATE_FILE]
  .map(file => readFileSync(file, 'utf8').trim())
  .join('\n\n');

/** Raised for a problem the user should read as a message, not a stack trace. */
export class TranslationError extends Error {}

function fail(message) {
  throw new TranslationError(message);
}

function git(args, options = {}) {
  return execFileSync('git', args, {
    cwd: ROOT,
    encoding: options.encoding ?? 'utf8',
    maxBuffer: 50 * 1024 * 1024,
  });
}

export function targetPath(sourcePath) {
  return sourcePath.replace(/^assets\/ru(?=\/)/, TARGET_ROOT);
}

export function isDocument(file) {
  return file.startsWith(`${SOURCE_ROOT}/`) && /\.mdx?$/i.test(file);
}

function allDocuments() {
  return git(['ls-files', '-z', SOURCE_ROOT]).split('\0').filter(file => file && isDocument(file));
}

function normalizeDocumentPath(input) {
  const relative = path.relative(ROOT, path.resolve(input)).split(path.sep).join('/');
  if (!isDocument(relative)) fail(`${input} is not a Markdown document under ${SOURCE_ROOT}`);
  if (!existsSync(path.join(ROOT, relative))) fail(`${input} does not exist`);
  return relative;
}

function parseArgs() {
  const args = process.argv.slice(2);
  if (args.includes('--help')) {
    console.log([
      'Translate Russian documentation into English.',
      '',
      'Modes:',
      '  --base <git-ref> [--head <git-ref>]  translate what changed between two refs',
      '  --files <path>...                    translate the named documents again, in full',
      '  --all                                translate every document that has none yet',
      '',
      'Options:',
      '  --force    with --all, translate documents that already have a translation',
      '  --dry-run  report the planned work without calling the model',
    ].join('\n'));
    process.exit(0);
  }

  const flag = name => args.includes(name);
  const value = (name, fallback) => {
    const index = args.indexOf(name);
    return index === -1 ? fallback : args[index + 1];
  };
  const list = name => {
    const index = args.indexOf(name);
    if (index === -1) return [];
    const collected = [];
    for (let i = index + 1; i < args.length && !args[i].startsWith('--'); i++) collected.push(args[i]);
    return collected;
  };

  const options = { force: flag('--force'), dryRun: flag('--dry-run') };
  const files = list('--files');

  if (flag('--all')) return { ...options, mode: 'paths', paths: allDocuments(), named: false };
  if (files.length) return { ...options, mode: 'paths', paths: files.map(normalizeDocumentPath), named: true };
  if (flag('--files')) fail('--files needs at least one path');

  const base = value('--base');
  if (!base) fail('pass one of --base <git-ref>, --files <path>..., or --all');
  return { ...options, mode: 'range', base, head: value('--head', 'HEAD') };
}

function changedDocuments(base, head) {
  const raw = git(['diff', '--name-status', '-z', '--find-renames', base, head], { encoding: 'buffer' });
  const fields = raw.toString('utf8').split('\0').filter(Boolean);
  const changes = [];

  for (let i = 0; i < fields.length;) {
    const status = fields[i++];
    if (status.startsWith('R') || status.startsWith('C')) {
      const oldPath = fields[i++];
      const newPath = fields[i++];
      if (isDocument(oldPath) || isDocument(newPath)) changes.push({ status: status[0], oldPath, newPath });
    } else {
      const file = fields[i++];
      if (isDocument(file)) changes.push({ status: status[0], oldPath: file, newPath: file });
    }
  }

  return changes;
}

let provider;

/**
 * Builds (once) and returns the singleton provider, so every call in one run
 * shares the same usage counter that {@link reportUsage} reads at the end.
 *
 * Never called from a `--dry-run` path: that is what lets a dry run succeed
 * with no `TRANSLATION_API_KEY` set at all.
 *
 * @returns {import('./api/base.mjs').TranslationProvider}
 */
function getProvider() {
  provider ??= createTranslationProvider();
  return provider;
}

const TRANSLATION_SCHEMA = {
  type: 'object',
  properties: {
    translation: {type: 'string'},
  },
  required: ['translation'],
  additionalProperties: false,
};

function assertReplyShape(reply) {
  if (!reply || typeof reply !== 'object' || Array.isArray(reply)) fail('the model did not return an object');
  if (typeof reply.translation !== 'string') fail('the model returned no translation string');
  return reply;
}

async function callProvider(providerInstance, payload) {
  try {
    return assertReplyShape(await providerInstance.translate({
      instructions: TRANSLATION_INSTRUCTIONS,
      payload,
      schema: TRANSLATION_SCHEMA,
    }));
  } catch (error) {
    fail(error.message ?? String(error));
  }
}

function ensureFinalNewline(content) {
  return `${content.replace(/\n*$/, '')}\n`;
}

// Only spans that are genuinely identical in both languages belong here.
// Link destinations, fenced blocks and HTML attributes were tried and dropped:
// the corpus localises PDF and video targets and translates code comments, so
// guarding them would fail on correct translations.
const PROTECTED_SPANS = [
  // An all-Cyrillic span is prose in code formatting, such as an exchange
  // error message, and the English document carries the English wording.
  { label: 'inline code', pattern: /`[^`\n]+`/g, translatable: span => /[\u0400-\u04FF]/.test(span) },
  { label: 'component tag', pattern: /<[A-Z][A-Za-z0-9]*\b[^>]*>/g },
];


/**
 * Fails when something the prompt promises to preserve did not survive.
 *
 * The prompt lists these categories as verbatim, but a prompt is a request.
 * Checking them here turns a quiet corruption into a failed run.
 *
 * @param {string} sourceText Russian text the translation had to cover.
 * @param {string} translation English text produced for it.
 * @param {string} file Path used in the error message.
 */
export function assertProtectedSpansPreserved(sourceText, translation, file) {
  const missing = [];

  for (const { label, pattern, translatable } of PROTECTED_SPANS) {
    const spans = new Set([...sourceText.matchAll(pattern)].map(match => match[0]));
    for (const span of spans) {
      if (translatable?.(span)) continue;
      if (!translation.includes(span)) missing.push(`${label} ${JSON.stringify(span)}`);
    }
  }

  if (missing.length) {
    fail(`${file}: protected content was changed or removed:\n  ${missing.join('\n  ')}`);
  }
}


const FENCE_PLACEHOLDER_RE = /\[\[FENCE_(\d+)\]\]/g;

/**
 * Masks the fenced blocks of a unit's Russian text and, when it exists, its
 * current English text — the same block never has to make two separate
 * round trips through the model just because it appears on both sides.
 *
 * Each text is masked on its own, so their placeholder numbers both start at
 * 1 and would collide if sent as they are. The English side's placeholders
 * are shifted past the Russian side's before the two block lists are
 * concatenated into one, so every number in the combined request maps to
 * exactly one block — mixing the two lists up here would splice the wrong
 * side's code back into the reply.
 *
 * @param {string} russianText
 * @param {string|null} englishText
 * @returns {{maskedRussianText: string, maskedEnglishText: string|null, blocks: string[]}}
 */
function maskUnitFences(russianText, englishText) {
  const ru = maskFences(russianText);
  if (englishText === null) {
    return { maskedRussianText: ru.masked, maskedEnglishText: null, blocks: ru.blocks };
  }

  const en = maskFences(englishText);
  const offset = ru.blocks.length;
  const maskedEnglishText = en.masked.replace(FENCE_PLACEHOLDER_RE, (_placeholder, number) => `[[FENCE_${Number(number) + offset}]]`);
  return { maskedRussianText: ru.masked, maskedEnglishText, blocks: [...ru.blocks, ...en.blocks] };
}

/**
 * Restores a reply's fenced blocks, naming the file when a placeholder came
 * back missing, duplicated, or unknown — `restoreFences` itself only knows
 * the placeholder number, not which document it belongs to.
 *
 * @param {string} masked
 * @param {string[]} blocks
 * @param {string} file
 * @returns {string}
 */
function restoreUnitFences(masked, blocks, file) {
  try {
    return restoreFences(masked, blocks);
  } catch (error) {
    fail(`${file}: ${error.message}`);
  }
}

/** Leading run of blank-line newlines at the start of a chunk from `splitUnit`, split off so it can be re-attached to a chunk's translation without asking the model to reproduce it. */
const LEADING_BLANK_LINES_RE = /^\n*/;

/**
 * Sends one request for the whole (already masked) unit and returns its
 * translation, still masked.
 *
 * @param {{
 *   providerInstance: import('./api/base.mjs').TranslationProvider,
 *   headingPath: string,
 *   maskedRussianText: string,
 *   maskedEnglishText: string|null,
 *   diff: string,
 *   hasExistingEnglish: boolean,
 *   retryNote: string|undefined,
 * }} input
 * @returns {Promise<string>}
 */
async function translateInOnePass({ providerInstance, headingPath, maskedRussianText, maskedEnglishText, diff, hasExistingEnglish, retryNote }) {
  const payload = {
    task: hasExistingEnglish
      ? [
          'An English version of this unit already exists (current_english_unit).',
          'Update it so it reflects only the Russian changes shown in unified_diff.',
          'Keep every part of current_english_unit that the diff did not touch exactly as it is:',
          'it is human-reviewed prose, and rewriting wording that did not change is a regression.',
          'Return the complete, updated unit in the translation field.',
        ].join(' ')
      : 'Translate this Russian unit into English, in full. Return it in the translation field.',
    heading_path: headingPath,
    russian_unit: maskedRussianText,
    current_english_unit: maskedEnglishText,
    unified_diff: diff,
  };

  const requestPayload = retryNote ? { ...payload, retry_note: retryNote } : payload;
  const reply = await callProvider(providerInstance, requestPayload);
  return reply.translation;
}

/**
 * Translates a unit too long for one reply by splitting it into ordered
 * pieces and translating each with its own request, then joining the results
 * back in order.
 *
 * Every request carries the whole (masked) unit as `russian_unit`, for
 * context — the model must never translate a piece without seeing what it is
 * part of — plus `piece_to_translate`, the one piece it should actually
 * translate and return. A piece's own leading blank lines (the separator
 * `splitUnit` packed it with) are stripped before the request and put back
 * around the reply afterward, rather than asked of the model: the model
 * only ever sees and returns the piece's real content, so nothing about
 * reassembly depends on it reproducing whitespace it was not asked to change.
 *
 * @param {{
 *   providerInstance: import('./api/base.mjs').TranslationProvider,
 *   headingPath: string,
 *   maskedRussianText: string,
 *   maskedEnglishText: string|null,
 *   diff: string,
 *   hasExistingEnglish: boolean,
 *   budget: number,
 *   retryNote: string|undefined,
 * }} input
 * @returns {Promise<string>} the joined translation, in the pieces' original order
 */
async function translateInPasses({ providerInstance, headingPath, maskedRussianText, maskedEnglishText, diff, hasExistingEnglish, budget, retryNote }) {
  const pieces = splitUnit(maskedRussianText, budget);
  const translatedPieces = [];

  for (const piece of pieces) {
    const separator = piece.match(LEADING_BLANK_LINES_RE)[0];
    const payload = {
      task: [
        'This unit is too long for one reply, so it is being translated in ordered pieces.',
        'russian_unit is the whole unit, included only as context for piece_to_translate.',
        hasExistingEnglish
          ? 'current_english_unit is the existing English version of the whole unit; keep its established wording wherever unified_diff did not touch it.'
          : '',
        'Translate only the text in piece_to_translate, into English, and return exactly that translation and nothing else, in the translation field.',
      ]
        .filter(Boolean)
        .join(' '),
      heading_path: headingPath,
      russian_unit: maskedRussianText,
      current_english_unit: maskedEnglishText,
      unified_diff: diff,
      piece_to_translate: piece.slice(separator.length),
    };

    const requestPayload = retryNote ? { ...payload, retry_note: retryNote } : payload;
    const reply = await callProvider(providerInstance, requestPayload);
    translatedPieces.push(separator + reply.translation);
  }

  return translatedPieces.join('');
}

/**
 * Translates one unit, retrying exactly once when the reply fails validation.
 *
 * The retry sends the same request again, plus one line describing what was
 * wrong with the first reply. There is no loop: a second failure is final,
 * and its message names what was wrong with *both* attempts, not just the
 * last one — the caller has nothing else to put in a failure report.
 *
 * @param {{
 *   headingPath: string,        headings from the document root down to the unit, for context
 *   russianText: string,        the Russian unit, in full
 *   englishText: string|null,   the current English unit, in full; null when there is none
 *   diff: string,               unified diff limited to this unit's lines
 *   file: string,               destination path, used in the error message
 *   provider: import('./api/base.mjs').TranslationProvider,
 * }} input
 * @returns {Promise<string>} the accepted English translation for the unit
 * @throws {TranslationError} naming what was wrong with attempt 1 and attempt 2,
 *   when the retry also fails
 */
export async function translateUnit({ headingPath, russianText, englishText, diff, file, provider: providerInstance }) {
  const hasExistingEnglish = englishText !== null;
  const { maskedRussianText, maskedEnglishText, blocks: fenceBlocks } = maskUnitFences(russianText, englishText);
  const budget = providerInstance.outputBudget();

  const attempt = async retryNote => {
    const maskedTranslation =
      maskedRussianText.length > budget
        ? await translateInPasses({ providerInstance, headingPath, maskedRussianText, maskedEnglishText, diff, hasExistingEnglish, budget, retryNote })
        : await translateInOnePass({ providerInstance, headingPath, maskedRussianText, maskedEnglishText, diff, hasExistingEnglish, retryNote });
    const translation = restoreUnitFences(maskedTranslation, fenceBlocks, file);
    assertProtectedSpansPreserved(russianText, translation, file);
    return translation;
  };

  try {
    return await attempt();
  } catch (firstError) {
    try {
      return await attempt(`The previous reply was rejected: ${firstError.message}`);
    } catch (secondError) {
      fail(
        `${file}: translation of "${headingPath}" was rejected twice.\n` +
          `  Attempt 1: ${firstError.message}\n` +
          `  Attempt 2: ${secondError.message}`,
      );
    }
  }
}

/**
 * Translates every unit of one document and splices the accepted results
 * into it. A unit that still fails after translateUnit's one retry fails the
 * whole document: no unit is spliced, and {ok: false} is returned instead —
 * the document is reported as failed, not partially written.
 *
 * @param {{
 *   destination: string,   target path, used in the failure reason
 *   lines: string[],       current English document lines ([] when there is none yet)
 *   units: Array<{
 *     unit: import('./scope/unit.mjs').Unit,
 *     headingPath: string,
 *     russianText: string,
 *     englishText: string|null,
 *     diff: string,
 *   }>,
 *   provider: import('./api/base.mjs').TranslationProvider,
 * }} input
 * @returns {Promise<{ok: true, lines: string[]} | {ok: false, reason: string}>}
 */
export async function translateDocument({ destination, lines, units, provider: providerInstance }) {
  const results = [];

  for (const item of units) {
    try {
      const translation = await translateUnit({
        headingPath: item.headingPath,
        russianText: item.russianText,
        englishText: item.englishText,
        diff: item.diff,
        file: destination,
        provider: providerInstance,
      });
      results.push({ unit: item.unit, translation });
    } catch (error) {
      return { ok: false, reason: error.message ?? String(error) };
    }
  }

  return { ok: true, lines: spliceUnits(lines, results) };
}

/**
 * The heading text from the document root down to `section`, joined for
 * display. `parseSections` keeps no parent pointers, so the trail has to be
 * found by walking down from the root instead.
 *
 * @param {import('./scope/sections.mjs').Document} doc
 * @param {import('./scope/sections.mjs').Section|null} section null for a file-wide unit
 * @returns {string}
 */
function headingPathFor(doc, section) {
  if (!section) return '(whole document)';

  const search = (sections, trail) => {
    for (const candidate of sections) {
      const nextTrail = [...trail, candidate.text];
      if (candidate === section) return nextTrail;
      const found = search(candidate.children, nextTrail);
      if (found) return found;
    }
    return null;
  };

  return (search(doc.children, []) ?? [section.text]).join(' > ');
}

/**
 * The 0-based line indexes that changed between `base` and `head`, in the
 * current (`head`) version of the file — the same indexing `parseSections`
 * uses for a `Section`'s `start`/`end`, so `resolveUnits` can consume them
 * directly.
 *
 * A hunk that only deletes lines (`+start,0`) leaves no new line to point at;
 * it is anchored on the line right before the gap instead, since that is
 * still part of the surrounding section the deletion happened in.
 *
 * @param {string} base
 * @param {string} head
 * @param {string[]} diffPaths
 * @returns {number[]} sorted, de-duplicated
 */
function changedLineNumbers(base, head, diffPaths) {
  const raw = git(['diff', '--unified=0', base, head, '--', ...diffPaths]);
  const lines = new Set();

  for (const match of raw.matchAll(/^@@ -\d+(?:,\d+)? \+(\d+)(?:,(\d+))? @@/gm)) {
    const newStart = Number(match[1]);
    const newCount = match[2] === undefined ? 1 : Number(match[2]);
    if (newCount === 0) {
      lines.add(Math.max(newStart - 1, 0));
      continue;
    }
    for (let i = 0; i < newCount; i++) lines.add(newStart - 1 + i);
  }

  return [...lines].sort((a, b) => a - b);
}

/**
 * A unified diff between `base` and `head`, clipped to the hunks that touch
 * `unit.ru`'s line range — so the model sees only what changed in the unit
 * it was asked to translate, not the rest of a possibly much larger document.
 *
 * @param {string} base
 * @param {string} head
 * @param {string[]} diffPaths
 * @param {import('./scope/unit.mjs').Unit} unit kind 'section'; a 'file' unit has no diff to clip to
 * @returns {string}
 */
function unitDiff(base, head, diffPaths, unit) {
  const raw = git(['diff', '--unified=8', base, head, '--', ...diffPaths]);
  const rangeStart = unit.ru.start + 1; // 1-based, inclusive
  const rangeEnd = unit.ru.end; // 0-based exclusive end == 1-based inclusive end
  return clipDiffToRange(raw, rangeStart, rangeEnd);
}

/** Keeps only the hunks of a unified diff whose new-file range overlaps [rangeStart, rangeEnd] (1-based, inclusive). */
function clipDiffToRange(diffText, rangeStart, rangeEnd) {
  const lines = diffText.split('\n');
  const header = [];
  const hunks = [];
  let current = null;

  for (const line of lines) {
    const hunkMatch = line.match(/^@@ -\d+(?:,\d+)? \+(\d+)(?:,(\d+))? @@/);
    if (hunkMatch) {
      if (current) hunks.push(current);
      const newStart = Number(hunkMatch[1]);
      const newCount = hunkMatch[2] === undefined ? 1 : Number(hunkMatch[2]);
      current = { header: line, body: [], newStart, newEnd: newStart + Math.max(newCount, 1) - 1 };
      continue;
    }
    if (current) current.body.push(line);
    else header.push(line);
  }
  if (current) hunks.push(current);

  const overlapping = hunks.filter(hunk => hunk.newStart <= rangeEnd && hunk.newEnd >= rangeStart);
  if (!overlapping.length) return header.join('\n');

  return [header.join('\n'), ...overlapping.map(hunk => [hunk.header, ...hunk.body].join('\n'))].join('\n');
}

/**
 * Builds one `{unit, headingPath, russianText, englishText, diff}` entry per
 * unit `resolveUnits` returned, ready for {@link translateDocument}.
 *
 * @param {{ru: import('./scope/sections.mjs').Document, en: import('./scope/sections.mjs').Document|null,
 *   changedLines: number[], diffFor: (unit: import('./scope/unit.mjs').Unit) => string}} input
 * @returns {Array<{unit: import('./scope/unit.mjs').Unit, headingPath: string, russianText: string, englishText: string|null, diff: string}>}
 */
function buildUnitInputs({ ru, en, changedLines, diffFor }) {
  const units = resolveUnits({ ru, en, changedLines });

  return units.map(unit => ({
    unit,
    headingPath: headingPathFor(ru, unit.ru),
    russianText: unit.kind === 'file' ? ru.lines.join('\n') : ru.lines.slice(unit.ru.start, unit.ru.end).join('\n'),
    englishText: unit.en ? en.lines.slice(unit.en.start, unit.en.end).join('\n') : null,
    diff: unit.kind === 'file' ? '' : diffFor(unit),
  }));
}

function describeUnitForDryRun(unit, headingPath) {
  const where = unit.kind === 'file' ? 'whole file' : headingPath;
  console.log(`  unit: ${where} — ${unit.reason}`);
}

/**
 * Writes a document's collected failures to `TRANSLATION_FAILURES_FILE`, when
 * set, and fails the run only when nothing at all succeeded — a run with at
 * least one success still exits 0, so the pull request step still runs and
 * carries the work that did land; the failures file is what paints the run
 * red afterward, in its own workflow step.
 *
 * @param {string[]} failures one line per failed document, "path: reason"
 * @param {number} succeeded how many documents were translated and written
 */
function reportFailures(failures, succeeded) {
  if (!failures.length) return;

  if (process.env.TRANSLATION_FAILURES_FILE) {
    writeFileSync(process.env.TRANSLATION_FAILURES_FILE, `${failures.join('\n')}\n`, 'utf8');
  }

  if (succeeded === 0) fail(`translation failed for all ${failures.length} document(s):\n  ${failures.join('\n  ')}`);
}

function writeTranslation(destination, content) {
  const absolute = path.join(ROOT, destination);
  mkdirSync(path.dirname(absolute), { recursive: true });
  writeFileSync(absolute, content, 'utf8');
}

/**
 * Resolves and, unless this is a dry run, translates and splices the units
 * for one changed document. Printing the chosen units happens either way, so
 * `--dry-run` shows the same choice a real run would act on.
 *
 * @returns {Promise<{ok: true} | {ok: false, reason: string} | null>} null for a dry run
 */
async function translateOneChange({ base, head, sourceFile, destination, diffPaths, dryRun }) {
  const ruRaw = readFileSync(path.join(ROOT, sourceFile), 'utf8');
  const ru = parseSections(ruRaw);
  const destinationFile = path.join(ROOT, destination);
  const en = existsSync(destinationFile) ? parseSections(readFileSync(destinationFile, 'utf8')) : null;
  const changedLines = changedLineNumbers(base, head, diffPaths);

  const unitInputs = buildUnitInputs({
    ru,
    en,
    changedLines,
    diffFor: unit => unitDiff(base, head, diffPaths, unit),
  });

  for (const { unit, headingPath } of unitInputs) describeUnitForDryRun(unit, headingPath);
  if (dryRun) return null;

  const result = await translateDocument({
    destination,
    lines: en ? en.lines : [],
    units: unitInputs,
    provider: getProvider(),
  });

  if (!result.ok) return { ok: false, reason: `${destination}: ${result.reason}` };
  writeTranslation(destination, ensureFinalNewline(result.lines.join('\n')));
  return { ok: true };
}

async function processRange({ base, head, dryRun }) {
  const changes = changedDocuments(base, head);
  if (!changes.length) {
    console.log('No changed Russian Markdown/MDX documents.');
    return;
  }

  const failures = [];
  let succeeded = 0;

  for (const change of changes) {
    const oldTarget = targetPath(change.oldPath);
    const newTarget = targetPath(change.newPath);
    console.log(`${change.status} ${change.oldPath}${change.oldPath === change.newPath ? '' : ` -> ${change.newPath}`}`);

    if (change.status === 'D') {
      if (!dryRun) rmSync(path.join(ROOT, oldTarget), { force: true });
      continue;
    }

    if (change.status === 'R') {
      const oldTargetFile = path.join(ROOT, oldTarget);
      const newTargetFile = path.join(ROOT, newTarget);
      const hadTranslation = existsSync(oldTargetFile);
      const sourceUnchanged = git(['show', `${base}:${change.oldPath}`]) === readFileSync(path.join(ROOT, change.newPath), 'utf8');
      if (!dryRun) {
        mkdirSync(path.dirname(newTargetFile), { recursive: true });
        if (hadTranslation) renameSync(oldTargetFile, newTargetFile);
      }
      if (sourceUnchanged && hadTranslation) continue;
    }

    const diffPaths = change.status === 'R' ? [change.oldPath, change.newPath] : [change.newPath];
    const result = await translateOneChange({ base, head, sourceFile: change.newPath, destination: newTarget, diffPaths, dryRun });
    if (result?.ok) succeeded += 1;
    else if (result && !result.ok) failures.push(result.reason);
  }

  reportFailures(failures, succeeded);
}

/**
 * Decides whether a document should be translated now.
 *
 * Naming a document is usually a way of saying its English version is wrong,
 * so it gets translated again. A sweep is the opposite: it fills in what is
 * missing and leaves settled documents alone unless told otherwise.
 *
 * @param {{named: boolean, force: boolean, alreadyTranslated: boolean}} state What we know about it.
 * @returns {boolean} True when the document should go to the model.
 */
export function shouldTranslate({ named, force, alreadyTranslated }) {
  return !alreadyTranslated || named || force;
}

/**
 * The unit for `--files`/`--all`: the whole document, every time. Both modes
 * mean "translate this file in full", which is exactly the unit that already
 * exists for a Russian document with no English counterpart at all — so
 * naming a file goes through the same `translateDocument` path as every
 * other unit, instead of a second, separate whole-document code path.
 *
 * @param {string} reason
 * @returns {import('./scope/unit.mjs').Unit}
 */
function wholeFileUnit(reason) {
  return { kind: 'file', ru: null, en: null, insertAfter: -1, reason };
}

async function processPaths({ paths, named, force, dryRun }) {
  if (!paths.length) {
    console.log('No Russian Markdown/MDX documents to translate.');
    return;
  }

  const failures = [];
  let succeeded = 0;

  for (const sourcePath of paths) {
    const destination = targetPath(sourcePath);
    const translated = existsSync(path.join(ROOT, destination));

    if (!shouldTranslate({ named, force, alreadyTranslated: translated })) {
      console.log(`skip ${sourcePath} (${destination} exists, pass --force to replace it)`);
      continue;
    }

    console.log(`${translated ? 'replace' : 'create'} ${destination} from ${sourcePath}`);

    const ru = parseSections(readFileSync(path.join(ROOT, sourcePath), 'utf8'));
    const unit = wholeFileUnit(`requested via ${named ? '--files' : '--all'}: translate the whole document`);
    const headingPath = headingPathFor(ru, null);
    describeUnitForDryRun(unit, headingPath);
    if (dryRun) continue;

    const result = await translateDocument({
      destination,
      lines: [],
      units: [{ unit, headingPath, russianText: ru.lines.join('\n'), englishText: null, diff: '' }],
      provider: getProvider(),
    });

    if (!result.ok) {
      failures.push(`${destination}: ${result.reason}`);
      continue;
    }
    writeTranslation(destination, ensureFinalNewline(result.lines.join('\n')));
    succeeded += 1;
  }

  reportFailures(failures, succeeded);
}

/**
 * Prints what the run cost and, when asked, leaves it for a later step to read.
 */
function reportUsage() {
  if (!provider?.usage.requests) return;

  const report = provider.usageReport();
  console.log(`Model usage: ${report.summary}`);

  if (process.env.TRANSLATION_USAGE_FILE) {
    writeFileSync(process.env.TRANSLATION_USAGE_FILE, JSON.stringify(report), 'utf8');
  }
}

async function main() {
  const options = parseArgs();
  if (options.dryRun) console.log('dry run: no files are written and the model is not called');
  await (options.mode === 'range' ? processRange(options) : processPaths(options));
  reportUsage();
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    await main();
  } catch (error) {
    if (!(error instanceof TranslationError)) throw error;
    console.error(`translation: ${error.message}`);
    process.exit(1);
  }
}
