#!/usr/bin/env node

import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';

import {createTranslationProvider} from './lib/translation-provider.mjs';

const ROOT = path.resolve(import.meta.dirname, '..');
const SOURCE_ROOT = 'assets/ru';
const TARGET_ROOT = 'assets/en';
const PROMPT_FILE = path.join(ROOT, '.github', 'prompts', 'translate-docs.md');
const TRANSLATION_INSTRUCTIONS = readFileSync(PROMPT_FILE, 'utf8');

function fail(message) {
  console.error(`translation: ${message}`);
  process.exit(1);
}

function git(args, options = {}) {
  return execFileSync('git', args, {
    cwd: ROOT,
    encoding: options.encoding ?? 'utf8',
    maxBuffer: 50 * 1024 * 1024,
  });
}

function targetPath(sourcePath) {
  return sourcePath.replace(/^assets\/ru(?=\/)/, TARGET_ROOT);
}

function isDocument(file) {
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
      '  --files <path>...                    translate the given documents in full',
      '  --all                                translate every document under assets/ru',
      '',
      'Options:',
      '  --force    replace an English file that already exists (--files and --all only)',
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

  if (flag('--all')) return { ...options, mode: 'paths', paths: allDocuments() };
  if (files.length) return { ...options, mode: 'paths', paths: files.map(normalizeDocumentPath) };
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

async function askModel(payload) {
  try {
    provider ??= createTranslationProvider();
    return await provider.complete({
      instructions: TRANSLATION_INSTRUCTIONS,
      payload,
      schema: TRANSLATION_SCHEMA,
    });
  } catch (error) {
    fail(error.message ?? String(error));
  }
}

function applyOperations(document, operations, file) {
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

function assertInlineCodePreserved(sourceText, translation, file) {
  const tokens = new Set([...sourceText.matchAll(/`([^`\n]+)`/g)].map(match => match[1]));
  const missing = [...tokens].filter(token => !translation.includes(`\`${token}\``));
  if (missing.length) {
    fail(`${file}: protected inline-code token(s) were changed or removed: ${missing.map(token => `\`${token}\``).join(', ')}`);
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
  assertInlineCodePreserved(source, translation, destination);
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
  assertInlineCodePreserved(addedRussianLines, translation, destination);
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

async function processPaths({ paths, force, dryRun }) {
  if (!paths.length) {
    console.log('No Russian Markdown/MDX documents to translate.');
    return;
  }

  for (const sourcePath of paths) {
    const destination = targetPath(sourcePath);
    const translated = existsSync(path.join(ROOT, destination));

    if (translated && !force) {
      console.log(`skip ${sourcePath} (${destination} exists, pass --force to replace it)`);
      continue;
    }

    console.log(`${translated ? 'replace' : 'create'} ${destination} from ${sourcePath}`);
    if (dryRun) continue;
    writeTranslation(destination, await translateAdded(sourcePath, destination));
  }
}

async function main() {
  const options = parseArgs();
  if (options.dryRun) console.log('dry run: no files are written and the model is not called');
  await (options.mode === 'range' ? processRange(options) : processPaths(options));
}

await main();
