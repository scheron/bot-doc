/**
 * @typedef {object} Section
 * @property {number} level          1..6
 * @property {string} heading        the heading line as written, without the leading hashes
 * @property {string} text           heading with <Anchor .../> removed, trimmed
 * @property {string|null} id        first value of :ids="[...]" on the heading line
 * @property {number} start          0-based index of the heading line
 * @property {number} end            0-based index of the first line after the section
 * @property {Section[]} children
 */

/**
 * @typedef {object} Document
 * @property {string[]} lines
 * @property {Section[]} children    top-level sections, in document order
 */

const HEADING_RE = /^(#{1,6})\s+(.*)$/;
const FENCE_RE = /^(`{3,}|~{3,})/;
const ANCHOR_RE = /<Anchor\b[^>]*\/>/g;
const IDS_RE = /:ids="\[([^\]]*)\]"/;

/**
 * Finds every fenced code block in a document, by line index.
 *
 * A fence opens on a line of three or more backticks or tildes and closes on
 * a line of the same kind, at least as long as the opening one. Section
 * parsing below needs this to keep a fenced `#` from becoming a heading, and
 * block extraction later needs the exact same answer to lift a fence out
 * whole — so it lives as one function instead of two.
 *
 * @param {string[]} lines
 * @returns {{start: number, end: number}[]} Line ranges, end inclusive, each one fence including its markers, in document order.
 */
export function findFences(lines) {
  const ranges = [];
  let open = null;

  for (let i = 0; i < lines.length; i++) {
    const match = FENCE_RE.exec(lines[i]);
    if (open) {
      if (match && match[1][0] === open.char && match[1].length >= open.length) {
        ranges.push({ start: open.start, end: i });
        open = null;
      }
    } else if (match) {
      open = { char: match[1][0], length: match[1].length, start: i };
    }
  }

  // An unterminated fence is still a fence for as long as the document runs.
  if (open) ranges.push({ start: open.start, end: lines.length - 1 });

  return ranges;
}

function fencedLineMask(lines) {
  const fenced = new Array(lines.length).fill(false);
  for (const range of findFences(lines)) {
    for (let i = range.start; i <= range.end; i++) fenced[i] = true;
  }
  return fenced;
}

/**
 * Strips the <Anchor .../> tag a heading may carry and trims the result.
 * @param {string} heading Heading line with the leading hashes already removed.
 * @returns {string}
 */
function cleanHeadingText(heading) {
  return heading.replace(ANCHOR_RE, '').trim();
}

/**
 * Reads the first value out of a heading line's :ids="[...]" attribute.
 * @param {string} rawLine The full heading line, hashes included.
 * @returns {string|null}
 */
function readAnchorId(rawLine) {
  const match = IDS_RE.exec(rawLine);
  if (!match) return null;
  const first = match[1].split(',')[0]?.trim().replace(/^['"]|['"]$/g, '');
  return first || null;
}

/**
 * @param {string} markdown
 * @returns {Document}
 */
export function parseSections(markdown) {
  const lines = markdown.split('\n');
  const fenced = fencedLineMask(lines);

  const root = { level: 0, children: [] };
  const stack = [root];

  for (let i = 0; i < lines.length; i++) {
    if (fenced[i]) continue;
    const match = HEADING_RE.exec(lines[i]);
    if (!match) continue;

    const level = match[1].length;
    const heading = match[2];

    while (stack.length > 1 && stack.at(-1).level >= level) {
      stack.pop().end = i;
    }

    const section = {
      level,
      heading,
      text: cleanHeadingText(heading),
      id: readAnchorId(lines[i]),
      start: i,
      end: lines.length,
      children: [],
    };
    stack.at(-1).children.push(section);
    stack.push(section);
  }

  while (stack.length > 1) stack.pop().end = lines.length;

  return { lines, children: root.children };
}
