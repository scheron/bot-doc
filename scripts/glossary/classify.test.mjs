import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { DeepSeekProvider } from '../translation/api/deepseek.mjs';
import { classifyCandidates, summarizeVerdicts } from './classify.mjs';

function stubFetch(handler) {
  const original = globalThis.fetch;
  globalThis.fetch = async (url, init) => handler(String(url), init);
  return () => {
    globalThis.fetch = original;
  };
}

function completionResponse(content) {
  const body = { choices: [{ index: 0, message: { role: 'assistant', content }, finish_reason: 'stop' }], usage: {} };
  return new Response(JSON.stringify(body), { status: 200, headers: { 'content-type': 'application/json' } });
}

function candidate(term, extra = {}) {
  return { term, count: 3, files: ['params-description.md'], evidence: [{ file: 'params-description.md', line: 1, sentence: term }], spellings: [term], ...extra };
}

describe('classifyCandidates: one verdict per candidate, in order', () => {
  it('TC-39: each candidate gets exactly one of the five verdicts, in the order given', async () => {
    const candidates = [candidate('Lim_buy'), candidate('lot_size'), candidate('Workspaces'), candidate('foo'), candidate('bar')];
    const kinds = ['identifier', 'ui-label', 'product-name', 'noise', 'should-be-translated'];
    const restore = stubFetch(() =>
      completionResponse(
        JSON.stringify({
          verdicts: candidates.map((c, i) => ({ term: c.term, kind: kinds[i], why: `because ${kinds[i]}` })),
        }),
      ),
    );
    try {
      const provider = new DeepSeekProvider({ apiKey: 'k' });
      const verdicts = await classifyCandidates({ candidates, provider });
      assert.equal(verdicts.length, candidates.length);
      verdicts.forEach((verdict, i) => {
        assert.equal(verdict.candidate, candidates[i]);
        assert.equal(verdict.kind, kinds[i]);
        assert.ok(kinds.includes(verdict.kind));
      });
    } finally {
      restore();
    }
  });
});

describe('classifyCandidates: an incomplete batch reply', () => {
  it('TC-40: a reply missing some candidates is an error naming the missing ones, nothing is invented', async () => {
    const candidates = [candidate('Alpha'), candidate('Beta'), candidate('Gamma')];
    const restore = stubFetch(() =>
      completionResponse(JSON.stringify({ verdicts: [{ term: 'Alpha', kind: 'identifier', why: 'ok' }] })),
    );
    try {
      const provider = new DeepSeekProvider({ apiKey: 'k' });
      await assert.rejects(() => classifyCandidates({ candidates, provider }), error => {
        assert.match(error.message, /Beta/);
        assert.match(error.message, /Gamma/);
        return true;
      });
    } finally {
      restore();
    }
  });
});

// summarizeVerdicts is inferred: the plan freezes classifyCandidates' shape but
// not a name for the assembly step TC-41/TC-42 describe ("собирают итог"). See
// the test report for this naming risk.
describe('summarizeVerdicts: assembling the outcome', () => {
  it('TC-41: only identifier, ui-label and product-name reach the glossary; noise is dropped; should-be-translated is set aside', () => {
    const verdicts = [
      { candidate: candidate('Lim_buy'), kind: 'identifier', why: 'a parameter name' },
      { candidate: candidate('Workspaces'), kind: 'ui-label', why: 'an interface label' },
      { candidate: candidate('VikingBot'), kind: 'product-name', why: 'a product name' },
      { candidate: candidate('Is'), kind: 'noise', why: 'a tokenisation fragment' },
      { candidate: candidate('Trading'), kind: 'should-be-translated', why: 'ordinary English prose' },
    ];

    const summary = summarizeVerdicts(verdicts);

    assert.deepEqual(summary.glossary.sort(), ['Lim_buy', 'VikingBot', 'Workspaces'].sort());
    assert.equal(summary.dropped.length, 1);
    assert.equal(summary.dropped[0].term, 'Is');
    assert.match(summary.dropped[0].why, /tokenisation/);
    assert.deepEqual(summary.shouldBeTranslated, ['Trading']);
    assert.equal(summary.glossary.includes('Is'), false);
    assert.equal(summary.glossary.includes('Trading'), false);
  });

  it('TC-42: two case-only variants both land in the glossary and both appear in the disagreement list', () => {
    const verdicts = [
      { candidate: candidate('lim_buy'), kind: 'identifier', why: 'a parameter name' },
      { candidate: candidate('Lim_Buy'), kind: 'identifier', why: 'a parameter name' },
    ];

    const summary = summarizeVerdicts(verdicts);

    assert.ok(summary.glossary.includes('lim_buy'));
    assert.ok(summary.glossary.includes('Lim_Buy'));

    const flaggedTerms = summary.disagreements.flatMap(group => group.spellings);
    assert.ok(flaggedTerms.includes('lim_buy'));
    assert.ok(flaggedTerms.includes('Lim_Buy'));
  });
});
