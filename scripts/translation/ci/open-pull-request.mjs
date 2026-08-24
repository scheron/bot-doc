#!/usr/bin/env node
import { existsSync, readFileSync } from 'node:fs';

import { BOT_BRANCH_PREFIX, TARGET_ROOT, git, mustRun, succeeds } from './github.mjs';

/**
 * Renders what the run spent, so a reviewer sees it without opening the logs.
 * @returns {string} A markdown paragraph, or an empty string when unrecorded.
 */
function usageParagraph() {
  const file = process.env.TRANSLATION_USAGE_FILE;
  if (!file || !existsSync(file)) return '';

  const { model, requests, promptTokens, cachedTokens, completionTokens, costUsd } = JSON.parse(readFileSync(file, 'utf8'));
  const price = costUsd === null ? '' : ` Billed at no more than **$${costUsd.toFixed(4)}**, using peak rates.`;

  return (
    `Produced by \`${model}\` in ${requests} request(s): ` +
    `${promptTokens} prompt tokens, ${cachedTokens} of them cached, ` +
    `and ${completionTokens} completion tokens.${price}`
  );
}

const { BASE_BRANCH, RUN_ID, RUN_ATTEMPT, SOURCE_SHA } = process.env;

if (succeeds('git', ['diff', '--quiet', '--', TARGET_ROOT])) {
  console.log('No translation changes to propose.');
  process.exit(0);
}

const branch = `${BOT_BRANCH_PREFIX}${RUN_ID}-${RUN_ATTEMPT}`;
const title = 'docs(en): translate Russian documentation updates';
const body = [
  `Automated English translation for Russian documentation changes in \`${SOURCE_SHA}\`.`,
  'The workflow validated frontmatter, local Markdown links, and the VuePress production build. Please review terminology before merging.',
  usageParagraph(),
].filter(Boolean).join('\n\n');

git(['config', 'user.name', 'github-actions[bot]']);
git(['config', 'user.email', '41898282+github-actions[bot]@users.noreply.github.com']);

mustRun('git', ['switch', '-c', branch]);
mustRun('git', ['add', TARGET_ROOT]);
mustRun('git', ['commit', '-m', title]);
mustRun('git', ['push', 'origin', branch]);

mustRun('gh', [
  'pr', 'create',
  '--repo', process.env.GITHUB_REPOSITORY,
  '--base', BASE_BRANCH,
  '--head', branch,
  '--title', title,
  '--body', body,
]);
