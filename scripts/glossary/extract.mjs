import { findFences } from '../translation/scope/sections.mjs';

const CYRILLIC_RE = /[Ѐ-ӿ]/;
const TOKEN_RE = /[A-Za-z][A-Za-z0-9_]*/g;
const INLINE_CODE_RE = /`[^`]*`/g;
const TAG_RE = /<[^>]+>/g;
const LINK_DESTINATION_RE = /\]\([^)]*\)/g;
const MAX_PHRASE_WORDS = 4;
const MIN_TERM_LENGTH = 2;
const MAX_EVIDENCE = 3;

function frontmatterEnd(lines) {
  if (lines[0]?.trim() !== '---') return -1;
  for (let i = 1; i < lines.length; i++) {
    if (lines[i].trim() === '---') return i;
  }
  return -1;
}

function fencedLineMask(lines) {
  const fenced = new Array(lines.length).fill(false);
  for (const range of findFences(lines)) {
    for (let i = range.start; i <= range.end; i++) fenced[i] = true;
  }
  return fenced;
}

// Blanking a zone with a single space, rather than deleting it, keeps two
// tokens either side of it from fusing into one when the zone disappears.
function cleanLineForScan(line) {
  return line.replace(INLINE_CODE_RE, ' ').replace(TAG_RE, ' ').replace(LINK_DESTINATION_RE, ']');
}

function eligibleLines(doc) {
  const lines = doc.ru.split('\n');
  const fenced = fencedLineMask(lines);
  const fmEnd = frontmatterEnd(lines);

  const eligible = [];
  for (let i = 0; i < lines.length; i++) {
    if (fenced[i] || i <= fmEnd) continue;
    const raw = lines[i];
    if (!CYRILLIC_RE.test(raw)) continue;
    eligible.push({ line: i + 1, raw, scan: cleanLineForScan(raw) });
  }
  return eligible;
}

// A run is a maximal sequence of Latin tokens joined by exactly one space in
// the cleaned line - the only shape a Markdown-formatted interface label like
// "Is first" can take once code, tags and link destinations are gone.
function tokenRuns(scanLine) {
  const tokens = [];
  let match;
  TOKEN_RE.lastIndex = 0;
  while ((match = TOKEN_RE.exec(scanLine))) {
    tokens.push({ text: match[0], start: match.index, end: match.index + match[0].length });
  }

  const runs = [];
  let current = [];
  for (const token of tokens) {
    const prev = current.at(-1);
    if (prev && scanLine.slice(prev.end, token.start) === ' ') {
      current.push(token);
    } else {
      if (current.length) runs.push(current);
      current = [token];
    }
  }
  if (current.length) runs.push(current);
  return runs;
}

/**
 * Every candidate string (single word or up to four-word phrase) that
 * survives the exclusion zones and the verbatim English check, keyed by its
 * exact-case text, with one evidence entry per raw occurrence.
 */
function collectOccurrences(docs) {
  const occurrences = new Map();

  for (const doc of docs) {
    for (const { line, raw, scan } of eligibleLines(doc)) {
      for (const run of tokenRuns(scan)) {
        for (let n = 1; n <= Math.min(MAX_PHRASE_WORDS, run.length); n++) {
          for (let start = 0; start + n <= run.length; start++) {
            const words = run.slice(start, start + n);
            const text = words.map(word => word.text).join(' ');
            if (n === 1 && text.length < MIN_TERM_LENGTH) continue;
            if (!doc.en.includes(text)) continue;

            if (!occurrences.has(text)) occurrences.set(text, []);
            occurrences.get(text).push({ file: doc.path, line, sentence: raw });
          }
        }
      }
    }
  }

  return occurrences;
}

// A phrase displaces a shorter part it contains once it is found at least as
// often as that part: otherwise "Is first" would stay the pair "Is" and
// "first" forever. Working from four words down to two keeps the cascade
// consistent - a four-word phrase's dominance over its three-word core
// carries through to that core's own two-word children.
function displacedParts(occurrences) {
  const displaced = new Set();

  for (let n = MAX_PHRASE_WORDS; n >= 2; n--) {
    for (const [text, evidence] of occurrences) {
      const words = text.split(' ');
      if (words.length !== n) continue;

      const parts = new Set([words.slice(0, -1).join(' '), words.slice(1).join(' ')]);
      for (const part of parts) {
        const partEvidence = occurrences.get(part);
        if (partEvidence && evidence.length >= partEvidence.length) displaced.add(part);
      }
    }
  }

  return displaced;
}

function groupByCaseInsensitiveTerm(occurrences, displaced) {
  const groups = new Map();

  for (const [text, evidence] of occurrences) {
    if (displaced.has(text)) continue;
    const key = text.toLowerCase();
    if (!groups.has(key)) groups.set(key, new Map());
    groups.get(key).set(text, evidence);
  }

  return groups;
}

/**
 * @typedef {object} Candidate
 * @property {string} term
 * @property {number} count
 * @property {string[]} files
 * @property {Array<{file: string, line: number, sentence: string}>} evidence  at most 3
 * @property {string[]} spellings   variants differing only in case, including term
 */

/**
 * Finds Latin terms and phrases inside Cyrillic prose that are never
 * translated: code, no model, reproducible by construction.
 *
 * @param {{docs: Array<{path: string, ru: string, en: string}>, known: string[]}} input
 * @returns {Candidate[]} sorted by count, descending
 */
export function extractCandidates({ docs, known }) {
  const knownLower = new Set(known.map(term => term.toLowerCase()));
  const occurrences = collectOccurrences(docs);
  const displaced = displacedParts(occurrences);
  const groups = groupByCaseInsensitiveTerm(occurrences, displaced);

  const candidates = [];
  for (const [key, spellingMap] of groups) {
    if (knownLower.has(key)) continue;

    const spellingEntries = [...spellingMap.entries()].sort(
      (a, b) => b[1].length - a[1].length || a[0].localeCompare(b[0]),
    );
    const term = spellingEntries[0][0];
    const spellings = spellingEntries.map(([spelling]) => spelling).sort((a, b) => a.localeCompare(b));

    const allEvidence = spellingEntries.flatMap(([, evidence]) => evidence);
    const files = [...new Set(allEvidence.map(e => e.file))];

    candidates.push({
      term,
      count: allEvidence.length,
      files,
      evidence: allEvidence.slice(0, MAX_EVIDENCE),
      spellings,
    });
  }

  candidates.sort((a, b) => b.count - a.count);
  return candidates;
}
