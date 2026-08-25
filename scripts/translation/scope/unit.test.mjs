import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, it } from 'node:test';

import { parseSections } from './sections.mjs';
import { resolveUnits } from './unit.mjs';

const ROOT = path.resolve(import.meta.dirname, '..', '..', '..');
const read = file => readFileSync(path.join(ROOT, file), 'utf8');

describe('resolveUnits: no English document at all', () => {
  it('TC-9: resolves to exactly one unit that covers the whole file', () => {
    // change-history.md is a real corpus document; passing en: null exercises
    // resolveUnits' own documented "no English document" input, the situation
    // that arises the first time a Russian document is added.
    const raw = read('assets/ru/change-history.md');
    const ru = parseSections(raw);
    const lastLine = raw.split('\n').length - 1;

    const units = resolveUnits({ ru, en: null, changedLines: [lastLine] });

    assert.equal(units.length, 1);
    assert.equal(units[0].kind, 'file');
    assert.equal(units[0].en, null);
  });
});

describe('resolveUnits: real divergence in creating-connection.md', () => {
  it('TC-10: a change inside tc.BITGETSPOT.name resolves to the whole missing BITGETSPOT exchange, with an insertion point after its matched predecessor J2T', () => {
    const ruRaw = read('assets/ru/creating-connection.md');
    const enRaw = read('assets/en/creating-connection.md');
    const ru = parseSections(ruRaw);
    const en = parseSections(enRaw);
    const ruLines = ruRaw.split('\n');

    const nameHeadingLine = ruLines.findIndex(line => line.includes("'tc.BITGETSPOT.name'"));
    assert.ok(nameHeadingLine > -1, 'the real corpus still has this id; see the test report if this changed');
    const changedLine = nameHeadingLine + 1; // inside the body of the "Name" field

    const units = resolveUnits({ ru, en, changedLines: [changedLine] });

    assert.equal(units.length, 1);
    const unit = units[0];
    assert.equal(unit.kind, 'section');
    assert.equal(unit.ru.text, 'BITGETSPOT');
    assert.equal(unit.en, null, 'the whole exchange is missing on the English side');

    const j2t = en.children[0].children.find(section => section.text === 'J2T');
    assert.ok(j2t, 'J2T is the real, matched predecessor of the missing exchanges');
    assert.equal(unit.insertAfter, j2t.end - 1);
    assert.match(unit.reason, /BITGETSPOT/);
  });

  it('TC-11: a change inside a section matched at every level resolves to that leaf section, not its parent', () => {
    // assets/ru/interface.md, "Robot logs": matched at h1, at its h2 parent (by
    // position) and at h3 (by text), and it has no children of its own.
    const ruRaw = read('assets/ru/interface.md');
    const enRaw = read('assets/en/interface.md');
    const ru = parseSections(ruRaw);
    const en = parseSections(enRaw);
    const ruLines = ruRaw.split('\n');

    const headingLine = ruLines.findIndex(line => line.includes("'robot_logs']"));
    const changedLine = headingLine + 2; // a body line inside "Robot logs"

    const units = resolveUnits({ ru, en, changedLines: [changedLine] });

    assert.equal(units.length, 1);
    assert.equal(units[0].kind, 'section');
    assert.equal(units[0].ru.text, 'Robot logs');
    assert.equal(units[0].en?.text, 'Robot logs', 'it is matched, so it carries its English counterpart');
  });

  it('TC-12: two changes, one nested inside the other\'s section, collapse to a single outer unit', () => {
    const ruRaw = read('assets/ru/interface.md');
    const enRaw = read('assets/en/interface.md');
    const ru = parseSections(ruRaw);
    const en = parseSections(enRaw);
    const ruLines = ruRaw.split('\n');

    const overview = ru.children[0].children.find(section => section.children.some(child => child.id === 'robot_logs'));
    const robotLogs = overview.children.find(child => child.id === 'robot_logs');

    // A line that belongs directly to the h2 "Описание виджетов" body (before
    // its first h3 child starts), plus a line inside the nested "Robot logs" h3.
    const outerLine = overview.start + 1;
    const innerLine = robotLogs.start + 2;
    assert.ok(outerLine < robotLogs.start, 'the outer change really sits before any h3 child');

    const units = resolveUnits({ ru, en, changedLines: [outerLine, innerLine] });

    assert.equal(units.length, 1, 'the nested unit was collapsed into the outer one');
    assert.equal(units[0].ru.text, overview.text);
    assert.equal(units[0].ru.start, overview.start);
    assert.equal(units[0].ru.end, overview.end);
  });
});

describe('resolveUnits: no preceding matched sibling', () => {
  it('TC-55: a new section with no matched sibling before it bubbles up to its parent', () => {
    // Constructed per the frozen Section/Document shape: match.mjs and
    // sections.mjs are exercised on real content elsewhere (TC-5-8, TC-2-4);
    // this specific structural edge — an unmatched section that is the very
    // first child of its parent, so no preceding sibling exists to anchor an
    // insertion point — was not found occurring in the real 14-pair corpus
    // within the time available, so it is built directly against the
    // documented input shape instead.
    const newChild = { level: 2, heading: 'NEWEX', text: 'NEWEX', id: null, start: 10, end: 14, children: [] };
    const ruParent = {
      level: 1,
      heading: 'Root',
      text: 'Root',
      id: null,
      start: 0,
      end: 20,
      children: [newChild],
    };
    const enParent = { level: 1, heading: 'Root', text: 'Root', id: null, start: 0, end: 8, children: [] };

    const ru = { lines: new Array(20).fill(''), children: [ruParent] };
    const en = { lines: new Array(8).fill(''), children: [enParent] };

    const units = resolveUnits({ ru, en, changedLines: [12] });

    assert.equal(units.length, 1);
    assert.equal(units[0].ru, ruParent, 'the unit is the parent, not the new child with a guessed insertion point');
    assert.equal(units[0].en, null);
  });
});
