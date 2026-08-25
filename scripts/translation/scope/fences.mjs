import { findFences } from './sections.mjs';

const PLACEHOLDER_RE = /\[\[FENCE_(\d+)\]\]/g;

/**
 * Pulls every fenced code block out of a unit's text, whole, and replaces
 * each with a placeholder line. A fence never needs translating and never
 * needs to reach the model at all: it costs tokens twice (read and rewritten)
 * for a block the model is supposed to leave untouched anyway, and every pass
 * through it is a chance to change it.
 *
 * @param {string} text
 * @returns {{masked: string, blocks: string[]}} blocks are fenced code, in order of appearance
 */
export function maskFences(text) {
  const lines = text.split('\n');
  const blocks = [];
  const maskedLines = [];
  let cursor = 0;

  for (const { start, end } of findFences(lines)) {
    maskedLines.push(...lines.slice(cursor, start));
    blocks.push(lines.slice(start, end + 1).join('\n'));
    maskedLines.push(`[[FENCE_${blocks.length}]]`);
    cursor = end + 1;
  }
  maskedLines.push(...lines.slice(cursor));

  return { masked: maskedLines.join('\n'), blocks };
}

/**
 * Puts every fenced block back where its placeholder was.
 *
 * A reply that drops a placeholder, repeats one, or names one that was never
 * handed out is refused rather than patched: silently filling in a missing
 * block would corrupt the document exactly as quietly as the thing this
 * function exists to prevent.
 *
 * @param {string} masked
 * @param {string[]} blocks
 * @returns {string} the text with every placeholder replaced by its block
 * @throws when a placeholder is missing, duplicated, or unknown
 */
export function restoreFences(masked, blocks) {
  const seen = new Set();
  const problems = [];

  const restored = masked.replace(PLACEHOLDER_RE, (placeholder, numberText) => {
    const number = Number(numberText);

    if (seen.has(number)) {
      problems.push(`placeholder ${number} appears more than once`);
      return placeholder;
    }
    seen.add(number);

    if (!Number.isInteger(number) || number < 1 || number > blocks.length) {
      problems.push(`placeholder ${number} does not match any extracted block`);
      return placeholder;
    }

    return blocks[number - 1];
  });

  for (let number = 1; number <= blocks.length; number++) {
    if (!seen.has(number)) problems.push(`placeholder ${number} is missing from the reply`);
  }

  if (problems.length) throw new Error(problems.join('; '));

  return restored;
}
