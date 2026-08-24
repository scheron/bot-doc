import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, it } from 'node:test';

import { readGlossary } from './validate-translations.mjs';

const REAL = path.resolve(import.meta.dirname, '..', '..', '.github', 'prompts', 'glossary.md');

function glossaryFile(contents) {
  const file = path.join(mkdtempSync(path.join(tmpdir(), 'glossary-')), 'glossary.md');
  writeFileSync(file, contents, 'utf8');
  return file;
}

describe('readGlossary', () => {
  it('reads the file that ships with the repository', () => {
    const { banned, verbatim } = readGlossary(REAL);
    // The shipped Do not use table is empty on purpose: a rule is added only
    // after a real mistranslation is found. Enforcement must still be wired up.
    assert.ok(Array.isArray(banned));
    assert.ok(verbatim.length > 5, 'the keep-verbatim list should not be empty');
    assert.ok(verbatim.includes('Robot logs'));
  });

  it('picks up a banned wording once someone adds one', () => {
    const file = glossaryFile([
      '## Do not use',
      '',
      '| Wrong | Use instead |',
      '| --- | --- |',
      '| glass | order book |',
      '| bid book | order book |',
      '',
      '## Keep verbatim',
      '',
      '`Buy`, `Sell`',
    ].join('\n'));

    const { banned, verbatim } = readGlossary(file);
    assert.deepEqual(banned, [
      { wrong: 'glass', right: 'order book' },
      { wrong: 'bid book', right: 'order book' },
    ]);
    assert.deepEqual(verbatim, ['Buy', 'Sell']);
  });

  it('does not mistake the header or the divider for a rule', () => {
    const file = glossaryFile('## Do not use\n\n| Wrong | Use instead |\n| --- | --- |\n\n## Keep verbatim\n');
    assert.deepEqual(readGlossary(file).banned, []);
  });

  it('stops at the next heading, so other tables are not swept in', () => {
    const file = glossaryFile([
      '## Do not use',
      '',
      '| Wrong | Use instead |',
      '| --- | --- |',
      '| glass | order book |',
      '',
      '## Terms',
      '',
      '| Russian | English | Note |',
      '| --- | --- | --- |',
      '| портфель | portfolio | |',
      '',
      '## Keep verbatim',
      '',
      '`Buy`',
    ].join('\n'));

    assert.deepEqual(readGlossary(file).banned, [{ wrong: 'glass', right: 'order book' }]);
    assert.deepEqual(readGlossary(file).verbatim, ['Buy']);
  });

  it('returns empty rules when the file is missing, rather than throwing', () => {
    assert.deepEqual(readGlossary('/definitely/not/here.md'), { banned: [], verbatim: [] });
  });
});
