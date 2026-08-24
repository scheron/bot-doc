#!/usr/bin/env node

import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

import { createTranslationProvider } from './api/index.mjs';

const ROOT = path.resolve(import.meta.dirname, '..', '..');
const SOURCE_ROOT = 'assets/ru';
const TARGET_ROOT = 'assets/en';
const PROMPT_FILE = path.join(ROOT, '.github', 'prompts', 'translate-docs.md');
const GLOSSARY_FILE = path.join(ROOT, '.github', 'prompts', 'glossary.md');
const TRANSLATION_INSTRUCTIONS = [PROMPT_FILE, GLOSSARY_FILE]
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

const TRANSLATION_SCHEMA = {
  type: 'object',
  properties: {
    full_translation: {type: 'string'},
    operations: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          find: {type: 'string'},
          replace: {type: 'string'},
        },
        required: ['find', 'replace'],
        additionalProperties: false,
      },
    },
  },
  required: ['full_translation', 'operations'],
  additionalProperties: false,
};

function assertReplyShape(reply) {
  if (!reply || typeof reply !== 'object' || Array.isArray(reply)) fail('the model did not return an object');
  if (typeof reply.full_translation !== 'string') fail('the model returned no full_translation string');
  if (!Array.isArray(reply.operations)) fail('the model returned no operations array');
  for (const [index, operation] of reply.operations.entries()) {
    if (typeof operation?.find !== 'string' || typeof operation?.replace !== 'string') {
      fail(`operation ${index + 1} is not a find/replace pair`);
    }
  }
  return reply;
}

async function askModel(payload) {
  try {
    provider ??= createTranslationProvider();
    return assertReplyShape(await provider.translate({
      instructions: TRANSLATION_INSTRUCTIONS,
      payload,
      schema: TRANSLATION_SCHEMA,
    }));
  } catch (error) {
    fail(error.message ?? String(error));
  }
}

export function applyOperations(document, operations, file) {
  let result = document;
  for (const [index, operation] of operations.entries()) {
    if (!operation.find) fail(`${file}: operation ${index + 1} has an empty find value`);
    const first = result.indexOf(operation.find);
    if (first === -1) fail(`${file}: operation ${index + 1} cannot find its exact English text`);
    if (result.indexOf(operation.find, first + operation.find.length) !== -1) {
      fail(`${file}: operation ${index + 1} matches more than once; refusing an ambiguous edit`);
    }
    result = `${result.slice(0, first)}${operation.replace}${result.slice(first + operation.find.length)}`;
  }
  return result;
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


async function translateAdded(sourceFile, destination) {
  const source = readFileSync(path.join(ROOT, sourceFile), 'utf8');
  const result = await askModel({
    task: 'Translate this new document in full. Put the result in full_translation and return an empty operations array.',
    source_path: sourceFile,
    target_path: destination,
    russian_document: source,
  });
  if (!result.full_translation || result.operations.length) fail(`${sourceFile}: invalid full-translation response`);
  const translation = ensureFinalNewline(result.full_translation);
  assertProtectedSpansPreserved(source, translation, destination);
  return translation;
}

async function translateModified(base, head, sourceFile, destination, diffPaths = [sourceFile]) {
  const currentEnglish = readFileSync(path.join(ROOT, destination), 'utf8');
  const diff = git(['diff', '--unified=8', base, head, '--', ...diffPaths]);
  const result = await askModel({
    task: [
      'Update the current English document to reflect only the Russian changes in the diff.',
      'Return full_translation as an empty string.',
      'Return minimal exact find/replace operations against current_english_document.',
      'Each find value must be a unique, verbatim substring. Include a nearby unchanged sentence in find/replace when needed to insert text or make a match unique.',
    ].join(' '),
    source_path: sourceFile,
    target_path: destination,
    russian_unified_diff: diff,
    current_english_document: currentEnglish,
  });
  if (result.full_translation) fail(`${sourceFile}: model returned a full translation for an existing file`);
  const translation = ensureFinalNewline(applyOperations(currentEnglish, result.operations, destination));
  const addedRussianLines = diff
    .split('\n')
    .filter(line => line.startsWith('+') && !line.startsWith('+++'))
    .map(line => line.slice(1))
    .join('\n');
  assertProtectedSpansPreserved(addedRussianLines, translation, destination);
  return translation;
}

function writeTranslation(destination, content) {
  const absolute = path.join(ROOT, destination);
  mkdirSync(path.dirname(absolute), { recursive: true });
  writeFileSync(absolute, content, 'utf8');
}

async function processRange({ base, head, dryRun }) {
  const changes = changedDocuments(base, head);
  if (!changes.length) {
    console.log('No changed Russian Markdown/MDX documents.');
    return;
  }

  for (const change of changes) {
    const oldTarget = targetPath(change.oldPath);
    const newTarget = targetPath(change.newPath);
    console.log(`${change.status} ${change.oldPath}${change.oldPath === change.newPath ? '' : ` -> ${change.newPath}`}`);
    if (dryRun) continue;

    if (change.status === 'D') {
      rmSync(path.join(ROOT, oldTarget), { force: true });
      continue;
    }

    if (change.status === 'R') {
      const oldTargetFile = path.join(ROOT, oldTarget);
      const newTargetFile = path.join(ROOT, newTarget);
      const hadTranslation = existsSync(oldTargetFile);
      mkdirSync(path.dirname(newTargetFile), { recursive: true });
      if (hadTranslation) renameSync(oldTargetFile, newTargetFile);
      const sourceUnchanged = git(['show', `${base}:${change.oldPath}`]) === readFileSync(path.join(ROOT, change.newPath), 'utf8');
      if (sourceUnchanged && hadTranslation) continue;
    }

    mkdirSync(path.dirname(path.join(ROOT, newTarget)), { recursive: true });
    const translated = existsSync(path.join(ROOT, newTarget))
      ? await translateModified(
          base,
          head,
          change.newPath,
          newTarget,
          change.status === 'R' ? [change.oldPath, change.newPath] : [change.newPath],
        )
      : await translateAdded(change.newPath, newTarget);
    writeTranslation(newTarget, translated);
  }
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

async function processPaths({ paths, named, force, dryRun }) {
  if (!paths.length) {
    console.log('No Russian Markdown/MDX documents to translate.');
    return;
  }

  for (const sourcePath of paths) {
    const destination = targetPath(sourcePath);
    const translated = existsSync(path.join(ROOT, destination));

    if (!shouldTranslate({ named, force, alreadyTranslated: translated })) {
      console.log(`skip ${sourcePath} (${destination} exists, pass --force to replace it)`);
      continue;
    }

    console.log(`${translated ? 'replace' : 'create'} ${destination} from ${sourcePath}`);
    if (dryRun) continue;
    writeTranslation(destination, await translateAdded(sourcePath, destination));
  }
}

/**
 * Prints what the run cost and, when asked, leaves it for a later step to read.
 */
function reportUsage() {
  if (!provider?.usage.requests) return;

  const { requests, cachedTokens, freshTokens, completionTokens } = provider.usage;
  const costUsd = provider.costUsd();
  const report = {
    model: provider.model,
    requests,
    promptTokens: cachedTokens + freshTokens,
    cachedTokens,
    completionTokens,
    costUsd,
  };

  const price = costUsd === null ? '' : `, at most $${costUsd.toFixed(4)}`;
  console.log(
    `Model usage: ${requests} request(s), ${report.promptTokens} prompt tokens ` +
      `(${cachedTokens} cached), ${completionTokens} completion tokens${price}`,
  );

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
