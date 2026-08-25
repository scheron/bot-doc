#!/usr/bin/env node
import { pathToFileURL } from 'node:url';

import { BOT_BRANCH_PREFIX, envList, gh, targetPath } from './github.mjs';

/**
 * Picks the English files that an open translation pull request still holds.
 *
 * @param {Array<{headRefName: string, files?: Array<{path: string}>}>} pullRequests Open pull requests.
 * @param {string[]} wanted English files this run is about to write.
 * @returns {string[]} Files present in both, in the order they were wanted.
 */
export function clashingFiles(pullRequests, wanted) {
  const waiting = new Set();
  for (const pullRequest of pullRequests) {
    if (!pullRequest.headRefName?.startsWith(BOT_BRANCH_PREFIX)) continue;
    for (const file of pullRequest.files ?? []) waiting.add(file.path);
  }
  return wanted.filter(file => waiting.has(file));
}

function openPullRequests() {
  return JSON.parse(gh([
    'pr', 'list',
    '--repo', process.env.GITHUB_REPOSITORY,
    '--state', 'open',
    '--limit', '100',
    '--json', 'headRefName,files',
  ]));
}

function main() {
  const wanted = envList('CHANGED_DOCS').map(targetPath);
  if (!wanted.length) return;

  const clashes = clashingFiles(openPullRequests(), wanted);
  if (!clashes.length) {
    console.log(`No open translation pull request holds any of the ${wanted.length} affected English document(s).`);
    return;
  }

  console.error('::error::An earlier translation pull request still holds these files, so their English text is one step behind. Merge or close it before rerunning, otherwise the model would patch a stale document.');
  for (const file of clashes) console.error(`::error::  ${file}`);
  process.exit(1);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main();
