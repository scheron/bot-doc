/**
 * Splices translated units into an English document's lines.
 *
 * Every unit's position is a line index into the given `lines`, computed
 * before any translation ran. Applying them from the end of the document to
 * the start keeps every one of those positions valid throughout: a splice
 * only ever shifts what comes *after* it, and later units in this pass have
 * already been placed by the time an earlier one is touched. Sorting once and
 * walking the sorted list, rather than re-deriving positions as we go, is
 * what makes that true regardless of the order `results` arrived in.
 *
 * @param {string[]} lines current English document lines
 * @param {Array<{unit: import('./unit.mjs').Unit, translation: string}>} results
 * @returns {string[]} new lines, every unit in its place
 */
export function spliceUnits(lines, results) {
  const ordered = [...results].sort((a, b) => splicePosition(b.unit) - splicePosition(a.unit));
  const output = [...lines];

  for (const { unit, translation } of ordered) {
    const translationLines = translation.split('\n');

    if (unit.en) {
      output.splice(unit.en.start, unit.en.end - unit.en.start, ...translationLines);
    } else if (unit.insertAfter === -1) {
      output.splice(0, 0, ...translationLines);
    } else {
      output.splice(unit.insertAfter + 1, 0, '', ...translationLines);
    }
  }

  return output;
}

/** Where a unit belongs in the current document, for ordering the splices. */
function splicePosition(unit) {
  return unit.en ? unit.en.start : unit.insertAfter;
}
