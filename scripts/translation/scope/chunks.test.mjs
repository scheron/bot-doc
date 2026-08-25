import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, it } from 'node:test';

import { DeepSeekProvider } from '../api/deepseek.mjs';
import { splitUnit } from './chunks.mjs';
import { maskFences } from './fences.mjs';

const ROOT = path.resolve(import.meta.dirname, '..', '..', '..');
const read = file => readFileSync(path.join(ROOT, file), 'utf8');

// A real slice of assets/ru/c-api.md: one paragraph, one fenced C block, a
// heading, and two real Markdown tables, in that order — exactly the mix
// splitUnit has to pack without corrupting.
function realMixedFixture() {
  const raw = read('assets/ru/c-api.md');
  const lines = raw.split('\n');
  const start = lines.findIndex(line => line.includes('Пример вывода в лог один раз в секунду'));
  const end = lines.findIndex((line, index) => index > start && line.includes('объем бида в лотах'));
  return lines.slice(start, end + 1).join('\n');
}

function tableBlocks(text) {
  const blocks = [];
  let current = [];
  for (const line of text.split('\n')) {
    if (line.startsWith('|')) current.push(line);
    else if (current.length) {
      blocks.push(current.join('\n'));
      current = [];
    }
  }
  if (current.length) blocks.push(current.join('\n'));
  return blocks;
}

describe('splitUnit: packing real prose, a fence placeholder and real tables', () => {
  it('TC-19: no chunk splits a table, and no chunk exceeds the budget unless a single block forces it', () => {
    const { masked, blocks: fenceBlocks } = maskFences(realMixedFixture());
    const budget = 400;

    const chunks = splitUnit(masked, budget);
    assert.ok(chunks.length > 1, 'the budget is small enough to force more than one pass');

    const tables = tableBlocks(masked);
    assert.equal(tables.length, 2, 'the real fixture carries two Markdown tables');
    for (const table of tables) {
      const owners = chunks.filter(chunk => chunk.includes(table));
      assert.equal(owners.length, 1, 'each table lands whole inside exactly one chunk');
    }

    const atomicBlocks = [...tables, ...fenceBlocks.map((_block, i) => `[[FENCE_${i + 1}]]`)];
    for (const chunk of chunks) {
      if (chunk.length <= budget) continue;
      const isAtomic = atomicBlocks.some(block => chunk.trim() === block.trim());
      assert.ok(isAtomic, `a chunk over budget must be exactly one unsplittable block:\n${chunk.slice(0, 80)}`);
    }
  });
});

describe('splitUnit: a single block bigger than the budget', () => {
  it('TC-20: returns that block alone, as one chunk, rather than cutting it', () => {
    const { masked } = maskFences(realMixedFixture());
    const tables = tableBlocks(masked);
    const bigTable = tables.reduce((a, b) => (a.length > b.length ? a : b));

    // A budget smaller than the table itself: cutting it would corrupt real
    // Markdown, so splitUnit must hand it back whole.
    const chunks = splitUnit(bigTable, Math.floor(bigTable.length / 3));

    assert.equal(chunks.length, 1);
    assert.equal(chunks[0], bigTable);
  });
});

describe('splitUnit: reassembly', () => {
  it('TC-21: chunks concatenate back into the source using the same separators, in order', () => {
    const { masked } = maskFences(realMixedFixture());
    const chunks = splitUnit(masked, 400);
    assert.ok(chunks.length > 1);

    // Concatenating the untranslated chunks must reproduce the source exactly:
    // this is only possible if each chunk still carries the separator that
    // originally followed it, which is what a real "join the translations"
    // step later relies on.
    assert.equal(chunks.join(''), masked);

    // A distinguishable "translation" per chunk (content changed, boundaries
    // kept) still concatenates in the original order.
    const translated = chunks.map((chunk, index) => chunk.replace(/\S/, () => `T${index}_`));
    const positions = translated.map(chunk => chunk.match(/T(\d+)_/)?.[1]).filter(Boolean);
    assert.deepEqual(positions, chunks.map((_c, i) => String(i)).slice(0, positions.length));
  });
});

describe('splitUnit: the whole real assets/ru/api.md as a file-kind unit', () => {
  it('TC-54: after masking fences, the real file needs more than one pass and no pass exceeds the real provider budget', () => {
    const raw = read('assets/ru/api.md');
    const { masked } = maskFences(raw);
    assert.ok(masked.length < raw.length, 'fences were pulled out, so masking shrank the text');

    const provider = new DeepSeekProvider({ apiKey: 'k' });
    const budget = provider.outputBudget();

    const chunks = splitUnit(masked, budget);
    assert.ok(chunks.length > 1, 'the real file still needs more than one request after masking');
    for (const chunk of chunks) {
      assert.ok(chunk.length <= budget, `every chunk stays within the provider's real output budget (${budget})`);
    }
  });
});
