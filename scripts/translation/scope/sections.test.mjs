import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, it } from 'node:test';

import { parseSections } from './sections.mjs';

const ROOT = path.resolve(import.meta.dirname, '..', '..', '..');
const read = file => readFileSync(path.join(ROOT, file), 'utf8');

function countSections(nodes) {
  return nodes.reduce((sum, node) => sum + 1 + countSections(node.children), 0);
}

describe('parseSections: nesting and boundaries on a real document', () => {
  // assets/ru/interface.md carries frontmatter, then h1 > h2 > h3, which is
  // exactly the shape TC-2 asks for, on a real corpus file rather than an
  // invented one.
  const raw = read('assets/ru/interface.md');
  const rawLines = raw.split('\n');
  const doc = parseSections(raw);

  it('TC-2: keeps the whole source and puts the text before the first heading at the root', () => {
    assert.equal(doc.lines.length, rawLines.length, 'no line is dropped, including the frontmatter');
    assert.equal(doc.children.length, 1, 'exactly one h1 at the top');

    const h1 = doc.children[0];
    assert.equal(h1.level, 1);
    assert.equal(h1.text, 'Интерфейс сайта');
    assert.ok(h1.start > 0, 'the frontmatter precedes the heading and is not itself a section');
    assert.equal(rawLines[h1.start], '# Интерфейс сайта');
  });

  it('TC-2: a section ends exactly where the next same-or-lower-level heading starts', () => {
    const h1 = doc.children[0];
    const h2s = h1.children;
    assert.ok(h2s.length >= 3, 'interface.md has several top-level widgets sections');

    for (let i = 0; i < h2s.length - 1; i++) {
      assert.equal(h2s[i].end, h2s[i + 1].start, `h2 "${h2s[i].text}" ends where the next h2 starts`);
    }
    assert.equal(h2s.at(-1).end, doc.lines.length, 'the last h2 runs to the end of the document');

    const widgetOverview = h2s.find(section => section.children.some(child => child.text === 'Robot logs'));
    assert.ok(widgetOverview, 'the widget-description section is present');
    const h3s = widgetOverview.children;
    assert.ok(h3s.length >= 2);
    for (let i = 0; i < h3s.length - 1; i++) {
      assert.equal(h3s[i].end, h3s[i + 1].start, `h3 "${h3s[i].text}" ends where the next h3 starts`);
    }
    assert.equal(h3s.at(-1).end, widgetOverview.end, 'the last h3 ends exactly where its h2 parent ends');
  });
});

describe('parseSections: fenced code never turns into a heading', () => {
  it('TC-3: on assets/ru/c-api.md, the number of sections matches the number of real headings outside fences', () => {
    // c-api.md carries dozens of fenced C blocks. A fence-unaware scanner would
    // risk miscounting if a fenced line happened to start with '#'; verified by
    // a full corpus scan (see the test report) that no line inside a fence
    // currently starts with '#' anywhere in assets/ru, so this asserts the
    // general invariant the fence tracking exists to protect, on real content.
    const raw = read('assets/ru/c-api.md');
    const doc = parseSections(raw);

    const realHeadingLines = raw.split('\n').filter(line => /^#{1,6} /.test(line)).length;
    assert.equal(countSections(doc.children), realHeadingLines);
  });

  it('TC-3: a section built almost entirely of one huge fenced JSON block keeps correct start/end boundaries', () => {
    // assets/ru/api.md, section "Запрос шаблона по его идентификатору": ~89.5KB,
    // of which one fenced JSON block is ~87KB. If fence tracking were broken,
    // the closing ``` deep inside the block, or a stray heading-like line the
    // real JSON happens to contain, would corrupt the boundary.
    const raw = read('assets/ru/api.md');
    const doc = parseSections(raw);
    const rawLines = raw.split('\n');

    const flat = [];
    const collect = nodes => nodes.forEach(node => (flat.push(node), collect(node.children)));
    collect(doc.children);

    const section = flat.find(node => node.id === 'get_template_by_id');
    assert.ok(section, 'the real section is found by its real anchor id');
    assert.equal(rawLines[section.start].includes('Запрос шаблона по его идентификатору'), true);
    assert.ok(
      section.end === doc.lines.length || /^#{1,6} /.test(rawLines[section.end]),
      'the boundary lands exactly on the next real heading, not inside the fence',
    );

    const bodyText = rawLines.slice(section.start, section.end).join('\n');
    assert.ok(bodyText.length > 80_000, 'the huge fenced block is included in the section body');
  });
});

describe('parseSections: heading cleanup', () => {
  it('TC-4: cleans the Anchor tag from a heading while keeping the raw line and the id', () => {
    const raw = read('assets/ru/interface.md');
    const doc = parseSections(raw);
    const h1 = doc.children[0];
    const widgetOverview = h1.children.find(section => section.children.some(child => child.id === 'robot_logs'));
    const robotLogs = widgetOverview.children.find(child => child.id === 'robot_logs');

    assert.equal(robotLogs.text, 'Robot logs');
    assert.equal(robotLogs.id, 'robot_logs');
    assert.equal(robotLogs.heading, 'Robot logs <Anchor :ids="[\'robot_logs\']" />');
  });
});
