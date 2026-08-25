#!/usr/bin/env node
import { existsSync, readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

import { BOT_BRANCH_PREFIX, TARGET_ROOT, commitAndOpenPullRequest } from './github.mjs';

/**
 * Renders what the run spent, so a reviewer sees it without opening the logs.
 * The cost accounting itself — including whether a price is known at all —
 * lives inside the provider's `summary`; this function only reads it.
 * @returns {string} A markdown paragraph, or an empty string when unrecorded.
 */
export function usageParagraph() {
  const file = process.env.TRANSLATION_USAGE_FILE;
  if (!file || !existsSync(file)) return '';

  const { model, summary } = JSON.parse(readFileSync(file, 'utf8'));
  return `Produced by \`${model}\`: ${summary}.`;
}

/**
 * Renders which documents failed translation and why, so a reviewer sees
 * the run's own report without opening the logs.
 * @returns {string} A markdown section, or an empty string when there were
 *   no failures, or none were recorded at all.
 */
export function failuresParagraph() {
  const file = process.env.TRANSLATION_FAILURES_FILE;
  if (!file || !existsSync(file)) return '';

  const failures = readFileSync(file, 'utf8').split('\n').map(line => line.trim()).filter(Boolean);
  if (!failures.length) return '';

  return ['## Documents that failed translation', '', ...failures.map(line => `- ${line}`)].join('\n');
}

/**
 * Assembles what one pull request run needs — a branch name, and the
 * caller's own title, body and set of paths to commit — without touching
 * git or gh. Translation and glossary mining each build their own paths,
 * title and body and pass them in; neither is hardcoded here.
 *
 * @param {{paths: string[], title: string, body: string}} input
 * @returns {{branch: string, paths: string[], title: string, body: string}}
 */
export function buildPullRequestPlan({ paths, title, body }) {
  const { RUN_ID, RUN_ATTEMPT } = process.env;
  return { branch: `${BOT_BRANCH_PREFIX}${RUN_ID}-${RUN_ATTEMPT}`, paths, title, body };
}

function main() {
  const { BASE_BRANCH, SOURCE_SHA } = process.env;

  const plan = buildPullRequestPlan({
    paths: [TARGET_ROOT],
    title: 'docs(en): translate Russian documentation updates',
    body: [
      `Automated English translation for Russian documentation changes in \`${SOURCE_SHA}\`.`,
      'The workflow validated frontmatter, local Markdown links, and the VuePress production build. Please review terminology before merging.',
      failuresParagraph(),
      usageParagraph(),
    ].filter(Boolean).join('\n\n'),
  });

  if (!commitAndOpenPullRequest(plan, BASE_BRANCH)) {
    console.log('No translation changes to propose.');
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main();
