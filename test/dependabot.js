'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { validate, manage } = require('../.github/scripts/dependabot-scope.cjs');

const repo = 'imagebuilder1837/imagebuilder1837.github.io';
const head = 'b'.repeat(40);
const base = 'a'.repeat(40);
const next = 'c'.repeat(40);
const manifest = { name: 'blog', scripts: { test: 'node --test' }, dependencies: { hexo: '^8.0.0' }, devDependencies: { yaml: '^1.0.0' } };
const updated = { ...manifest, dependencies: { hexo: '^9.0.0' } };
const lock = { name: 'blog', lockfileVersion: 3, requires: true, packages: { '': { name: 'blog', dependencies: manifest.dependencies }, 'node_modules/hexo': { version: '8.0.0' } } };
const updatedLock = { ...lock, packages: { '': { ...lock.packages[''], dependencies: updated.dependencies }, 'node_modules/hexo': { version: '9.0.0' } } };
const workflow = `name: test\non: push\npermissions:\n  contents: read\njobs:\n  build:\n    runs-on: ubuntu-latest\n    steps:\n      - uses: actions/checkout@${base} # v4\n      - uses: dependabot/fetch-metadata@${base} # v3\n        with:\n          github-token: token\n      - run: echo tested\n`;
const workflowUpdate = workflow.replaceAll(`@${base}`, `@${head}`).replace('# v4', '# v5').replace('# v3', '# v4');
const json = value => JSON.stringify(value);

function fixture(contents = { 'package.json': [json(manifest), json(updated)], 'package-lock.json': [json(lock), json(updatedLock)] }) {
  const calls = [];
  const files = Object.keys(contents).map(filename => ({ filename, status: 'modified' }));
  const pull = { user: { id: 49699333 }, head: { sha: head, repo: { full_name: repo } }, base: { sha: base, ref: 'main', repo: { full_name: repo } }, state: 'open', draft: false, changed_files: files.length, auto_merge: null };
  const data = { pull, files, contents, calls };
  data.api = endpoint => {
    calls.push(endpoint);
    if (endpoint === `repos/${repo}/pulls/18`) return structuredClone(data.pull);
    if (endpoint.includes('/files?')) {
      const page = Number(new URL(`https://example/${endpoint}`).searchParams.get('page'));
      return structuredClone(data.files.slice((page - 1) * 100, page * 100));
    }
    const match = /\/contents\/(.+)\?ref=(.+)$/.exec(endpoint);
    assert.ok(match, `Unexpected endpoint: ${endpoint}`);
    const values = data.contents[decodeURIComponent(match[1])];
    const text = values[match[2] === base ? 0 : 1];
    return { type: 'file', encoding: 'base64', size: Buffer.byteLength(text), content: Buffer.from(text).toString('base64') };
  };
  data.options = { repo, number: '18', expectedHead: head, ecosystem: 'npm_and_yarn', directory: '/', dependencies: '[{"dependencyName":"hexo"}]', api: endpoint => data.api(endpoint) };
  return data;
}

function rejected(data, pattern) {
  assert.throws(() => validate(data.options), pattern);
}

test('npm major and same-ecosystem groups use the public validator and immutable content refs', () => {
  const data = fixture();
  data.options.dependencies = '[{"dependencyName":"hexo"},{"dependencyName":"yaml"}]';
  assert.equal(validate(data.options), true);
  assert.ok(data.calls.some(call => call.endsWith(`ref=${base}`)));
  assert.ok(data.calls.some(call => call.endsWith(`ref=${head}`)));
});

test('lockfile-only security/transitive updates do not require a direct manifest change', () => {
  const data = fixture({ 'package-lock.json': [json(lock), json({ ...lock, packages: { ...lock.packages, 'node_modules/transitive': { version: '2.0.0' } } })] });
  assert.equal(validate(data.options), true);
});

for (const [name, change] of [
  ['scripts', value => { value.scripts.test = 'curl attacker'; }],
  ['overrides', value => { value.overrides = { yaml: '1.0.0' }; }],
  ['new dependency', value => { value.dependencies.other = '^1.0.0'; }],
  ['removed dependency', value => { delete value.dependencies.hexo; }],
  ['moved dependency', value => { value.devDependencies.hexo = value.dependencies.hexo; delete value.dependencies.hexo; }],
  ['source change', value => { value.dependencies.hexo = 'git+https://example/hexo'; }]
]) {
  test(`npm ${name} is manual`, () => {
    const changed = structuredClone(updated);
    change(changed);
    const data = fixture();
    data.contents['package.json'][1] = json(changed);
    rejected(data, /manifest|Dependency|dependency/);
  });
}

test('lockfile format/configuration changes and missing matching lockfile are manual', () => {
  for (const patch of [{ lockfileVersion: 2 }, { requires: false }]) {
    const data = fixture({ 'package-lock.json': [json(lock), json({ ...updatedLock, ...patch })] });
    rejected(data, /lockfile|Lockfile/);
  }
  rejected(fixture({ 'package.json': [json(manifest), json(updated)] }), /without lockfile/);
});

test('Actions SHA, version comments, major, verifier itself and groups are eligible', () => {
  const data = fixture({ '.github/workflows/dependabot-automerge.yml': [workflow, workflowUpdate] });
  data.options.ecosystem = 'github_actions';
  assert.equal(validate(data.options), true);
});

