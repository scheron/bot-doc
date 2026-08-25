import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { OpenAICompatibleProvider } from './openai-compatible.mjs';
import { DeepSeekProvider } from './deepseek.mjs';
import { OpenAIProvider } from './openai.mjs';

// The SDK reads `globalThis.fetch` once, when the client is constructed
// (openai/client.js: `this.fetch = options.fetch ?? Shims.getDefaultFetch()`),
// so the stub has to be in place before `new DeepSeekProvider(...)` runs.
function stubFetch(handler) {
  const original = globalThis.fetch;
  globalThis.fetch = async (url, init) => handler(String(url), init);
  return () => {
    globalThis.fetch = original;
  };
}

function completionResponse({ content, finishReason = 'stop', usage = {} }) {
  const body = {
    choices: [{ index: 0, message: { role: 'assistant', content }, finish_reason: finishReason }],
    usage,
  };
  return new Response(JSON.stringify(body), { status: 200, headers: { 'content-type': 'application/json' } });
}

const SCHEMA = {
  type: 'object',
  properties: { translation: { type: 'string' } },
  required: ['translation'],
  additionalProperties: false,
};
const REPLY = { translation: 'hello' };

describe('DeepSeekProvider.outputBudget', () => {
  it('TC-1: reports a positive character limit that stays under four characters per max token', () => {
    const provider = new DeepSeekProvider({ apiKey: 'k' });
    const budget = provider.outputBudget();
    assert.equal(typeof budget, 'number');
    assert.ok(budget > 0, 'the budget is a positive number of characters');
    assert.ok(budget < DeepSeekProvider.MAX_TOKENS * 4, 'the budget is strictly below MAX_TOKENS * 4');
  });
});

describe('DeepSeekProvider request shape', () => {
  it('TC-22: asks for json_object and spells the schema out in the system prompt', async () => {
    let sent;
    const restore = stubFetch((url, init) => {
      sent = init;
      return completionResponse({ content: JSON.stringify(REPLY), usage: { prompt_tokens: 10, completion_tokens: 5 } });
    });
    try {
      const provider = new DeepSeekProvider({ apiKey: 'k' });
      const reply = await provider.translate({ instructions: 'RULES', payload: { a: 1 }, schema: SCHEMA });
      assert.deepEqual(reply, REPLY);

      const body = JSON.parse(sent.body);
      assert.deepEqual(body.response_format, { type: 'json_object' });
      assert.ok(body.messages[0].content.startsWith('RULES'), 'the shared instructions still come first');
      assert.match(body.messages[0].content, /"translation"/, 'the schema itself is spelled out in the prompt');
    } finally {
      restore();
    }
  });
});

describe('OpenAIProvider request shape', () => {
  it('TC-23: sends the schema in the request body, not the system prompt', async () => {
    let sent;
    const restore = stubFetch((url, init) => {
      sent = init;
      return completionResponse({ content: JSON.stringify(REPLY), usage: {} });
    });
    try {
      const provider = new OpenAIProvider({ apiKey: 'k' });
      await provider.translate({ instructions: 'RULES', payload: { a: 1 }, schema: SCHEMA });

      const body = JSON.parse(sent.body);
      assert.equal(body.response_format.type, 'json_schema');
      assert.deepEqual(body.response_format.json_schema.schema, SCHEMA);
      assert.equal(body.messages[0].content, 'RULES', 'the system prompt carries no schema restatement');
    } finally {
      restore();
    }
  });
});

describe('a reply that was cut off', () => {
  it('TC-24: is refused with a message a human can read', async () => {
    const restore = stubFetch(() => completionResponse({ content: '{"translat', finishReason: 'length', usage: {} }));
    try {
      const provider = new DeepSeekProvider({ apiKey: 'k' });
      await assert.rejects(
        () => provider.translate({ instructions: 'r', payload: {}, schema: SCHEMA }),
        /cut off/i,
        'TC-24: the message says the reply was cut off, not a stack trace',
      );
    } finally {
      restore();
    }
  });
});

describe('usage accounting across requests', () => {
  it('TC-25: separates cached from fresh tokens per request and prices them by the class rates', async () => {
    const usages = [
      { prompt_tokens: 100, prompt_cache_hit_tokens: 0, prompt_cache_miss_tokens: 100, completion_tokens: 20 },
      { prompt_tokens: 100, prompt_cache_hit_tokens: 80, prompt_cache_miss_tokens: 20, completion_tokens: 10 },
    ];
    let call = 0;
    const restore = stubFetch(() => completionResponse({ content: JSON.stringify(REPLY), usage: usages[call++] }));
    try {
      const provider = new DeepSeekProvider({ apiKey: 'k' });
      await provider.translate({ instructions: 'r', payload: {}, schema: SCHEMA });
      await provider.translate({ instructions: 'r', payload: {}, schema: SCHEMA });

      const report = provider.usageReport();
      assert.equal(report.requests, 2);
      assert.equal(report.cachedTokens, 80);
      assert.equal(report.promptTokens - report.cachedTokens, 120, 'fresh tokens across both requests');
      assert.equal(report.completionTokens, 30);

      const { cached, fresh, output } = DeepSeekProvider.PRICE_PER_MILLION;
      const expected = Math.round(((80 * cached + 120 * fresh + 30 * output) / 1_000_000) * 10_000) / 10_000;
      assert.equal(report.costUsd, expected);
    } finally {
      restore();
    }
  });

  it('TC-26: a provider whose class declares no rates reports cost as null and stays silent about price', async () => {
    // A minimal vendor written "by example", per US-4: it overrides only the
    // one thing a JSON-object vendor must (structuredOutput) and declares no
    // PRICE_PER_MILLION, exactly the situation TC-26 is about.
    class UnpricedProvider extends OpenAICompatibleProvider {
      static BASE_URL = 'https://example.test/v1';
      static DEFAULT_MODEL = 'unpriced-model';
      structuredOutput() {
        return { type: 'json_object' };
      }
    }

    const restore = stubFetch(() =>
      completionResponse({ content: JSON.stringify(REPLY), usage: { prompt_tokens: 10, completion_tokens: 5 } }),
    );
    try {
      const provider = new UnpricedProvider({ apiKey: 'k' });
      await provider.translate({ instructions: 'r', payload: {}, schema: SCHEMA });
      const report = provider.usageReport();
      assert.equal(report.costUsd, null);
      assert.doesNotMatch(report.summary, /\$/, 'the summary says nothing about price when it is unknown');
    } finally {
      restore();
    }
  });

  it('TC-30: usageReport composes a ready one-sentence summary of the run', async () => {
    const restore = stubFetch(() =>
      completionResponse({
        content: JSON.stringify(REPLY),
        usage: { prompt_tokens: 100, prompt_cache_hit_tokens: 80, prompt_cache_miss_tokens: 20, completion_tokens: 10 },
      }),
    );
    try {
      const provider = new DeepSeekProvider({ apiKey: 'k' });
      await provider.translate({ instructions: 'r', payload: {}, schema: SCHEMA });
      const { summary, requests, cachedTokens, costUsd } = provider.usageReport();
      assert.equal(requests, 1);
      assert.match(summary, /1 request/);
      assert.ok(summary.includes(String(cachedTokens)), 'the summary carries the cached-token count');
      assert.ok(costUsd !== null);
      assert.ok(summary.includes(costUsd.toFixed(4)), 'the summary carries the price it computed');
    } finally {
      restore();
    }
  });
});
