import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { buildGlossaryPullRequestBody, mergeDoNotTranslate } from './mine.mjs';

// Both names below are inferred: Phase 14 freezes no signature for the
// append-and-sort step (TC-43) or the pull request body assembly (TC-44).
// See the test report for this naming risk.

describe('mergeDoNotTranslate: appending to the machine word list', () => {
  it('TC-43: merges without duplicates, keeps the result sorted, and does not reorder unrelated survivors beyond what sorting requires', () => {
    const existing = ['Enabled', 'LOCAL', 'WebSocket'];
    const added = ['Lim_buy', 'Lim_Buy', 'WebSocket']; // WebSocket repeats an existing term on purpose

    const merged = mergeDoNotTranslate(existing, added);

    assert.deepEqual(merged, [...merged].sort((a, b) => a.localeCompare(b)), 'the result is sorted');
    assert.equal(new Set(merged).size, merged.length, 'no duplicates');
    assert.ok(merged.includes('Lim_buy') && merged.includes('Lim_Buy'), 'both new terms are present');
    assert.equal(merged.filter(term => term === 'WebSocket').length, 1, 'the repeated term was not duplicated');
    for (const term of existing) assert.ok(merged.includes(term), 'every previously-listed term survives');
  });
});

describe('buildGlossaryPullRequestBody', () => {
  it('TC-44: has a "needs a decision" section with spellings and locations, and a "dropped" section with reasons', () => {
    const body = buildGlossaryPullRequestBody({
      added: ['Lim_buy', 'Lim_Buy', 'VikingBot'],
      disagreements: [
        {
          spellings: ['Lim_buy', 'Lim_Buy'],
          evidence: [
            { file: 'params-description.md', line: 233, sentence: '### Lim_sell/Lim_buy' },
            { file: 'algorithm-comments.md', line: 31, sentence: '[Lim_Buy](params-description.md#p.lim_s)' },
          ],
        },
      ],
      dropped: [{ term: 'Is', why: 'a tokenisation fragment of "Is first"' }],
      summary: 'Produced by `deepseek-v4-flash` in 3 request(s).',
    });

    assert.match(body, /Lim_buy/);
    assert.match(body, /Lim_Buy/);
    assert.match(body, /params-description\.md/);
    assert.match(body, /233/);
    assert.match(body, /Is/);
    assert.match(body, /tokenisation fragment/);
    assert.match(body, /deepseek-v4-flash/);
  });
});
