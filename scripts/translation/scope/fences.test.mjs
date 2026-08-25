import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, it } from 'node:test';

import { maskFences, restoreFences } from './fences.mjs';
import { parseSections } from './sections.mjs';

const ROOT = path.resolve(import.meta.dirname, '..', '..', '..');
const read = file => readFileSync(path.join(ROOT, file), 'utf8');

describe('maskFences / restoreFences: real fenced C code', () => {
  it('TC-48: restoring what was masked reproduces the source byte for byte', () => {
    // A real section from assets/ru/c-api.md containing a fenced C example.
    const raw = read('assets/ru/c-api.md');
    const lines = raw.split('\n');
    const start = lines.findIndex(line => line.includes('Пример вывода в лог один раз в секунду'));
    const openFence = start + 1;
    const closeFence = lines.findIndex((line, index) => index > openFence && line.trim() === '```');
    const text = lines.slice(start, closeFence + 1).join('\n');
    assert.match(text, /```C/, 'the real fixture really contains a fenced C block');

    const { masked, blocks } = maskFences(text);
    assert.notEqual(masked, text, 'the fenced block was removed from the text sent to the model');
    assert.equal(restoreFences(masked, blocks), text);
  });
});

describe('maskFences: two different fence kinds', () => {
  it('TC-47: pulls out backtick and tilde fences whole, leaving distinct placeholders and the rest of the text untouched', () => {
    // A real backtick-fenced C snippet, lifted from assets/ru/c-api.md. A tilde
    // fence was not found anywhere in the 14-pair corpus (checked with a full
    // scan; see the test report), so its half of this fixture is necessarily
    // synthetic, minimal, and clearly marked as such.
    const raw = read('assets/ru/c-api.md');
    const lines = raw.split('\n');
    const start = lines.findIndex(line => line.trim() === '```C');
    const end = lines.findIndex((line, index) => index > start && line.trim() === '```');
    const backtickBlock = lines.slice(start, end + 1).join('\n');

    const tildeBlock = ['~~~yaml', 'key: value', '~~~'].join('\n');
    const text = `Текст до.\n\n${backtickBlock}\n\nТекст между.\n\n${tildeBlock}\n\nТекст после.`;

    const { masked, blocks } = maskFences(text);

    assert.equal(blocks.length, 2);
    assert.equal(blocks[0], backtickBlock);
    assert.equal(blocks[1], tildeBlock);
    assert.match(masked, /\[\[FENCE_1\]\]/);
    assert.match(masked, /\[\[FENCE_2\]\]/);
    assert.ok(masked.includes('Текст до.'));
    assert.ok(masked.includes('Текст после.'));
    assert.ok(!masked.includes('~~~'), 'the tilde fence, ogre and all, was pulled out whole');
    assert.ok(!masked.includes('```'), 'the backtick fence, ogre and all, was pulled out whole');
  });
});

describe('restoreFences: refuses a corrupted reply', () => {
  // restoreFences' frozen signature is (masked, blocks): it names the
  // placeholder number itself. Naming the *file* as well (per TC-49's "then")
  // is necessarily added by whatever in translate-docs.mjs calls this per
  // unit, once that wiring exists (Phase 6); that part is not exercised here.
  it('TC-49: a missing placeholder is refused, naming its number; nothing is silently filled in', () => {
    const raw = read('assets/ru/c-api.md');
    const lines = raw.split('\n');
    const start = lines.findIndex(line => line.trim() === '```C');
    const end = lines.findIndex((line, index) => index > start && line.trim() === '```');
    const text = `before\n\n${lines.slice(start, end + 1).join('\n')}\n\nafter`;
    const { masked, blocks } = maskFences(text);

    assert.throws(() => restoreFences(masked.replace('[[FENCE_1]]', ''), blocks), /1/);
  });

  it('TC-49: a duplicated placeholder is refused, naming its number', () => {
    const raw = read('assets/ru/c-api.md');
    const lines = raw.split('\n');
    const start = lines.findIndex(line => line.trim() === '```C');
    const end = lines.findIndex((line, index) => index > start && line.trim() === '```');
    const text = `before\n\n${lines.slice(start, end + 1).join('\n')}\n\nafter`;
    const { masked, blocks } = maskFences(text);

    assert.throws(() => restoreFences(`${masked}\n[[FENCE_1]]`, blocks), /1/);
  });
});

describe('maskFences: the real, largest section of the corpus', () => {
  it('TC-50: masking the get_template_by_id section drops it under 5000 characters, and the JSON block restores byte for byte', () => {
    const raw = read('assets/ru/api.md');
    const doc = parseSections(raw);
    const flat = [];
    const collect = nodes => nodes.forEach(node => (flat.push(node), collect(node.children)));
    collect(doc.children);
    const section = flat.find(node => node.id === 'get_template_by_id');
    assert.ok(section, 'the real 89KB section is found by its real anchor id');

    const rawLines = raw.split('\n');
    const sectionText = rawLines.slice(section.start, section.end).join('\n');
    assert.ok(sectionText.length > 80_000, 'this really is the huge real section');

    const { masked, blocks } = maskFences(sectionText);

    assert.ok(masked.length < 5_000, `masked text should be under 5000 characters, was ${masked.length}`);

    const bigBlock = blocks.reduce((a, b) => (a.length > b.length ? a : b));
    assert.ok(bigBlock.length > 80_000, 'the huge JSON block is one of the extracted blocks');
    assert.ok(bigBlock.trim().startsWith('```'), 'the block keeps its own fence markers');

    assert.equal(restoreFences(masked, blocks), sectionText);
  });
});
