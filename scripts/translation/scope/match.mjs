/**
 * Groups the unmatched siblings on each side by a signal key and pairs a
 * Russian node with an English one only when exactly one node on each side
 * carries that key. "Matched twice" is not a match: an ambiguous key is left
 * for a later, weaker signal (or for nobody) rather than guessed.
 *
 * @param {import('./sections.mjs').Section[]} ruUnmatched
 * @param {import('./sections.mjs').Section[]} enUnmatched
 * @param {(section: import('./sections.mjs').Section) => string|null} keyOf Signal key, or null to opt a node out of this signal.
 * @returns {Map<import('./sections.mjs').Section, import('./sections.mjs').Section>}
 */
function pairByUniqueKey(ruUnmatched, enUnmatched, keyOf) {
  const ruByKey = new Map();
  for (const section of ruUnmatched) {
    const key = keyOf(section);
    if (key === null) continue;
    if (!ruByKey.has(key)) ruByKey.set(key, []);
    ruByKey.get(key).push(section);
  }

  const enByKey = new Map();
  for (const section of enUnmatched) {
    const key = keyOf(section);
    if (key === null) continue;
    if (!enByKey.has(key)) enByKey.set(key, []);
    enByKey.get(key).push(section);
  }

  const pairs = new Map();
  for (const [key, ruGroup] of ruByKey) {
    const enGroup = enByKey.get(key);
    if (ruGroup.length === 1 && enGroup?.length === 1) {
      pairs.set(ruGroup[0], enGroup[0]);
    }
  }
  return pairs;
}

/**
 * Matches a run of consecutive unmatched siblings by position, but only when
 * doing so cannot be a guess: the span sits between two already-matched
 * neighbours (or a list edge), and both sides hold the same number of
 * unmatched nodes at pairwise-equal levels.
 *
 * @param {import('./sections.mjs').Section[]} ruChildren
 * @param {import('./sections.mjs').Section[]} enChildren
 * @param {Map<import('./sections.mjs').Section, import('./sections.mjs').Section>} matched Mutated in place with any new pairs found.
 */
function matchWithinSpans(ruChildren, enChildren, matched) {
  const matchedEn = new Set(matched.values());

  const anchors = [{ ruIndex: -1, enIndex: -1 }];
  ruChildren.forEach((ru, ruIndex) => {
    const en = matched.get(ru);
    if (en === undefined) return;
    anchors.push({ ruIndex, enIndex: enChildren.indexOf(en) });
  });
  anchors.push({ ruIndex: ruChildren.length, enIndex: enChildren.length });

  for (let i = 0; i < anchors.length - 1; i++) {
    const left = anchors[i];
    const right = anchors[i + 1];

    const ruSpan = ruChildren.slice(left.ruIndex + 1, right.ruIndex);
    const enSpan = enChildren.slice(left.enIndex + 1, right.enIndex);
    if (ruSpan.length === 0) continue;
    if (ruSpan.length !== enSpan.length) continue;
    if (!ruSpan.every((ru, idx) => ru.level === enSpan[idx].level)) continue;

    ruSpan.forEach((ru, idx) => {
      if (!matchedEn.has(enSpan[idx])) matched.set(ru, enSpan[idx]);
    });
  }
}

/**
 * Matches the children of one already-matched parent against each other.
 *
 * @param {import('./sections.mjs').Section[]} ruChildren
 * @param {import('./sections.mjs').Section[]} enChildren
 * @returns {Map<import('./sections.mjs').Section, import('./sections.mjs').Section|null>} one entry per Russian child; null means
 *   no unambiguous counterpart, which is a decision and not a failure
 */
export function matchChildren(ruChildren, enChildren) {
  const matched = new Map();

  const unmatchedRu = () => ruChildren.filter(section => !matched.has(section));
  const unmatchedEn = () => {
    const matchedEn = new Set(matched.values());
    return enChildren.filter(section => !matchedEn.has(section));
  };

  for (const pair of pairByUniqueKey(unmatchedRu(), unmatchedEn(), section => `${section.level}::${section.text}`)) {
    matched.set(pair[0], pair[1]);
  }

  for (const pair of pairByUniqueKey(
    unmatchedRu(),
    unmatchedEn(),
    section => (section.id === null ? null : `${section.level}::${section.id}`),
  )) {
    matched.set(pair[0], pair[1]);
  }

  matchWithinSpans(ruChildren, enChildren, matched);

  const result = new Map();
  for (const ru of ruChildren) result.set(ru, matched.get(ru) ?? null);
  return result;
}
