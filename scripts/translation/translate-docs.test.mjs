import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, it } from 'node:test';

import {
  assertProtectedSpansPreserved,
  isDocument,
  TRANSLATION_INSTRUCTIONS,
  shouldTranslate,
  targetPath,
  translateDocument,
  translateUnit,
} from './translate-docs.mjs';
import { DeepSeekProvider } from './api/deepseek.mjs';
import { parseSections } from './scope/sections.mjs';
import { spliceUnits } from './scope/splice.mjs';

const ROOT = path.resolve(import.meta.dirname, '..', '..');
const read = file => readFileSync(path.join(ROOT, file), 'utf8');

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

describe('system prompt', () => {
  it('carries the rules and the glossary, in that order', () => {
    const rules = TRANSLATION_INSTRUCTIONS.indexOf('# Role');
    const glossary = TRANSLATION_INSTRUCTIONS.indexOf('# Translation glossary');
    assert.ok(rules !== -1, 'the prompt file is included');
    assert.ok(glossary !== -1, 'the glossary file is included');
    assert.ok(rules < glossary, 'the glossary comes after the rules it refines');
  });

  it('asks for simple technical English', () => {
    assert.ok(TRANSLATION_INSTRUCTIONS.includes('# English style'));
    assert.match(TRANSLATION_INSTRUCTIONS, /second language/, 'says why plain wording matters');
    assert.match(TRANSLATION_INSTRUCTIONS, /You can change the parameter/, 'shows a worked rewrite');
  });

  it('carries the terminology the glossary settles', () => {
    assert.ok(TRANSLATION_INSTRUCTIONS.includes('| стакан | order book |'));
    assert.ok(TRANSLATION_INSTRUCTIONS.includes('`Head of traders`'));
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

describe('--dry-run makes no model call', () => {
  it('TC-13: succeeds with no TRANSLATION_API_KEY at all, proving the model was never asked', () => {
    // Naming a real document with --files --dry-run must never reach
    // createTranslationProvider(): if it did, this would fail on the missing
    // key exactly like the TC-29 case does without --dry-run.
    const env = { ...process.env };
    delete env.TRANSLATION_API_KEY;
    delete env.OPENAI_API_KEY;

    const stdout = execFileSync(
      'node',
      ['scripts/translation/translate-docs.mjs', '--files', 'assets/ru/introduction.md', '--dry-run'],
      { cwd: ROOT, env, encoding: 'utf8' },
    );

    assert.match(stdout, /dry run/i);
    assert.ok(stdout.length > 0);
  });
});

describe('protected content lost in translation, at the unit boundary (TC-17)', () => {
  it('TC-17: a translated unit that changed a component tag is rejected, naming the lost content and the file', () => {
    // A real sentence from assets/ru/interface.md carrying both a component
    // tag and inline code with Latin characters, the exact shape TC-17 names.
    const source = read('assets/ru/interface.md').split('\n')[74 - 1]; // "### Robot logs <Anchor .../>"
    assert.match(source, /<Anchor/);

    const brokenTranslation = source.replace('<Anchor :ids="[\'robot_logs\']" />', '<Anchor :ids="[\'robot-logs\']" />');

    assert.throws(
      () => assertProtectedSpansPreserved(source, brokenTranslation, 'assets/en/interface.md'),
      error => {
        assert.match(error.message, /assets\/en\/interface\.md/, 'names the file');
        assert.match(error.message, /Anchor/, 'names the lost content');
        return true;
      },
    );
  });
});

describe('splicing a real translated unit into a real English document (TC-18)', () => {
  it('TC-18: only the affected section changes; the rest of the file is untouched', () => {
    const enRaw = read('assets/en/interface.md');
    const en = parseSections(enRaw);
    const enLines = enRaw.split('\n');
    const stack = [...en.children];
    let robotLogs;
    while (stack.length) {
      const node = stack.shift();
      if (node.id === 'robot_logs') {
        robotLogs = node;
        break;
      }
      stack.unshift(...node.children);
    }
    assert.ok(robotLogs, 'the real, matched section is found');

    // Stands in for a model reply that only touched the changed sentence.
    const translation = [
      '### Robot logs <Anchor :ids="[\'robot_logs\']" />',
      '',
      'This widget shows one freshly edited sentence, and the rest of this test document is unchanged.',
      '',
    ].join('\n');

    const splicedLines = spliceUnits(enLines, [
      { unit: { kind: 'section', ru: null, en: robotLogs, insertAfter: -1, reason: 'matched' }, translation },
    ]);

    const before = enLines.slice(0, robotLogs.start);
    const after = enLines.slice(robotLogs.end);
    assert.deepEqual(splicedLines.slice(0, before.length), before, 'nothing before the section moved');
    assert.deepEqual(splicedLines.slice(splicedLines.length - after.length), after, 'nothing after the section moved');
  });
});

function stubFetchSequence(replies) {
  const original = globalThis.fetch;
  const requests = [];
  let call = 0;
  globalThis.fetch = async (_url, init) => {
    requests.push(init);
    const reply = replies[Math.min(call, replies.length - 1)];
    call += 1;
    const body = {
      choices: [{ index: 0, message: { role: 'assistant', content: JSON.stringify(reply) }, finish_reason: 'stop' }],
      usage: {},
    };
    return new Response(JSON.stringify(body), { status: 200, headers: { 'content-type': 'application/json' } });
  };
  return {
    requests,
    callCount: () => call,
    restore: () => {
      globalThis.fetch = original;
    },
  };
}

// A real-shaped Russian unit carrying two independently protected spans, so a
// reply can lose either one without touching the other: a component tag
// (<Anchor .../>) and an inline-code span with Latin characters (`Robot logs`),
// the same two categories TC-17 exercises directly.
function robotLogsUnitRequest() {
  return {
    headingPath: 'Интерфейс сайта > Описание виджетов > Robot logs',
    russianText: 'Нажмите <Anchor :ids="[\'robot_logs\']" />, чтобы увидеть виджет `Robot logs`.',
    englishText: 'Click <Anchor :ids="[\'robot_logs\']" /> to see the `Robot logs` widget.',
    diff: '@@ -1 +1 @@\n-Нажмите старый текст.\n+Нажмите <Anchor :ids="[\'robot_logs\']" />, чтобы увидеть виджет `Robot logs`.',
    file: 'assets/en/interface.md',
  };
}

describe('translateUnit: exactly one retry (TC-52, TC-53)', () => {
  it('TC-52: a first reply that lost the tag is retried once; the retry describes what was wrong, and the valid second reply is used', async () => {
    const { requests, callCount, restore } = stubFetchSequence([
      { translation: 'Click to see the `Robot logs` widget.' }, // lost the Anchor tag
      { translation: 'Click <Anchor :ids="[\'robot_logs\']" /> to see the `Robot logs` widget, fixed.' },
    ]);
    try {
      const provider = new DeepSeekProvider({ apiKey: 'k' });
      const translation = await translateUnit({ ...robotLogsUnitRequest(), provider });

      assert.equal(callCount(), 2, 'exactly one retry, not a loop');
      assert.match(translation, /<Anchor/, 'the accepted reply is the second, valid one');

      const secondRequest = JSON.stringify(requests[1]);
      assert.match(secondRequest, /Anchor/i, 'the retry names what the first reply lost');
    } finally {
      restore();
    }
  });

  it('TC-53: two failing replies in a row stop at two requests; both failures are named, not just the last one', async () => {
    const { callCount, restore } = stubFetchSequence([
      { translation: 'Click to see the `Robot logs` widget.' }, // first attempt: lost the Anchor tag
      { translation: 'Click <Anchor :ids="[\'robot_logs\']" /> to see the widget.' }, // second attempt: lost `Robot logs`
    ]);
    try {
      const provider = new DeepSeekProvider({ apiKey: 'k' });
      await assert.rejects(() => translateUnit({ ...robotLogsUnitRequest(), provider }), error => {
        assert.match(error.message, /Anchor/, 'names what the first attempt lost');
        assert.match(error.message, /Robot logs/, 'names what the second attempt lost');
        return true;
      });
      assert.equal(callCount(), 2, 'no third request: two failures are final');
    } finally {
      restore();
    }
  });
});

describe('translateDocument: a unit that still fails fails the whole document, and a sibling document is unaffected (TC-51)', () => {
  it('TC-51', async () => {
    const enRaw = read('assets/en/interface.md');
    const enLines = enRaw.split('\n');
    const en = parseSections(enRaw);
    const byId = id => {
      const search = [...en.children];
      while (search.length) {
        const node = search.shift();
        if (node.id === id) return node;
        search.unshift(...node.children);
      }
      return null;
    };
    const robotLogs = byId('robot_logs');
    const robotsTable = byId('robots_table');
    assert.ok(robotLogs && robotsTable, 'both real sections are present');

    // Document A: one unit, succeeds on the first try.
    const { restore: restoreA } = stubFetchSequence([{ translation: robotLogs.heading.replace(/^/, '### ').concat('\n\nUpdated body.\n') }]);
    let resultA;
    try {
      const provider = new DeepSeekProvider({ apiKey: 'k' });
      resultA = await translateDocument({
        destination: 'assets/en/interface.md',
        lines: enLines,
        units: [
          {
            unit: { kind: 'section', ru: null, en: robotLogs, insertAfter: -1, reason: 'matched' },
            headingPath: 'Website Interface > Widget Overview > Robot logs',
            russianText: 'Русский текст раздела Robot logs.',
            englishText: enLines.slice(robotLogs.start, robotLogs.end).join('\n'),
            diff: '@@ unit A diff @@',
          },
        ],
        provider,
      });
    } finally {
      restoreA();
    }

    assert.equal(resultA.ok, true, 'the one-unit document succeeds');
    assert.notDeepEqual(resultA.lines, enLines, 'the document changed');

    // Document B: two units. The first would succeed; the second fails twice,
    // so nothing — including the first unit's accepted translation — is spliced.
    const { restore: restoreB } = stubFetchSequence([
      { translation: robotLogs.heading.replace(/^/, '### ').concat('\n\nThis one would have been accepted.\n') },
      { translation: 'Reply that drops the required tag, attempt 1.' },
      { translation: 'Reply that drops the required tag, attempt 2.' },
    ]);
    let resultB;
    try {
      const provider = new DeepSeekProvider({ apiKey: 'k' });
      resultB = await translateDocument({
        destination: 'assets/en/interface.md',
        lines: enLines,
        units: [
          {
            unit: { kind: 'section', ru: null, en: robotLogs, insertAfter: -1, reason: 'matched' },
            headingPath: 'Website Interface > Widget Overview > Robot logs',
            russianText: 'Русский текст раздела Robot logs.',
            englishText: enLines.slice(robotLogs.start, robotLogs.end).join('\n'),
            diff: '@@ unit B1 diff @@',
          },
          {
            unit: { kind: 'section', ru: null, en: robotsTable, insertAfter: -1, reason: 'matched' },
            headingPath: 'Website Interface > Widget Overview > Robots',
            russianText: 'Русский текст раздела Robots с тегом <Anchor :ids="[\'robots_table\']" />.',
            englishText: enLines.slice(robotsTable.start, robotsTable.end).join('\n'),
            diff: '@@ unit B2 diff @@',
          },
        ],
        provider,
      });
    } finally {
      restoreB();
    }

    assert.equal(resultB.ok, false, 'the second unit never recovers, so the document is reported as failed');
    assert.match(resultB.reason, /Robots|robots_table/i);

    // Prove isolation on real files, in a temporary copy — never assets/en.
    const tempDir = mkdtempSync(path.join(tmpdir(), 'translate-doc-'));
    const fileA = path.join(tempDir, 'a.md');
    const fileB = path.join(tempDir, 'b.md');
    writeFileSync(fileA, enRaw, 'utf8');
    writeFileSync(fileB, enRaw, 'utf8');

    if (resultA.ok) writeFileSync(fileA, ensureFinalNewlineForTest(resultA.lines.join('\n')), 'utf8');
    if (resultB.ok) writeFileSync(fileB, ensureFinalNewlineForTest(resultB.lines.join('\n')), 'utf8');

    assert.notEqual(readFileSync(fileA, 'utf8'), enRaw, 'document A was written with its accepted translation');
    assert.equal(readFileSync(fileB, 'utf8'), enRaw, 'document B was left byte for byte as it started: not one splice landed');
  });
});

function ensureFinalNewlineForTest(content) {
  return `${content.replace(/\n*$/, '')}\n`;
}
