import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { clashingFiles } from './assert-not-in-review.mjs';
import { BOT_BRANCH_PREFIX, envList, targetPath } from './github.mjs';
import { requestedDocuments, resolveBase } from './plan.mjs';

const held = path => ({ headRefName: `${BOT_BRANCH_PREFIX}1-1`, files: [{ path }] });

describe('resolveBase', () => {
  it('uses the ref a manual run named', () => {
    assert.equal(resolveBase({ EVENT_NAME: 'workflow_dispatch', MANUAL_BASE: 'abc123' }), 'abc123');
  });

  it('falls back for a manual run that named nothing', () => {
    assert.equal(resolveBase({ EVENT_NAME: 'workflow_dispatch' }), 'HEAD^');
  });

  it('uses the commit a push replaced', () => {
    assert.equal(resolveBase({ EVENT_NAME: 'push', PUSH_BEFORE: 'def456' }), 'def456');
  });

  it('falls back on the first push of a branch, where before is all zeros', () => {
    assert.equal(resolveBase({ EVENT_NAME: 'push', PUSH_BEFORE: '0'.repeat(40) }), 'HEAD^');
  });

  it('ignores a manual base when the event is a push', () => {
    assert.equal(resolveBase({ EVENT_NAME: 'push', PUSH_BEFORE: 'def456', MANUAL_BASE: 'abc123' }), 'def456');
  });
});

describe('requestedDocuments', () => {
  it('accepts documents that exist', () => {
    assert.deepEqual(requestedDocuments('assets/ru/comparison.md'), ['assets/ru/comparison.md']);
  });

  it('splits on spaces, commas and newlines', () => {
    assert.deepEqual(requestedDocuments('assets/ru/comparison.md, assets/ru/faq.md\nassets/ru/api.md'), [
      'assets/ru/comparison.md',
      'assets/ru/faq.md',
      'assets/ru/api.md',
    ]);
  });

  it('returns nothing for empty input', () => {
    assert.deepEqual(requestedDocuments(''), []);
    assert.deepEqual(requestedDocuments(undefined), []);
  });

  // The list comes from a workflow input, so these three refusals are the
  // difference between a translation job and an arbitrary file reader.
  it('refuses a path outside the Russian documents', () => {
    assert.throws(() => requestedDocuments('assets/en/api.md'), /not a document under assets\/ru/);
  });

  it('refuses a path that climbs out of the repository', () => {
    assert.throws(() => requestedDocuments('assets/ru/../../etc/passwd'), /not a document under assets\/ru/);
    assert.throws(() => requestedDocuments('../../../etc/passwd'), /not a document under assets\/ru/);
  });

  it('refuses a document that is not there', () => {
    assert.throws(() => requestedDocuments('assets/ru/absent.md'), /does not exist/);
  });

  it('refuses a file that is not Markdown', () => {
    assert.throws(() => requestedDocuments('assets/ru/image.png'), /not a document under assets\/ru/);
  });
});

describe('clashingFiles', () => {
  const wanted = ['assets/en/comparison.md'];

  it('reports a document an open translation PR still holds', () => {
    assert.deepEqual(clashingFiles([held('assets/en/comparison.md')], wanted), wanted);
  });

  it('lets unrelated documents through, so parallel runs stay possible', () => {
    assert.deepEqual(clashingFiles([held('assets/en/api.md')], wanted), []);
  });

  it('names only the held document out of a larger batch', () => {
    const batch = ['assets/en/api.md', 'assets/en/comparison.md', 'assets/en/faq.md'];
    assert.deepEqual(clashingFiles([held('assets/en/comparison.md')], batch), ['assets/en/comparison.md']);
  });

  it('ignores a human pull request touching the same file', () => {
    const human = [{ headRefName: 'feature/rewrite', files: [{ path: 'assets/en/comparison.md' }] }];
    assert.deepEqual(clashingFiles(human, wanted), []);
  });

  it('copes with no pull requests and with one carrying no files', () => {
    assert.deepEqual(clashingFiles([], wanted), []);
    assert.deepEqual(clashingFiles([{ headRefName: `${BOT_BRANCH_PREFIX}9-1` }], wanted), []);
  });
});

describe('helpers', () => {
  it('maps a source path to its target', () => {
    assert.equal(targetPath('assets/ru/api.md'), 'assets/en/api.md');
  });

  it('reads a newline list, dropping blanks and padding', () => {
    process.env.X_TEST_LIST = 'a\n\n  b  \n';
    assert.deepEqual(envList('X_TEST_LIST'), ['a', 'b']);
    delete process.env.X_TEST_LIST;
  });

  it('returns nothing for an unset variable', () => {
    assert.deepEqual(envList('DEFINITELY_NOT_SET_9f2c'), []);
  });
});
