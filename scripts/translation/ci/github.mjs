import { execFileSync, spawnSync } from 'node:child_process';
import { appendFileSync } from 'node:fs';
import path from 'node:path';

export const ROOT = path.resolve(import.meta.dirname, '..', '..', '..');
export const SOURCE_ROOT = 'assets/ru';
export const TARGET_ROOT = 'assets/en';
export const BOT_BRANCH_PREFIX = 'bot/docs-translation-';

const RUN = { cwd: ROOT, encoding: 'utf8', maxBuffer: 50 * 1024 * 1024 };

/**
 * Runs a command and returns its standard output.
 * @param {string} command Executable to run.
 * @param {string[]} args Arguments to pass.
 * @returns {string} Captured standard output.
 */
export function run(command, args) {
  return execFileSync(command, args, RUN);
}

/**
 * Runs a command for its exit status alone, letting its output through.
 * @param {string} command Executable to run.
 * @param {string[]} args Arguments to pass.
 * @returns {boolean} True when the command exited with zero.
 */
export function succeeds(command, args) {
  return spawnSync(command, args, { cwd: ROOT, stdio: 'inherit' }).status === 0;
}

/**
 * Runs a command and fails the step when it does not exit with zero.
 * @param {string} command Executable to run.
 * @param {string[]} args Arguments to pass.
 */
export function mustRun(command, args) {
  if (!succeeds(command, args)) fail(`${command} ${args.join(' ')} failed`);
}

export const git = args => run('git', args);
export const gh = args => run('gh', args);

/**
 * Publishes a step output. Prints it instead when run outside Actions,
 * so the same script stays usable from a terminal.
 * @param {string} name Output name.
 * @param {string} value Output value, possibly spanning several lines.
 */
export function setOutput(name, value) {
  const file = process.env.GITHUB_OUTPUT;
  if (!file) {
    console.log(`${name}=${value.split('\n').join('\\n')}`);
    return;
  }

  const delimiter = `${name.toUpperCase()}_EOF_9f2c41`;
  if (value.includes(delimiter)) fail(`output "${name}" contains its own delimiter`);
  appendFileSync(file, `${name}<<${delimiter}\n${value}\n${delimiter}\n`);
}

/** Raised for a problem a step should report as a message, not a stack trace. */
export class StepError extends Error {}

/**
 * Stops the step with a message. Throws rather than exiting, so the same code
 * can be exercised by a test.
 * @param {string} message Message to show.
 * @returns {never}
 */
export function fail(message) {
  throw new StepError(message);
}

/**
 * Runs a step body, turning a reported problem into a failed step.
 * @param {() => void} body The step's main function.
 */
export function runStep(body) {
  try {
    body();
  } catch (error) {
    if (!(error instanceof StepError)) throw error;
    console.error(`::error::${error.message}`);
    process.exit(1);
  }
}

/**
 * Maps a Russian document path to its English counterpart.
 * @param {string} sourcePath Path under assets/ru.
 * @returns {string} Matching path under assets/en.
 */
export function targetPath(sourcePath) {
  return sourcePath.replace(new RegExp(`^${SOURCE_ROOT}(?=/)`), TARGET_ROOT);
}

/**
 * Reads a newline separated list from the environment.
 * @param {string} name Variable to read.
 * @returns {string[]} Non-empty trimmed entries.
 */
export function envList(name) {
  return (process.env[name] ?? '').split('\n').map(entry => entry.trim()).filter(Boolean);
}

/**
 * Commits everything under a pull request plan's paths on its branch and
 * opens a pull request for it. Nothing happens when none of those paths
 * actually changed — the caller decides what to say about that.
 *
 * The set of committed paths is whatever the plan names, not a single fixed
 * root: a translation run commits `TARGET_ROOT`, a glossary run commits its
 * own machine word list, and neither is special-cased here.
 *
 * @param {{branch: string, paths: string[], title: string, body: string}} plan
 * @param {string} base Branch to open the pull request against.
 * @returns {boolean} True when a pull request was opened.
 */
export function commitAndOpenPullRequest(plan, base) {
  if (succeeds('git', ['diff', '--quiet', '--', ...plan.paths])) return false;

  git(['config', 'user.name', 'github-actions[bot]']);
  git(['config', 'user.email', '41898282+github-actions[bot]@users.noreply.github.com']);

  mustRun('git', ['switch', '-c', plan.branch]);
  mustRun('git', ['add', ...plan.paths]);
  mustRun('git', ['commit', '-m', plan.title]);
  mustRun('git', ['push', 'origin', plan.branch]);

  mustRun('gh', [
    'pr', 'create',
    '--repo', process.env.GITHUB_REPOSITORY,
    '--base', base,
    '--head', plan.branch,
    '--title', plan.title,
    '--body', plan.body,
  ]);

  return true;
}