for (const [name, change] of [
  ['identity', text => text.replace('actions/checkout', 'other/checkout')],
  ['input', text => text.replace('github-token: token', 'github-token: different')],
  ['command', text => text.replace('echo tested', 'echo changed')],
  ['permission', text => text.replace('contents: read', 'contents: write')],
  ['event', text => text.replace('on: push', 'on: pull_request_target')],
  ['condition', text => text.replace('    steps:', '    if: true\n    steps:')],
  ['runner', text => text.replace('ubuntu-latest', 'windows-latest')],
  ['job structure', text => text.replace('  build:', '  different:')],
  ['environment', text => text.replace('    steps:', '    environment: production\n    steps:')],
  ['floating tag', text => text.replace(`@${head}`, '@v5')],
  ['unrelated comment', text => `${text}# another change\n`],
  ['ambiguous YAML', text => `${text}jobs: {}\n`],
  ['command masquerading as uses', text => text.replace('echo tested', `|\n          uses: actions/checkout@${head} # v5`)]
]) {
  test(`Actions ${name} change is manual`, () => {
    const data = fixture({ '.github/workflows/ci.yml': [workflow, change(workflowUpdate)] });
    data.options.ecosystem = 'github_actions';
    assert.throws(() => validate(data.options));
  });
}

test('mixed ecosystems and workflow addition/deletion/rename are manual', () => {
  const data = fixture({ '.github/workflows/ci.yml': [workflow, workflowUpdate], 'package.json': [json(manifest), json(updated)] });
  data.options.ecosystem = 'github_actions';
  rejected(data, /Mixed/);
  for (const status of ['added', 'removed', 'renamed']) {
    const changed = fixture({ '.github/workflows/ci.yml': [workflow, workflowUpdate] });
    changed.options.ecosystem = 'github_actions';
    changed.files[0].status = status;
    rejected(changed, /added, deleted or renamed/);
  }
});

test('identity/state/head and invalid metadata cannot qualify', () => {
  for (const change of [
    pull => { pull.user.id = 1; },
    pull => { pull.head.repo.full_name = 'other/repo'; },
    pull => { pull.base.ref = 'other'; },
    pull => { pull.draft = true; },
    pull => { pull.state = 'closed'; },
    pull => { pull.head.sha = next; }
  ]) {
    const data = fixture();
    change(data.pull);
    rejected(data, /identity, state or head/);
  }
  for (const metadata of ['', '[]', '{}', '[null]', '[{}]']) {
    const data = fixture();
    data.options.dependencies = metadata;
    assert.throws(() => validate(data.options));
  }
});

test('complete file pagination is required, including grouped updates', () => {
  const contents = Object.fromEntries(Array.from({ length: 101 }, (_, index) => [`.github/workflows/test-${index}.yml`, [workflow, workflowUpdate]]));
  const data = fixture(contents);
  data.options.ecosystem = 'github_actions';
  assert.equal(validate(data.options), true);
  assert.ok(data.calls.some(call => call.endsWith('page=2')));
  data.api = endpoint => endpoint.includes('page=2') ? [] : fixture(contents).api(endpoint);
  rejected(data, /Incomplete/);
});

test('API failures, truncated content and head changes during validation fail closed', () => {
  const broken = fixture();
  broken.api = () => { throw new Error('API unavailable'); };
  rejected(broken, /API unavailable/);
  const incomplete = fixture();
  const original = incomplete.api;
  incomplete.api = endpoint => {
    const result = original(endpoint);
    if (endpoint.includes('/contents/')) result.size++;
    return result;
  };
  rejected(incomplete, /Truncated/);
  const moved = fixture();
  const read = moved.api;
  let pulls = 0;
  moved.api = endpoint => {
    const result = read(endpoint);
    if (endpoint === `repos/${repo}/pulls/18` && ++pulls > 1) result.head.sha = next;
    return result;
  };
  rejected(moved, /Head changed/);
});

function manager() {
  const data = fixture();
  const operations = [];
  const options = {
    ...data.options, eligible: true, enabled: true,
    command: args => {
      operations.push(args);
      data.pull.auto_merge = args.includes('--disable-auto') ? null : { enabled_by: { id: 1 } };
    }
  };
  return { data, operations, options };
}

test('qualified updates enable squash auto-merge with the checked head SHA', () => {
  const { operations, options } = manager();
  assert.equal(manage(options), 'enabled');
  assert.deepEqual(operations, [['pr', 'merge', '18', '--repo', repo, '--auto', '--squash', '--match-head-commit', head]]);
});

test('failed validation, disabled switch or stale runs revoke and confirm auto-merge', () => {
  for (const cause of ['ineligible', 'disabled', 'stale']) {
    const { data, operations, options } = manager();
    data.pull.auto_merge = { enabled_by: { id: 1 } };
    if (cause === 'ineligible') options.eligible = false;
    if (cause === 'disabled') options.enabled = false;
    if (cause === 'stale') data.pull.head.sha = next;
    assert.equal(manage(options), 'manual');
    assert.deepEqual(operations, [['pr', 'merge', '18', '--repo', repo, '--disable-auto']]);
  }
});

test('disable failure, unknown state and inability to confirm do not report manual success', () => {
  const { data, options } = manager();
  data.pull.auto_merge = {};
  options.eligible = false;
  options.command = () => { throw new Error('disable failed'); };
  assert.throws(() => manage(options), /disable failed/);
  options.command = () => {};
  assert.throws(() => manage(options), /confirm/);
  delete data.pull.auto_merge;
  assert.throws(() => manage(options), /Unknown/);
});

test('head changes while enabling revoke auto-merge; closed PRs are untouched', () => {
  const { data, options, operations } = manager();
  const original = options.command;
  options.command = args => {
    original(args);
    if (args.includes('--auto')) data.pull.head.sha = next;
  };
  assert.throws(() => manage(options), /revoked/);
  assert.equal(data.pull.auto_merge, null);
  assert.equal(operations.length, 2);
  data.pull.state = 'closed';
  assert.equal(manage(options), 'closed');
  assert.equal(operations.length, 2);
});
