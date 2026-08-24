import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { DeepSeek } from './deepseek.mjs';
import { createTranslationProvider } from './index.mjs';

const SCHEMA = { type: 'object', properties: { full_translation: { type: 'string' } } };
const REPLY = { full_translation: 'hi', operations: [] };

function stub(provider, choice, usage) {
  let sent;
  provider.client.chat.completions.create = async body => {
    sent = body;
    return { choices: [choice], usage };
  };
  return () => sent;
}

const good = { finish_reason: 'stop', message: { content: JSON.stringify(REPLY) } };

describe('createTranslationProvider', () => {
  it('defaults to DeepSeek', () => {
    const provider = createTranslationProvider({ TRANSLATION_API_KEY: 'k' });
    assert.equal(provider.constructor.name, 'DeepSeek');
    assert.equal(provider.model, DeepSeek.DEFAULT_MODEL);
    assert.equal(String(provider.client.baseURL), DeepSeek.BASE_URL);
  });

  it('still accepts the older secret name', () => {
    assert.equal(createTranslationProvider({ OPENAI_API_KEY: 'k' }).model, DeepSeek.DEFAULT_MODEL);
  });

  it('takes a model override', () => {
    assert.equal(createTranslationProvider({ TRANSLATION_API_KEY: 'k', TRANSLATION_MODEL: 'other' }).model, 'other');
  });

  it('refuses to run without a key', () => {
    assert.throws(() => createTranslationProvider({}), /TRANSLATION_API_KEY nor OPENAI_API_KEY/);
  });

  it('names the vendors it knows when given an unknown one', () => {
    assert.throws(
      () => createTranslationProvider({ TRANSLATION_API_KEY: 'k', TRANSLATION_PROVIDER: 'nope' }),
      /unknown TRANSLATION_PROVIDER "nope"; expected deepseek/,
    );
  });
});

describe('DeepSeek request', () => {
  it('asks for json and turns thinking off', async () => {
    const provider = createTranslationProvider({ TRANSLATION_API_KEY: 'k' });
    const sent = stub(provider, good);
    await provider.translate({ instructions: 'RULES', payload: { a: 1 }, schema: SCHEMA });

    assert.deepEqual(sent().response_format, { type: 'json_object' });
    assert.deepEqual(sent().thinking, { type: 'disabled' });
    assert.equal(sent().max_tokens, DeepSeek.MAX_TOKENS);
    assert.equal(sent().messages[1].content, '{"a":1}');
  });

  it('spells the schema out, because the API cannot enforce it', async () => {
    const provider = createTranslationProvider({ TRANSLATION_API_KEY: 'k' });
    const sent = stub(provider, good);
    await provider.translate({ instructions: 'RULES', payload: {}, schema: SCHEMA });

    const system = sent().messages[0].content;
    assert.ok(system.startsWith('RULES'), 'the shared rules come first');
    assert.match(system, /\bjson\b/, 'DeepSeek json mode needs the literal word');
    assert.ok(system.includes('"full_translation"'), 'the schema itself is included');
  });
});

describe('DeepSeek reply handling', () => {
  it('returns the decoded reply', async () => {
    const provider = createTranslationProvider({ TRANSLATION_API_KEY: 'k' });
    stub(provider, good);
    assert.deepEqual(await provider.translate({ instructions: 'r', payload: {}, schema: SCHEMA }), REPLY);
  });

  it('refuses a reply that was cut off', async () => {
    const provider = createTranslationProvider({ TRANSLATION_API_KEY: 'k' });
    stub(provider, { finish_reason: 'length', message: { content: '{"full_tr' } });
    await assert.rejects(() => provider.translate({ instructions: 'r', payload: {}, schema: SCHEMA }), /cut off/);
  });

  it('refuses an empty reply', async () => {
    const provider = createTranslationProvider({ TRANSLATION_API_KEY: 'k' });
    stub(provider, { finish_reason: 'stop', message: { content: '' } });
    await assert.rejects(() => provider.translate({ instructions: 'r', payload: {}, schema: SCHEMA }), /empty reply/);
  });
});

describe('usage accounting', () => {
  it('separates cached prompt tokens from fresh ones', async () => {
    const provider = createTranslationProvider({ TRANSLATION_API_KEY: 'k' });
    stub(provider, good, {
      prompt_tokens: 1000,
      prompt_cache_hit_tokens: 800,
      prompt_cache_miss_tokens: 200,
      completion_tokens: 500,
    });
    await provider.translate({ instructions: 'r', payload: {}, schema: SCHEMA });

    assert.deepEqual(provider.usage, { requests: 1, cachedTokens: 800, freshTokens: 200, completionTokens: 500 });

    const { cached, fresh, output } = DeepSeek.PRICE_PER_MILLION;
    assert.equal(provider.costUsd(), Math.round(((800 * cached + 200 * fresh + 500 * output) / 1e6) * 1e4) / 1e4);
  });

  it('treats an unsplit prompt as entirely fresh, so the bill is never understated', async () => {
    const provider = createTranslationProvider({ TRANSLATION_API_KEY: 'k' });
    stub(provider, good, { prompt_tokens: 300, completion_tokens: 100 });
    await provider.translate({ instructions: 'r', payload: {}, schema: SCHEMA });

    assert.equal(provider.usage.freshTokens, 300);
    assert.equal(provider.usage.cachedTokens, 0);
  });

  it('adds up across requests', async () => {
    const provider = createTranslationProvider({ TRANSLATION_API_KEY: 'k' });
    stub(provider, good, { prompt_tokens: 10, completion_tokens: 5 });
    await provider.translate({ instructions: 'r', payload: {}, schema: SCHEMA });
    await provider.translate({ instructions: 'r', payload: {}, schema: SCHEMA });

    assert.equal(provider.usage.requests, 2);
    assert.equal(provider.usage.freshTokens, 20);
  });
});
