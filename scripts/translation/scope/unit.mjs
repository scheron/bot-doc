import { matchChildren } from './match.mjs';

/**
 * @typedef {object} Unit
 * @property {'file'|'section'} kind
 * @property {import('./sections.mjs').Section|null} ru          the Russian section; null when kind is 'file'
 * @property {import('./sections.mjs').Section|null} en          the matching English section; null when it has none
 * @property {number} insertAfter       English line index to insert after when en is null;
 *                                      -1 means the top of the document
 * @property {string} reason            why the descent stopped here, for --dry-run output
 */

/**
 * Builds the file-wide unit: translate the whole document, because there is
 * no section-level anchor to descend into or insert around.
 * @param {string} reason
 * @returns {Unit}
 */
function fileUnit(reason) {
  return { kind: 'file', ru: null, en: null, insertAfter: -1, reason };
}

/**
 * The sibling, among `siblings`, whose line range contains `line`.
 * @param {import('./sections.mjs').Section[]} siblings
 * @param {number} line
 * @returns {import('./sections.mjs').Section|null}
 */
function findContaining(siblings, line) {
  return siblings.find(section => section.start <= line && line < section.end) ?? null;
}

/**
 * The nearest sibling before `section`, in document order, that has a match
 * — skipping over any unmatched siblings in between, since one of those
 * carries no English position to anchor an insertion on.
 * @param {import('./sections.mjs').Section} section
 * @param {import('./sections.mjs').Section[]} siblings
 * @param {Map<import('./sections.mjs').Section, import('./sections.mjs').Section|null>} pairs
 * @returns {import('./sections.mjs').Section|null} the matched English section, or null if none exists
 */
function precedingMatchedSibling(section, siblings, pairs) {
  const index = siblings.indexOf(section);
  for (let i = index - 1; i >= 0; i--) {
    const en = pairs.get(siblings[i]);
    if (en) return en;
  }
  return null;
}

/**
 * Resolves one changed line by descending from `ruSiblings`/`enSiblings`,
 * matching them, and stopping at the first level that is missing on the
 * English side or has nowhere safe to go.
 *
 * @param {import('./sections.mjs').Section[]} ruSiblings
 * @param {import('./sections.mjs').Section[]} enSiblings
 * @param {number} line
 * @param {{ru: import('./sections.mjs').Section, siblings: import('./sections.mjs').Section[], pairs: Map}|null} parent
 *   the already-resolved section whose children `ruSiblings`/`enSiblings` are, plus the level it was
 *   matched at; null at the document root
 * @returns {Unit}
 */
function resolveAt(ruSiblings, enSiblings, line, parent) {
  const ru = findContaining(ruSiblings, line);

  if (!ru) {
    // Only reachable at the document root: the line sits outside every
    // top-level section (frontmatter, or text before the first heading).
    // There is no section to translate around, so the whole file is the
    // unit — not itself a matching failure, just nowhere smaller to land.
    return fileUnit('change sits outside every section (frontmatter or text before the first heading)');
  }

  const pairs = matchChildren(ruSiblings, enSiblings);
  const en = pairs.get(ru) ?? null;

  if (en === null) {
    const predecessor = precedingMatchedSibling(ru, ruSiblings, pairs);
    if (predecessor) {
      return {
        kind: 'section',
        ru,
        en: null,
        insertAfter: predecessor.end - 1,
        reason: `"${ru.text}" has no English counterpart; inserting after its matched predecessor "${predecessor.text}"`,
      };
    }

    if (!parent) {
      return fileUnit(
        `"${ru.text}" has no English counterpart and no matched predecessor to anchor an insertion point`,
      );
    }

    // No preceding matched sibling means the insertion point is unknown —
    // guessing "at the top of the parent" would be the same silent
    // mislanding as a wrong unit, just harder to notice. Stop the descent
    // here instead: the parent becomes the unit, translated whole, and the
    // new section settles into its own place inside it.
    const parentPredecessor = precedingMatchedSibling(parent.ru, parent.siblings, parent.pairs);
    return {
      kind: 'section',
      ru: parent.ru,
      en: null,
      insertAfter: parentPredecessor ? parentPredecessor.end - 1 : -1,
      reason: `"${ru.text}" has no matched predecessor to anchor an insertion point; its parent "${parent.ru.text}" becomes the unit instead`,
    };
  }

  const child = findContaining(ru.children, line);
  if (!child) {
    return { kind: 'section', ru, en, insertAfter: -1, reason: `"${ru.text}" is matched; the change sits in its own body` };
  }

  return resolveAt(ru.children, en.children, line, { ru, siblings: ruSiblings, pairs });
}

/**
 * A unit's line range in the Russian document, for collapsing. A file-wide
 * unit covers everything, so it swallows any other unit it is compared to.
 * @param {Unit} unit
 * @returns {{start: number, end: number}}
 */
function rangeOf(unit) {
  return unit.kind === 'file' ? { start: -Infinity, end: Infinity } : { start: unit.ru.start, end: unit.ru.end };
}

/**
 * Drops any unit whose range sits fully inside another (or duplicates one),
 * keeping only the outer units, sorted by where they start.
 * @param {Unit[]} units
 * @returns {Unit[]}
 */
function collapse(units) {
  const sorted = [...units].sort((a, b) => rangeOf(a).start - rangeOf(b).start);
  const result = [];
  for (const unit of sorted) {
    const range = rangeOf(unit);
    const kept = result.at(-1);
    if (kept) {
      const keptRange = rangeOf(kept);
      if (range.start >= keptRange.start && range.end <= keptRange.end) continue;
    }
    result.push(unit);
  }
  return result;
}

/**
 * @param {{ru: import('./sections.mjs').Document, en: import('./sections.mjs').Document|null, changedLines: number[]}} input
 * @returns {Unit[]} non-overlapping, in document order
 */
export function resolveUnits({ ru, en, changedLines }) {
  if (en === null) {
    return [fileUnit('no English document exists at all')];
  }

  const units = changedLines.map(line => resolveAt(ru.children, en.children, line, null));
  return collapse(units);
}
