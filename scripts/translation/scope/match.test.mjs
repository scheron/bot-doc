import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, it } from 'node:test';

import { matchChildren } from './match.mjs';
import { parseSections } from './sections.mjs';

const ROOT = path.resolve(import.meta.dirname, '..', '..', '..');
const read = file => readFileSync(path.join(ROOT, file), 'utf8');

// Minimal Section-shaped test doubles, built directly per the frozen typedef,
// carrying real vocabulary lifted from the corpus (exchange field names that
// recur verbatim across assets/ru/creating-connection.md). matchChildren is a
// pure function over already-parsed Section arrays, so constructing its input
// directly is the honest way to exercise a specific structural shape that was
// not found occurring naturally within the corpus in the time available.
let nextLine = 0;
function leaf(level, text, id = null) {
  const start = nextLine++;
  nextLine += 1;
  return { level, heading: text, text, id, start, end: start + 2, children: [] };
}

describe('matchChildren: real corpus pairs', () => {
  it('TC-5: a heading that matches verbatim, exactly once on each side, is paired', () => {
    const ru = parseSections(read('assets/ru/creating-connection.md'));
    const en = parseSections(read('assets/en/creating-connection.md'));
    const ruExchanges = ru.children[0].children;
    const enExchanges = en.children[0].children;

    const map = matchChildren(ruExchanges, enExchanges);

    const krakenRu = ruExchanges.find(section => section.text === 'KRAKEN');
    const krakenEn = enExchanges.find(section => section.text === 'KRAKEN');
    assert.ok(krakenRu && krakenEn, 'both real corpus documents carry this exchange');
    assert.equal(map.get(krakenRu), krakenEn);
  });

  it('TC-6: a heading whose text was translated is paired by its shared id', () => {
    const ru = parseSections(read('assets/ru/params-description.md'));
    const en = parseSections(read('assets/en/params-description.md'));
    const map = matchChildren(ru.children[0].children, en.children[0].children);

    const terminologyRu = ru.children[0].children.find(section => section.id === 'pp');
    const terminologyEn = en.children[0].children.find(section => section.id === 'pp');
    assert.equal(terminologyRu.text, 'Используемые понятия', 'the Russian text differs from the English one');
    assert.equal(terminologyEn.text, 'Terminology');

    assert.equal(map.get(terminologyRu), terminologyEn);
  });
});

describe('matchChildren: ambiguity is left unresolved, not guessed', () => {
  it('TC-7: an uneven span between two matched neighbours leaves both sides unmatched', () => {
    const beforeRu = leaf(2, 'Name');
    const beforeEn = leaf(2, 'Name');
    const afterRu = leaf(2, 'Bind IP');
    const afterEn = leaf(2, 'Bind IP');
    const ruOnlyA = leaf(2, 'Conn type');
    const ruOnlyB = leaf(2, 'Passphrase');
    const enOnly = leaf(2, 'Key secret');

    const ruChildren = [beforeRu, ruOnlyA, ruOnlyB, afterRu];
    const enChildren = [beforeEn, enOnly, afterEn];

    const map = matchChildren(ruChildren, enChildren);

    assert.equal(map.get(beforeRu), beforeEn, 'the matched neighbour before the span is still paired, by text');
    assert.equal(map.get(afterRu), afterEn, 'the matched neighbour after the span is still paired, by text');
    assert.equal(map.get(ruOnlyA), null, 'two Russian children against one English one: no guess');
    assert.equal(map.get(ruOnlyB), null);
  });

  it('TC-8: one Russian heading matching two identical English ones is left unmatched', () => {
    const ruChild = leaf(3, 'Key API');
    const enChildA = leaf(3, 'Key API');
    const enChildB = leaf(3, 'Key API');

    const map = matchChildren([ruChild], [enChildA, enChildB]);

    assert.equal(map.get(ruChild), null);
  });
});
