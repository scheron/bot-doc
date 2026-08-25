import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, it } from 'node:test';

import { load } from 'js-yaml';

const ROOT = path.resolve(import.meta.dirname, '..', '..');
const TRANSLATE_WORKFLOW = path.join(ROOT, '.github', 'workflows', 'translate-docs.yml');
const MINE_WORKFLOW = path.join(ROOT, '.github', 'workflows', 'mine-glossary.yml');

describe('translate-docs.yml: a failed document still ships the pull request, but the run is red (TC-56)', () => {
  const workflow = load(readFileSync(TRANSLATE_WORKFLOW, 'utf8'));
  const job = workflow.jobs.translate;

  it('reads TRANSLATION_FAILURES_FILE in a step that comes after the pull request is created', () => {
    const names = job.steps.map(step => step.name ?? '');
    const prIndex = names.findIndex(name => /pull request/i.test(name));
    const failureCheckIndex = job.steps.findIndex(step => JSON.stringify(step).includes('TRANSLATION_FAILURES_FILE') && /fail|red/i.test(step.name ?? ''));

    assert.ok(prIndex !== -1, 'a pull-request step exists');
    assert.ok(failureCheckIndex !== -1, 'a step checks the failures file');
    assert.ok(prIndex < failureCheckIndex, 'the pull request is created before the run is marked red');
  });
});

describe('mine-glossary.yml (TC-46, TC-56)', () => {
  it('exists, runs the tests before anything that costs money, and is manual only', () => {
    const source = readFileSync(MINE_WORKFLOW, 'utf8');
    const workflow = load(source);
    const job = Object.values(workflow.jobs)[0];

    assert.ok(job.steps.length > 0);
    const names = job.steps.map(step => step.name ?? '');
    const testIndex = names.findIndex(name => /test/i.test(name));
    const mineIndex = names.findIndex(name => /mine|glossary/i.test(name));
    assert.ok(testIndex !== -1 && mineIndex !== -1 && testIndex < mineIndex, 'tests run before the glossary mining step');

    const trigger = workflow[true] ?? workflow.on;
    assert.ok(trigger.workflow_dispatch, 'manual dispatch only');
    assert.equal(trigger.push, undefined, 'no push trigger');
    assert.equal(trigger.schedule, undefined, 'no schedule, per the plan\'s out-of-scope note');
  });

  it('has its own concurrency group, separate from the translation workflow', () => {
    const mine = load(readFileSync(MINE_WORKFLOW, 'utf8'));
    const translate = load(readFileSync(TRANSLATE_WORKFLOW, 'utf8'));
    assert.notDeepEqual(mine.concurrency, translate.concurrency);
  });
});
