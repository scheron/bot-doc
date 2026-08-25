import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, it } from 'node:test';

import { TRANSLATION_INSTRUCTIONS } from './translate-docs.mjs';
import { readGlossary } from './validate-translations.mjs';

const REAL = path.resolve(import.meta.dirname, '..', '..', '.github', 'prompts', 'glossary.md');
const ROOT = path.resolve(import.meta.dirname, '..', '..');
const PROMPTS = path.join(ROOT, '.github', 'prompts');

describe('readGlossary', () => {
  it('reads terminology.md and do-not-translate.md, the files that ship with the repository', () => {
    const { banned, verbatim } = readGlossary();
    // The shipped Do not use table has only its header and divider row, no
    // rules yet — both must be skipped rather than read as data, so a
    // mistranslation found later is the first entry, not the second.
    assert.deepEqual(banned, []);
    assert.ok(verbatim.length > 5, 'the do-not-translate list should not be empty');
    assert.ok(verbatim.includes('Robot logs'));
  });
});

describe('the split glossary (TC-32, TC-33)', () => {
  it('TC-32: translation instructions carry terminology.md and do-not-translate.md in full, in order, and glossary.md is gone', () => {
    const terminology = readFileSync(path.join(PROMPTS, 'terminology.md'), 'utf8').trim();
    const doNotTranslate = readFileSync(path.join(PROMPTS, 'do-not-translate.md'), 'utf8').trim();

    const rulesIndex = TRANSLATION_INSTRUCTIONS.indexOf('# Role');
    const terminologyIndex = TRANSLATION_INSTRUCTIONS.indexOf(terminology);
    const doNotTranslateIndex = TRANSLATION_INSTRUCTIONS.indexOf(doNotTranslate);

    assert.ok(rulesIndex !== -1, 'the rules file is included');
    assert.ok(terminologyIndex !== -1, 'terminology.md is included whole, verbatim');
    assert.ok(doNotTranslateIndex !== -1, 'do-not-translate.md is included whole, verbatim');
    assert.ok(rulesIndex < terminologyIndex, 'rules come before terminology');
    assert.ok(terminologyIndex < doNotTranslateIndex, 'terminology comes before the do-not-translate list');

    assert.ok(!existsSync(REAL), 'glossary.md was removed, not merely left unread');
  });

  it('TC-33: banned wording is read from terminology.md and verbatim terms from do-not-translate.md', () => {
    const terminologyText = readFileSync(path.join(PROMPTS, 'terminology.md'), 'utf8');
    const doNotTranslateText = readFileSync(path.join(PROMPTS, 'do-not-translate.md'), 'utf8');

    const { banned, verbatim } = readGlossary();
    assert.ok(banned.length >= 0 && Array.isArray(banned));
    assert.ok(verbatim.length > 5, 'the real do-not-translate list is not empty');

    for (const rule of banned) {
      assert.ok(terminologyText.includes(rule.wrong), `banned wording "${rule.wrong}" is sourced from terminology.md`);
    }
    for (const term of verbatim) {
      assert.ok(doNotTranslateText.includes(term), `verbatim term "${term}" is sourced from do-not-translate.md`);
    }
  });
});

describe('yarn validate-translations on the real corpus, after the split (TC-34)', () => {
  it('TC-34: exits zero with exactly the baseline set of nine warnings, no more, no fewer', () => {
    const result = spawnSync('node', ['scripts/translation/validate-translations.mjs'], {
      cwd: ROOT,
      encoding: 'utf8',
    });

    assert.equal(result.status, 0);

    const warnings = result.stderr
      .split('\n')
      .filter(line => line.startsWith('::warning::'))
      .sort();

    // Captured from the measured baseline (yarn test baseline run, before this
    // plan's phases): 9 warnings, listed here so a regression is visible by
    // diff rather than only by count.
    const baseline = [
      '::warning::assets/en/api.md: 112 headings against 113 in Russian, so the two have drifted apart',
      '::warning::assets/en/c-api.md: interface wording may have been translated: Robot logs, shared memory',
      '::warning::assets/en/c-api.md: 37 headings against 42 in Russian, so the two have drifted apart',
      '::warning::assets/en/change-history.md: 36 headings against 37 in Russian, so the two have drifted apart',
      '::warning::assets/en/creating-connection.md: 327 headings against 340 in Russian, so the two have drifted apart',
      '::warning::assets/en/faq.md: interface wording may have been translated: Head of traders',
      '::warning::assets/en/getting-started.md: interface wording may have been translated: Workspaces',
      '::warning::assets/en/params-description.md: 125 headings against 127 in Russian, so the two have drifted apart',
      '::warning::assets/en/stable-work.md: interface wording may have been translated: Robot logs',
    ].sort();

    assert.deepEqual(warnings, baseline);
  });
});
