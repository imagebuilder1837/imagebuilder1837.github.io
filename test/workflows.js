'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync, readdirSync, mkdtempSync, writeFileSync, rmSync, existsSync } = require('node:fs');
const { tmpdir } = require('node:os');
const { join } = require('node:path');
const { execFileSync } = require('node:child_process');
const yaml = require('js-yaml');

const ci = yaml.load(readFileSync('.github/workflows/ci.yml', 'utf8'));
const bot = yaml.load(readFileSync('.github/workflows/dependabot-automerge.yml', 'utf8'));
const repo = 'imagebuilder1837/imagebuilder1837.github.io';

// Evaluate the actual declarative gate, rather than a second implementation.
function allows(expression, event, ref, repository = repo, enabled = 'true') {
  return Function('github', 'vars', `return (${expression});`)(
    { event_name: event, ref, repository }, { PAGES_RELEASE_ENABLED: enabled }
  );
}

test('every push/PR and explicit dispatch receives build; no publication path filtering', () => {
  assert.deepEqual(Object.keys(ci.on), ['push', 'pull_request', 'workflow_dispatch']);
  assert.equal(ci.on.push, null);
  assert.equal(ci.on.pull_request, null);
  assert.equal(existsSync('.github/workflows/pages.yml'), false);
  assert.deepEqual(ci.permissions, { contents: 'read' });
  assert.deepEqual(ci.jobs.build.permissions, { contents: 'read' });
  assert.equal(ci.jobs.build.concurrency, undefined);
  const steps = ci.jobs.build.steps;
  assert.equal(steps.filter(step => step.run === 'npm test').length, 1);
  assert.equal(steps.find(step => step.uses?.startsWith('actions/setup-node@')).with['node-version'], '24');
  assert.equal(steps.find(step => step.uses?.startsWith('actions/checkout@')).with['persist-credentials'], false);
});

test('PR/branch/foreign-repository/disabled runs cannot upload or deploy; all main changes can', () => {
  const upload = ci.jobs.build.steps.find(step => step.uses?.startsWith('actions/upload-pages-artifact@'));
  const gates = [upload.if, ci.jobs.deploy.if];
  for (const gate of gates) {
    for (const event of ['push', 'workflow_dispatch']) assert.equal(allows(gate, event, 'refs/heads/main'), true);
    for (const event of ['pull_request', 'pull_request_target', 'workflow_run']) assert.equal(allows(gate, event, 'refs/heads/main'), false);
    assert.equal(allows(gate, 'push', 'refs/heads/other'), false);
    assert.equal(allows(gate, 'workflow_dispatch', 'refs/heads/other'), false);
    assert.equal(allows(gate, 'push', 'refs/heads/main', 'other/repo'), false);
    assert.equal(allows(gate, 'push', 'refs/heads/main', repo, 'false'), false);
  }
  assert.equal(upload.with.path, 'public');
  assert.ok(ci.jobs.build.steps.indexOf(upload) > ci.jobs.build.steps.findIndex(step => step.run === 'npm test'));
});

test('deployment uses same-run artifact, minimal permissions and job-level serial semantics', () => {
  const deploy = ci.jobs.deploy;
  assert.equal(deploy.needs, 'build');
  assert.deepEqual(deploy.permissions, { contents: 'read', pages: 'write', 'id-token': 'write' });
  assert.deepEqual(deploy.concurrency, { group: 'pages', 'cancel-in-progress': false });
  assert.equal(ci.concurrency, undefined);
  assert.equal(deploy.environment.name, 'github-pages');
  assert.equal(deploy.steps.some(step => /npm|hexo/.test(step.run || '')), false);
  const action = deploy.steps.find(step => step.uses?.startsWith('actions/deploy-pages@'));
  assert.equal(action.with, undefined); // Default artifact in this workflow run, not a supplied run/PR.
  assert.equal(action.if, "steps.fresh.outputs.current == 'true'");
});

