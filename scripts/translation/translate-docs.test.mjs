import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  TranslationError,
  applyOperations,
  assertProtectedSpansPreserved,
  isDocument,
  shouldTranslate,
  targetPath,
} from './translate-docs.mjs';

describe('applyOperations', () => {
  it('applies a replacement', () => {
    assert.equal(applyOperations('one two three', [{ find: 'two', replace: 'TWO' }], 'f.md'), 'one TWO three');
  });

  it('applies several in order', () => {
    const result = applyOperations('a b c', [
      { find: 'a', replace: 'X' },
      { find: 'c', replace: 'Z' },
    ], 'f.md');
    assert.equal(result, 'X b Z');
  });

  // The pipeline's whole safety model rests on these three refusals: a patch
  // that cannot be placed exactly must stop the run, never guess a position.
  it('refuses an empty find', () => {
    assert.throws(() => applyOperations('text', [{ find: '', replace: 'x' }], 'f.md'), TranslationError);
  });

  it('refuses a find that is not there', () => {
    assert.throws(
      () => applyOperations('text', [{ find: 'absent', replace: 'x' }], 'f.md'),
      /cannot find its exact English text/,
    );
  });

  it('refuses a find that matches twice', () => {
    assert.throws(
      () => applyOperations('same and same', [{ find: 'same', replace: 'x' }], 'f.md'),
      /matches more than once/,
    );
  });

  it('counts occurrences after earlier operations ran', () => {
    assert.throws(
      () => applyOperations('a b', [{ find: 'b', replace: 'a' }, { find: 'a', replace: 'z' }], 'f.md'),
      /matches more than once/,
    );
  });
});

describe('assertProtectedSpansPreserved', () => {
  const ok = (source, translation) => assertProtectedSpansPreserved(source, translation, 'f.md');

  it('passes when inline code survives', () => {
    ok('нажмите `Robot logs` в виджете', 'click `Robot logs` in the widget');
  });

  it('fails when an interface label was translated', () => {
    assert.throws(() => ok('нажмите `Robot logs`', 'click `Логи робота`'), /`Robot logs`/);
  });

  it('fails when a code span was split', () => {
    // The real defect found in getting-started.md: the button name lost a word
    // because the closing backtick moved.
    assert.throws(
      () => ok('кнопку `Reload security list from exchanges`', 'the `Reload security list` from exchanges'),
      /Reload security list from exchanges/,
    );
  });

  it('allows Cyrillic code spans to be translated', () => {
    // An exchange error message is prose that happens to wear code formatting.
    ok('ошибка `Биржа перегружена`', 'the error `Exchange is overloaded`');
  });

  it('fails when a component tag is dropped', () => {
    assert.throws(() => ok('текст <Anchor :ids="[\'x\']" /> дальше', 'text and more'), /component tag .*Anchor/);
  });

  it('passes when a component tag survives', () => {
    ok('текст <Anchor :ids="[\'x\']" />', 'text <Anchor :ids="[\'x\']" />');
  });

  it('names every missing span at once', () => {
    assert.throws(() => ok('`One` and `Two`', 'nothing'), error => {
      assert.ok(error.message.includes('`One`') && error.message.includes('`Two`'));
      return true;
    });
  });
});

describe('what gets translated', () => {
  it('translates a named document even when English already exists', () => {
    assert.ok(shouldTranslate({ named: true, force: false, alreadyTranslated: true }));
  });

  it('translates a named document that has no English yet', () => {
    assert.ok(shouldTranslate({ named: true, force: false, alreadyTranslated: false }));
  });

  it('leaves a settled document alone during a sweep', () => {
    assert.ok(!shouldTranslate({ named: false, force: false, alreadyTranslated: true }));
  });

  it('fills in a missing document during a sweep', () => {
    assert.ok(shouldTranslate({ named: false, force: false, alreadyTranslated: false }));
  });

  it('lets a sweep redo everything when forced', () => {
    assert.ok(shouldTranslate({ named: false, force: true, alreadyTranslated: true }));
  });
});

describe('path helpers', () => {
  it('maps a Russian document to its English counterpart', () => {
    assert.equal(targetPath('assets/ru/api.md'), 'assets/en/api.md');
    assert.equal(targetPath('assets/ru/nested/api.md'), 'assets/en/nested/api.md');
  });

  it('leaves an unrelated path alone', () => {
    assert.equal(targetPath('assets/ruble/api.md'), 'assets/ruble/api.md');
  });

  it('recognises documents', () => {
    assert.ok(isDocument('assets/ru/api.md'));
    assert.ok(isDocument('assets/ru/api.MDX'));
    assert.ok(!isDocument('assets/ru/image.png'));
    assert.ok(!isDocument('assets/en/api.md'));
    assert.ok(!isDocument('assets/ru'));
  });
});
