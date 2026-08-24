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