test('actual freshness step rejects obsolete artifacts and fails on API errors', () => {
  const step = ci.jobs.deploy.steps[0];
  const directory = mkdtempSync(join(tmpdir(), 'blog-freshness-'));
  try {
    writeFileSync(join(directory, 'gh'), '#!/bin/sh\n[ "$1" = api ] || exit 1\n[ "$2" = "repos/$REPO/git/ref/heads/main" ] || exit 1\n[ "$MOCK_API_FAIL" != 1 ] || exit 1\nprintf "%s\\n" "$MOCK_HEAD"\n', { mode: 0o755 });
    for (const [current, expected] of [['a'.repeat(40), 'true'], ['b'.repeat(40), 'false']]) {
      const output = join(directory, 'output');
      writeFileSync(output, '');
      execFileSync('bash', ['-c', step.run], { env: { ...process.env, PATH: `${directory}:${process.env.PATH}`, REPO: repo, GITHUB_SHA: 'a'.repeat(40), MOCK_HEAD: current, GITHUB_OUTPUT: output } });
      assert.equal(readFileSync(output, 'utf8'), `current=${expected}\n`);
    }
    assert.throws(() => execFileSync('bash', ['-c', step.run], { env: { ...process.env, PATH: `${directory}:${process.env.PATH}`, REPO: repo, MOCK_API_FAIL: '1' } }));
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test('repository external Action references are SHA-pinned with recognizable versions', () => {
  for (const file of readdirSync('.github/workflows')) {
    const document = yaml.load(readFileSync(join('.github/workflows', file), 'utf8'));
    for (const job of Object.values(document.jobs)) {
      for (const step of job.steps || []) {
        if (step.uses) assert.match(step.uses, /^[\w.-]+\/[\w./-]+@[a-f0-9]{40}$/);
      }
    }
    const text = readFileSync(join('.github/workflows', file), 'utf8');
    for (const line of text.split('\n').filter(line => /uses:/.test(line))) assert.match(line, /@[a-f0-9]{40} # v\d/);
  }
});

test('bot executes only default-branch code; failed validation still reaches revocation', () => {
  assert.ok(bot.on.pull_request_target.includes?.('synchronize') || bot.on.pull_request_target.types.includes('synchronize'));
  assert.deepEqual(bot.permissions, { contents: 'read' });
  assert.deepEqual(bot.jobs.validate.permissions, { contents: 'read', 'pull-requests': 'read' });
  const management = bot.jobs['manage-auto-merge'];
  assert.equal(management.needs, 'validate');
  assert.match(management.if, /always\(\)/);
  assert.equal(management.steps.some(step => /npm/.test(step.run || '')), false);
  assert.equal(bot.jobs.validate.steps.find(step => step.run?.startsWith('npm')).run, 'npm ci --ignore-scripts');
  for (const job of Object.values(bot.jobs)) {
    const checkout = job.steps.find(step => step.uses?.startsWith('actions/checkout@'));
    assert.equal(checkout.with.ref, '${{ github.event.repository.default_branch }}');
    assert.equal(checkout.with['persist-credentials'], false);
  }
  assert.equal(bot.concurrency['cancel-in-progress'], false);
  assert.match(bot.concurrency.group, /pull_request.number/);
});

test('Dependabot keeps npm grouping and adds monthly ungrouped Actions updates', () => {
  const configuration = yaml.load(readFileSync('.github/dependabot.yml', 'utf8'));
  assert.equal(configuration.version, 2);
  assert.equal(configuration.updates.length, 2);
  const npm = configuration.updates.find(update => update['package-ecosystem'] === 'npm');
  const actions = configuration.updates.find(update => update['package-ecosystem'] === 'github-actions');
  assert.equal(npm.schedule.interval, 'monthly');
  assert.deepEqual(npm.groups['routine-patch-minor']['update-types'], ['patch', 'minor']);
  assert.equal(actions.schedule.interval, 'monthly');
  assert.equal(actions.directory, '/');
  assert.equal(actions.groups, undefined);
  assert.equal(npm.ignore, undefined);
  assert.equal(actions.ignore, undefined);
});
