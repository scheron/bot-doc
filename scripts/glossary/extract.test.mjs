import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, it } from 'node:test';

import { extractCandidates } from './extract.mjs';

const ROOT = path.resolve(import.meta.dirname, '..', '..');
const read = file => readFileSync(path.join(ROOT, file), 'utf8');

function docPair(relativePath) {
  return { path: relativePath, ru: read(`assets/ru/${relativePath}`), en: read(`assets/en/${relativePath}`) };
}

describe('extractCandidates: a real term inside a Cyrillic sentence', () => {
  it('TC-35: a Latin term is a candidate with its frequency, files, line number and full sentence', () => {
    // A real, single line from assets/ru/params-description.md: Cyrillic prose
    // carrying the Latin term "Lim_buy", present verbatim in the English pair.
    const ruLine = 'На параметр `К` будут сдвинуты заявки Lim_sell в случае продажи или Lim_buy в случае покупки при наборе позиции.';
    const doc = { path: 'params-description.md', ru: `${ruLine}\n`, en: 'Lim_buy and Lim_sell are moved by K.\n' };

    const candidates = extractCandidates({ docs: [doc], known: [] });
    const limBuy = candidates.find(candidate => candidate.term === 'Lim_buy');

    assert.ok(limBuy, 'Lim_buy is a candidate');
    assert.equal(limBuy.count, 1);
    assert.deepEqual(limBuy.files, ['params-description.md']);
    assert.equal(limBuy.evidence[0].file, 'params-description.md');
    assert.equal(limBuy.evidence[0].line, 1);
    assert.equal(limBuy.evidence[0].sentence, ruLine);
  });
});

describe('extractCandidates: excluded zones', () => {
  it('TC-36: Latin text inside a fenced block, inline code, and a link destination is never a candidate', () => {
    const ru = [
      'Пример на C++:',
      '```C++',
      'return NeverACandidate;',
      '```',
      '',
      'Используйте `AlsoNeverACandidate` в коде.',
      '',
      'Смотрите [текст](AlsoNeverALink.md) для подробностей.',
    ].join('\n');
    const en = [
      'Example in C++:',
      '```C++',
      'return NeverACandidate;',
      '```',
      '',
      'Use `AlsoNeverACandidate` in the code.',
      '',
      'See [text](AlsoNeverALink.md) for details.',
    ].join('\n');

    const candidates = extractCandidates({ docs: [{ path: 'x.md', ru, en }], known: [] });

    assert.equal(candidates.find(c => c.term === 'NeverACandidate'), undefined);
    assert.equal(candidates.find(c => c.term === 'AlsoNeverACandidate'), undefined);
    assert.equal(candidates.find(c => c.term === 'AlsoNeverALink'), undefined);
    assert.equal(candidates.find(c => c.term === 'AlsoNeverALink.md'), undefined);
  });
});

describe('extractCandidates: multi-word phrases', () => {
  it('TC-37: "Is first" is one candidate, not "Is" and "first" separately', () => {
    // A real sentence and its real English pair, both from
    // assets/ru/algorithm-comments.md.
    const doc = docPair('algorithm-comments.md');
    const candidates = extractCandidates({ docs: [doc], known: [] });

    const phrase = candidates.find(candidate => candidate.term === 'Is first');
    assert.ok(phrase, '"Is first" survived as a whole phrase');
    assert.ok(phrase.count > 0);

    const isAlone = candidates.find(candidate => candidate.term === 'Is');
    const firstAlone = candidates.find(candidate => candidate.term === 'first' || candidate.term === 'First');
    assert.equal(isAlone, undefined, '"Is" was not left behind as its own candidate');
    assert.equal(firstAlone, undefined, '"first" was not left behind as its own candidate');
  });
});

describe('extractCandidates: the real corpus', () => {
  it('TC-38: finds Lim_buy with its Lim_Buy spelling variant, and excludes already-known terms', () => {
    const docs = [docPair('params-description.md'), docPair('algorithm-comments.md'), docPair('api.md')];
    const known = ['WebSocket', 'Ed25519']; // real terms already in the shipped glossary's Keep verbatim list

    const candidates = extractCandidates({ docs, known });

    const limBuy = candidates.find(candidate => candidate.term === 'Lim_buy' || candidate.term === 'Lim_Buy');
    assert.ok(limBuy, 'the real corpus produces this real, previously reported inconsistency');
    assert.ok(limBuy.spellings.includes('Lim_buy'));
    assert.ok(limBuy.spellings.includes('Lim_Buy'));

    assert.equal(candidates.find(candidate => candidate.term === 'WebSocket'), undefined, 'a known term is dropped');
  });
});
