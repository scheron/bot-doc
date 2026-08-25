import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { describe, it } from 'node:test';

import { DeepSeekProvider } from './deepseek.mjs';
import { OpenAIProvider } from './openai.mjs';
import { createGlossaryProvider, createTranslationProvider } from './index.mjs';

const ROOT = path.resolve(import.meta.dirname, '..', '..', '..');

describe('provider roles', () => {
  it('TC-27: translation and classification pick their vendor and model independently', () => {
    const env = {
      TRANSLATION_API_KEY: 'k',
      TRANSLATION_PROVIDER: 'openai',
      TRANSLATION_MODEL: 'gpt-translate',
      GLOSSARY_PROVIDER: 'deepseek',
      GLOSSARY_MODEL: 'deepseek-glossary',
    };

    const translation = createTranslationProvider(env);
    const glossary = createGlossaryProvider(env);

    assert.ok(translation instanceof OpenAIProvider, 'the translation role honours TRANSLATION_PROVIDER');
    assert.ok(glossary instanceof DeepSeekProvider, 'the glossary role honours GLOSSARY_PROVIDER, a different class');
    assert.equal(translation.model, 'gpt-translate');
    assert.equal(glossary.model, 'deepseek-glossary');
  });

  it('TC-28: classification falls back to the translation role\'s values, not a hardcoded vendor', () => {
    const env = { TRANSLATION_API_KEY: 'k', TRANSLATION_PROVIDER: 'openai', TRANSLATION_MODEL: 'gpt-shared' };

    const glossary = createGlossaryProvider(env);

    assert.ok(glossary instanceof OpenAIProvider, 'no GLOSSARY_PROVIDER was set, so it fell back to TRANSLATION_PROVIDER');
    assert.equal(glossary.model, 'gpt-shared', 'no GLOSSARY_MODEL was set, so it fell back to TRANSLATION_MODEL');
  });
});

describe('missing credentials', () => {
  it('TC-29: a run without TRANSLATION_API_KEY or OPENAI_API_KEY fails with one line naming only the new variable', () => {
    const env = { ...process.env, PATH: process.env.PATH };
    delete env.TRANSLATION_API_KEY;
    delete env.OPENAI_API_KEY;

    let failed = false;
    let stderr = '';
    try {
      // A real, existing document with an English counterpart already: the run
      // fails on the missing key before it ever reaches the network, so nothing
      // is written and no request is made.
      execFileSync('node', ['scripts/translation/translate-docs.mjs', '--files', 'assets/ru/introduction.md'], {
        cwd: ROOT,
        env,
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'pipe'],
      });
    } catch (error) {
      failed = true;
      stderr = String(error.stderr ?? '');
      assert.notEqual(error.status, 0);
    }

    assert.ok(failed, 'the process must exit with a non-zero code');
    assert.match(stderr, /TRANSLATION_API_KEY/);
    assert.doesNotMatch(stderr, /OPENAI_API_KEY/);
    assert.equal(stderr.trim().split('\n').length, 1, 'exactly one line names the problem');
  });
});
