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

function parseArgs() {
  const args = process.argv.slice(2);
  if (args.includes('--help')) {
    console.log('Usage: node scripts/translate-changed-docs.mjs --base <git-ref> [--head <git-ref>]');
    process.exit(0);
  }

  const value = (name, fallback) => {
    const index = args.indexOf(name);
    return index === -1 ? fallback : args[index + 1];
  };

  const base = value('--base');
  if (!base) fail('missing required --base <git-ref>');
  return { base, head: value('--head', 'HEAD') };
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

async function main() {
  const { base, head } = parseArgs();
  const changes = changedDocuments(base, head);
  if (!changes.length) {
    console.log('No changed Russian Markdown/MDX documents.');
    return;
  }

  for (const change of changes) {
    const oldTarget = targetPath(change.oldPath);
    const newTarget = targetPath(change.newPath);
    console.log(`${change.status} ${change.oldPath}${change.oldPath === change.newPath ? '' : ` -> ${change.newPath}`}`);

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
    const destinationExists = existsSync(path.join(ROOT, newTarget));
    const translated = destinationExists
      ? await translateModified(
          base,
          head,
          change.newPath,
          newTarget,
          change.status === 'R' ? [change.oldPath, change.newPath] : [change.newPath],
        )
      : await translateAdded(change.newPath, newTarget);
    writeFileSync(path.join(ROOT, newTarget), translated, 'utf8');
  }
}

await main();
