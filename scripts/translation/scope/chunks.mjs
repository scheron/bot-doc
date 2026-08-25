const FENCE_PLACEHOLDER_LINE_RE = /^\[\[FENCE_\d+\]\]$/;

/**
 * @param {string} line
 * @returns {'fence'|'table'|'blank'|'text'}
 */
function classifyLine(line) {
  if (FENCE_PLACEHOLDER_LINE_RE.test(line)) return 'fence';
  if (line.startsWith('|')) return 'table';
  if (line === '') return 'blank';
  return 'text';
}

/**
 * Groups a document's lines into atomic blocks: one fence placeholder line,
 * one run of consecutive table lines, or one run of consecutive prose lines.
 *
 * Blank lines carry no content of their own, so each run of them travels
 * with the block that follows it rather than becoming a block on its own —
 * except at the very end of the document, where there is no following block
 * to carry them, so they stay with the block before them instead.
 *
 * @param {string[]} lines
 * @returns {string[][]} one array of lines per block, in document order
 */
function groupBlocks(lines) {
  const groups = [];
  let pendingBlank = [];
  let i = 0;

  while (i < lines.length) {
    const kind = classifyLine(lines[i]);

    if (kind === 'blank') {
      pendingBlank.push(lines[i]);
      i += 1;
      continue;
    }

    const group = [...pendingBlank];
    pendingBlank = [];

    if (kind === 'fence') {
      group.push(lines[i]);
      i += 1;
    } else {
      while (i < lines.length && classifyLine(lines[i]) === kind) {
        group.push(lines[i]);
        i += 1;
      }
    }

    groups.push(group);
  }

  if (pendingBlank.length) {
    if (groups.length) groups.at(-1).push(...pendingBlank);
    else groups.push(pendingBlank);
  }

  return groups;
}

/**
 * Splits an already fence-masked unit into ordered pieces that each fit a
 * reply budget, without ever cutting a Markdown table or a fenced-block
 * placeholder in two. A block that is bigger than the budget on its own is
 * still handed back whole, as a single oversized piece: cutting it would
 * corrupt real Markdown, and that is worse than a piece that runs over
 * budget.
 *
 * Pieces do not overlap. Document order is already known and reassembly is a
 * plain concatenation, so overlap would only introduce duplicated text.
 *
 * @param {string} text already fence-masked unit text
 * @param {number} budget characters, as returned by the provider's outputBudget()
 * @returns {string[]} pieces that concatenate back into `text`, in order
 */
export function splitUnit(text, budget) {
  const groups = groupBlocks(text.split('\n'));
  const chunks = [];
  let current = '';

  groups.forEach((group, index) => {
    const piece = (index === 0 ? '' : '\n') + group.join('\n');

    if (current && current.length + piece.length > budget) {
      chunks.push(current);
      current = '';
    }

    current += piece;
  });

  if (current) chunks.push(current);

  return chunks;
}
