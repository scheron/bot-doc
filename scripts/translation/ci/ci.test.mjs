import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, it } from 'node:test';

import { clashingFiles } from './assert-not-in-review.mjs';
import { BOT_BRANCH_PREFIX, envList, targetPath } from './github.mjs';
import { usageParagraph } from './open-pull-request.mjs';
import { requestedDocuments, resolveBase } from './plan.mjs';

const OPEN_PULL_REQUEST_FILE = path.join(import.meta.dirname, 'open-pull-request.mjs');

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

// TC-31 is not expressed here — it is written by the test-writing run that
// follows this phase, once the entry guard below lets it import this module
// safely. These are local, unlabelled cases proving that guard and the
// summary-based paragraph work, ahead of that.
describe('usageParagraph', () => {
  it('returns nothing when no usage file was recorded', () => {
    delete process.env.TRANSLATION_USAGE_FILE;
    assert.equal(usageParagraph(), '');
  });

  it('builds its paragraph from the summary the provider composed, not from raw fields', () => {
    const dir = mkdtempSync(path.join(tmpdir(), 'usage-report-'));
    const file = path.join(dir, 'usage.json');
    writeFileSync(file, JSON.stringify({
      model: 'gpt-4.1-mini',
      requests: 3,
      promptTokens: 100,
      cachedTokens: 40,
      completionTokens: 20,
      costUsd: 0.0123,
      summary: '3 request(s), 100 prompt tokens (40 cached), 20 completion tokens, $0.0123',
    }), 'utf8');

    process.env.TRANSLATION_USAGE_FILE = file;
    try {
      const paragraph = usageParagraph();
      assert.match(paragraph, /gpt-4\.1-mini/, 'names the model');
      assert.ok(
        paragraph.includes('3 request(s), 100 prompt tokens (40 cached), 20 completion tokens, $0.0123'),
        'carries the summary verbatim',
      );
    } finally {
      delete process.env.TRANSLATION_USAGE_FILE;
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('says nothing about price when the summary itself says nothing about price', () => {
    const dir = mkdtempSync(path.join(tmpdir(), 'usage-report-'));
    const file = path.join(dir, 'usage.json');
    writeFileSync(file, JSON.stringify({
      model: 'unpriced-model',
      requests: 1,
      promptTokens: 10,
      cachedTokens: 0,
      completionTokens: 5,
      costUsd: null,
      summary: '1 request(s), 10 prompt tokens (0 cached), 5 completion tokens',
    }), 'utf8');

    process.env.TRANSLATION_USAGE_FILE = file;
    try {
      assert.doesNotMatch(usageParagraph(), /\$/, 'no price appears when the summary carries none');
    } finally {
      delete process.env.TRANSLATION_USAGE_FILE;
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe('TC-31', () => {
  it('the pull request paragraph about spend is drawn from the recorded summary, and open-pull-request.mjs checks costUsd for null nowhere', () => {
    const dir = mkdtempSync(path.join(tmpdir(), 'tc31-'));
    const file = path.join(dir, 'usage.json');
    // Shaped like the file translate-docs.mjs's reportUsage() actually writes:
    // an unpriced vendor (costUsd: null) whose summary already decided, on its
    // own, to say nothing about price.
    writeFileSync(
      file,
      JSON.stringify({
        model: 'unpriced-vendor-model',
        requests: 4,
        promptTokens: 500,
        cachedTokens: 120,
        completionTokens: 90,
        costUsd: null,
        summary: '4 request(s), 500 prompt tokens (120 cached), 90 completion tokens',
      }),
      'utf8',
    );

    process.env.TRANSLATION_USAGE_FILE = file;
    try {
      const paragraph = usageParagraph();
      assert.ok(
        paragraph.includes('4 request(s), 500 prompt tokens (120 cached), 90 completion tokens'),
        'the paragraph is drawn from summary, verbatim',
      );
    } finally {
      delete process.env.TRANSLATION_USAGE_FILE;
      rmSync(dir, { recursive: true, force: true });
    }

    // The case's second half is a claim about the whole file, not only this
    // function: nothing in it inspects costUsd, so there is nothing that could
    // special-case null. Absence of the field name is a stronger, simpler
    // guarantee than "no comparison with null" would be, and this file has
    // none: grep confirms zero occurrences today.
    const source = readFileSync(OPEN_PULL_REQUEST_FILE, 'utf8');
    assert.doesNotMatch(source, /costUsd/, 'open-pull-request.mjs never mentions costUsd, let alone checks it for null');
  });
});

// buildPullRequestPlan is inferred: Phase 14's own words are "open-pull-request.mjs
// stops holding TARGET_ROOT, the title and the translation text itself: they
// become inputs", but no name is frozen. Named the same way as translateUnit
// and translateDocument were: smallest reasonable name from the phase's own
// prose. See the test report for the signature to freeze.
//
// This is a *pure* builder: it must not touch git or gh, because calling the
// real, executing function from a test would run real git/gh side effects
// against this repository — exactly the hazard that kept TC-31/TC-45 out of
// round 1. Loaded with a dynamic import so a not-yet-existing export fails
// only this one test, not the whole file (open-pull-request.mjs is otherwise
// already safely, statically imported above for TC-31).
describe('TC-45', () => {
  it('a generalized pull request plan gives each caller its own title, body and paths — none hardcoded inside', async () => {
    const { buildPullRequestPlan } = await import('./open-pull-request.mjs');

    process.env.RUN_ID = '4242';
    process.env.RUN_ATTEMPT = '1';
    try {
      const translatePlan = buildPullRequestPlan({
        paths: ['assets/en'],
        title: 'docs(en): translate Russian documentation updates',
        body: 'translation body',
      });
      const glossaryPlan = buildPullRequestPlan({
        paths: ['.github/prompts/do-not-translate.md'],
        title: 'docs: extend the machine glossary',
        body: 'glossary body',
      });

      assert.equal(translatePlan.title, 'docs(en): translate Russian documentation updates');
      assert.equal(glossaryPlan.title, 'docs: extend the machine glossary');
      assert.notEqual(translatePlan.title, glossaryPlan.title, "neither caller's title is hardcoded for the other");

      assert.deepEqual(translatePlan.paths, ['assets/en']);
      assert.deepEqual(glossaryPlan.paths, ['.github/prompts/do-not-translate.md']);
      assert.notDeepEqual(translatePlan.paths, glossaryPlan.paths, "neither caller's paths are hardcoded for the other");

      assert.equal(translatePlan.body, 'translation body');
      assert.equal(glossaryPlan.body, 'glossary body');

      assert.match(translatePlan.branch, new RegExp(`^${BOT_BRANCH_PREFIX}4242-1$`));
    } finally {
      delete process.env.RUN_ID;
      delete process.env.RUN_ATTEMPT;
    }
  });
});
