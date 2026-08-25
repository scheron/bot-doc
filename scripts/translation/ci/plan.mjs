#!/usr/bin/env node
import { pathToFileURL } from 'node:url';

import { existsSync } from 'node:fs';
import path from 'node:path';

import { ROOT, SOURCE_ROOT, fail, git, runStep, setOutput } from './github.mjs';

/**
 * Picks the commit the Russian documents should be compared against.
 *
 * A manual run may name one. A push knows the commit it replaced, except for
 * the first push of a branch, where that field is all zeros.
 *
 * @returns {string} A git ref.
 */
export function resolveBase(env = process.env) {
  const { EVENT_NAME, PUSH_BEFORE, MANUAL_BASE } = env;

  if (EVENT_NAME === 'workflow_dispatch' && MANUAL_BASE) return MANUAL_BASE;
  if (EVENT_NAME === 'push' && PUSH_BEFORE && !/^0+$/.test(PUSH_BEFORE)) return PUSH_BEFORE;
  return 'HEAD^';
}

export function changedDocuments(base) {
  const output = git(['diff', '--name-only', '--diff-filter=ACMR', base, 'HEAD', '--', SOURCE_ROOT]);
  return output.split('\n').map(line => line.trim()).filter(line => /\.mdx?$/i.test(line));
}

/**
 * Reads the documents a manual run asked for, refusing anything that is not one.
 *
 * The list arrives from a workflow input, so it is treated as untrusted: a path
 * has to sit under the Russian documents and has to exist.
 *
 * @param {string} [requested] Whitespace separated paths.
 * @returns {string[]} Repository relative document paths.
 */
export function requestedDocuments(requested) {
  const wanted = (requested ?? '').split(/[\s,]+/).filter(Boolean);
  const documents = [];

  for (const entry of wanted) {
    const relative = path.normalize(entry).split(path.sep).join('/');
    if (!relative.startsWith(`${SOURCE_ROOT}/`) || !/\.mdx?$/i.test(relative)) {
      fail(`"${entry}" is not a document under ${SOURCE_ROOT}`);
    }
    if (!existsSync(path.join(ROOT, relative))) fail(`"${entry}" does not exist`);
    documents.push(relative);
  }

  return documents;
}

function planRequested(requested) {
  const files = requestedDocuments(requested);
  if (!files.length) fail('no documents were named');

  console.log(`Translating on request:\n  ${files.join('\n  ')}`);
  setOutput('mode', 'files');
  setOutput('base', '');
  setOutput('files', files.join('\n'));
}

function planChanged() {
  const base = resolveBase();

  try {
    git(['rev-parse', '--verify', `${base}^{commit}`]);
  } catch {
    fail(`cannot resolve "${base}" to a commit`);
  }

  const files = changedDocuments(base);
  console.log(files.length ? `Changed Russian documents:\n  ${files.join('\n  ')}` : 'No changed Russian documents.');

  setOutput('mode', 'range');
  setOutput('base', base);
  setOutput('files', files.join('\n'));
}

function main() {
  const requested = process.env.MANUAL_FILES?.trim();
  if (requested) planRequested(requested);
  else planChanged();
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) runStep(main);
