import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, it } from 'node:test';

import { load } from 'js-yaml';

const WORKFLOW = path.resolve(import.meta.dirname, '..', '..', '.github', 'workflows', 'translate-docs.yml');
const source = readFileSync(WORKFLOW, 'utf8');
// `on` is parsed as the boolean true by YAML 1.1, which js-yaml follows.
const workflow = load(source);
const job = workflow.jobs.translate;

// GitHub resolves job level env before a runner is picked, so only these are
// available there. Reaching for runner or steps is rejected as an invalid file,
// and nothing local catches it, hence this test.
const JOB_ENV_CONTEXTS = new Set(['github', 'needs', 'strategy', 'matrix', 'vars', 'secrets', 'inputs']);
const contextsIn = value => [...String(value).matchAll(/\$\{\{\s*([a-z]+)\./g)].map(match => match[1]);

describe('workflow file', () => {
  it('parses', () => {
    assert.ok(job, 'the translate job exists');
    assert.ok(job.steps.length > 0);
  });

  it('uses only contexts that exist at job level', () => {
    for (const [name, value] of Object.entries(job.env ?? {})) {
      const forbidden = contextsIn(value).filter(context => !JOB_ENV_CONTEXTS.has(context));
      assert.deepEqual(forbidden, [], `job env ${name} reaches for ${forbidden.join(', ')}`);
    }
  });

  it('only reads outputs from steps that declare an id', () => {
    const declared = new Set(job.steps.map(step => step.id).filter(Boolean));
    const referenced = new Set([...source.matchAll(/steps\.([A-Za-z0-9_-]+)\./g)].map(match => match[1]));
    for (const id of referenced) {
      assert.ok(declared.has(id), `steps.${id} is read but no step declares that id`);
    }
  });

  it('runs the tests before anything that costs money', () => {
    const names = job.steps.map(step => step.name);
    const tests = names.findIndex(name => /test/i.test(name));
    const translate = names.findIndex(name => /^Translate/.test(name));
    assert.ok(tests !== -1, 'a test step exists');
    assert.ok(tests < translate, 'the test step comes before the first translation');
  });

  it('runs a Node the dependencies actually support', () => {
    // openai 7 needs Node 22. The runner had 20 and yarn refused to install,
    // which nothing local could show, because a developer machine is newer.
    const setup = job.steps.find(step => String(step.uses ?? '').startsWith('actions/setup-node'));
    const runner = Number(String(setup.with['node-version']).match(/\d+/)[0]);

    const required = JSON.parse(
      readFileSync(path.resolve(import.meta.dirname, '..', '..', 'node_modules', 'openai', 'package.json'), 'utf8'),
    ).engines?.node;

    const floor = Number(String(required ?? '>=0').match(/\d+/)[0]);
    assert.ok(runner >= floor, `the workflow runs Node ${runner} but openai needs ${required}`);
  });

  it('offers no way to skip a document that was asked for', () => {
    // Naming a document means its English version is wrong. A skip switch would
    // let the run ignore the request, and there is nothing to protect anyway:
    // the result lands in a pull request, not on master.
    const inputs = (workflow[true] ?? workflow.on).workflow_dispatch.inputs;
    assert.ok(!('force' in inputs), 'a force switch would imply named documents can be skipped');

    const step = job.steps.find(s => s.name === 'Translate the requested documents');
    assert.ok(!/--force/.test(step.run), 'the requested-documents step must not pass --force');
  });

  it('deploys nothing from a branch', () => {
    assert.deepEqual((workflow[true] ?? workflow.on).push.branches, ['master']);
  });

  it('hands the usage file to every step that reads or writes it', () => {
    const users = job.steps.filter(step => /^Translate|pull request/.test(step.name ?? ''));
    for (const step of users) {
      assert.ok(step.env?.TRANSLATION_USAGE_FILE, `${step.name} is missing TRANSLATION_USAGE_FILE`);
    }
  });
});
