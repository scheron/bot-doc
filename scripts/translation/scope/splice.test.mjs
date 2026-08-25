import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, it } from 'node:test';

import { parseSections } from './sections.mjs';
import { spliceUnits } from './splice.mjs';

const ROOT = path.resolve(import.meta.dirname, '..', '..', '..');
const read = file => readFileSync(path.join(ROOT, file), 'utf8');

function findLeaf(doc, id) {
  const stack = [...doc.children];
  while (stack.length) {
    const node = stack.shift();
    if (node.id === id) return node;
    stack.unshift(...node.children);
  }
  return null;
}

describe('spliceUnits: a unit with an English pair', () => {
  it('TC-14: replaces exactly its lines and leaves the rest of the file byte for byte the same', () => {
    const enRaw = read('assets/en/interface.md');
    const enLines = enRaw.split('\n');
    const en = parseSections(enRaw);
    const robotLogs = findLeaf(en, 'robot_logs');
    assert.ok(robotLogs, 'the real section is present in the real English file');

    const translation = [
      '### Robot logs <Anchor :ids="[\'robot_logs\']" />',
      '',
      'Freshly translated body, deliberately different from the source.',
      '',
    ].join('\n');

    const before = enLines.slice(0, robotLogs.start);
    const after = enLines.slice(robotLogs.end);

    const spliced = spliceUnits(enLines, [
      { unit: { kind: 'section', ru: null, en: robotLogs, insertAfter: -1, reason: 'matched' }, translation },
    ]);

    assert.deepEqual(spliced.slice(0, before.length), before, 'everything before the unit is untouched');
    assert.deepEqual(spliced.slice(spliced.length - after.length), after, 'everything after the unit is untouched');

    const replaced = spliced.slice(before.length, spliced.length - after.length).join('\n');
    assert.equal(replaced, translation);
  });
});

describe('spliceUnits: a unit with no English pair', () => {
  it('TC-15: inserts the new section right after the given point, separated by a blank line, without disturbing order', () => {
    const enRaw = read('assets/en/creating-connection.md');
    const enLines = enRaw.split('\n');
    const en = parseSections(enRaw);
    const j2t = en.children[0].children.find(section => section.text === 'J2T');
    const insertAfter = j2t.end - 1;

    const translation = ['## BITGETSPOT', '', '### Name', '', 'Field for naming the connection.', ''].join('\n');
    const unit = { kind: 'section', ru: null, en: null, insertAfter, reason: 'no English counterpart' };

    const tailOriginal = enLines.slice(insertAfter + 1);

    const spliced = spliceUnits(enLines, [{ unit, translation }]);

    assert.deepEqual(spliced.slice(0, insertAfter + 1), enLines.slice(0, insertAfter + 1), 'nothing before the point moved');

    const translationLines = translation.split('\n');
    const landedAt = spliced.findIndex(
      (_line, index) => spliced.slice(index, index + translationLines.length).join('\n') === translation,
    );
    assert.ok(landedAt > insertAfter, 'the new section landed after the insertion point');
    assert.equal(spliced[landedAt - 1], '', 'a blank line separates it from what came before');

    const tailStart = landedAt + translationLines.length;
    assert.deepEqual(
      spliced.slice(tailStart, tailStart + tailOriginal.length),
      tailOriginal,
      'the rest of the document, including LMAX, keeps its original order',
    );
  });
});

describe('spliceUnits: several units in one document', () => {
  it('TC-16: places every unit correctly regardless of how earlier splices shift line indexes', () => {
    const enRaw = read('assets/en/interface.md');
    const enLines = enRaw.split('\n');
    const en = parseSections(enRaw);
    const robotLogs = findLeaf(en, 'robot_logs');
    const robotsTable = findLeaf(en, 'robots_table');
    assert.ok(robotLogs.start < robotsTable.start, 'the two real sections keep document order');

    const shortTranslation = '### Robot logs <Anchor :ids="[\'robot_logs\']" />\n\nShort.\n';
    const longTranslation = [
      '### Robots <Anchor :ids="[\'robots_table\']" />',
      '',
      ...Array.from({ length: 12 }, (_, i) => `Extra sentence number ${i + 1} to grow this section on purpose.`),
      '',
    ].join('\n');

    const before = enLines.slice(0, robotLogs.start);
    const between = enLines.slice(robotLogs.end, robotsTable.start);
    const after = enLines.slice(robotsTable.end);

    const spliced = spliceUnits(enLines, [
      { unit: { kind: 'section', ru: null, en: robotLogs, insertAfter: -1, reason: 'matched' }, translation: shortTranslation },
      { unit: { kind: 'section', ru: null, en: robotsTable, insertAfter: -1, reason: 'matched' }, translation: longTranslation },
    ]);

    assert.deepEqual(spliced.slice(0, before.length), before);

    const afterShort = spliced.slice(before.length).join('\n');
    assert.ok(afterShort.startsWith(shortTranslation.replace(/\n$/, '')), 'the short replacement landed first, in its own place');

    const betweenJoined = between.join('\n');
    assert.ok(afterShort.includes(betweenJoined), 'the untouched section between the two units survived, in order');

    assert.ok(afterShort.includes(longTranslation.replace(/\n$/, '')), 'the long replacement landed in its own place');
    assert.deepEqual(spliced.slice(spliced.length - after.length), after, 'everything after the last unit is untouched');
  });
});
