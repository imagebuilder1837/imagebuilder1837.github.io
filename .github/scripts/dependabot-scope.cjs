'use strict';

const { isDeepStrictEqual } = require('node:util');
const { execFileSync } = require('node:child_process');
const { appendFileSync } = require('node:fs');

const BOT_ID = 49699333;
const SHA = /^[a-f0-9]{40}$/;
const DEPENDENCY_FIELDS = ['dependencies', 'devDependencies', 'optionalDependencies', 'peerDependencies'];
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const check = (condition, message) => { if (!condition) throw new Error(message); };

function withoutDependencies(manifest) {
  const result = { ...manifest };
  for (const field of DEPENDENCY_FIELDS) delete result[field];
  return result;
}

function npmScope(before, after) {
  const base = JSON.parse(before);
  const head = JSON.parse(after);
  check(object(base) && object(head), 'Invalid package manifest');
  check(isDeepStrictEqual(withoutDependencies(base), withoutDependencies(head)), 'Non-dependency manifest changes');
  const version = /^[~^]?\d+\.\d+\.\d+(?:-[\w.-]+)?(?:\+[\w.-]+)?$/;
  for (const field of DEPENDENCY_FIELDS) {
    check(Object.hasOwn(base, field) === Object.hasOwn(head, field), 'Dependency section added or removed');
    if (!Object.hasOwn(base, field)) continue;
    check(object(base[field]) && object(head[field]), 'Invalid dependency section');
    check(isDeepStrictEqual(Object.keys(base[field]).sort(), Object.keys(head[field]).sort()), 'Dependency added, removed or moved');
    for (const name of Object.keys(base[field])) {
      if (base[field][name] === head[field][name]) continue;
      check(typeof base[field][name] === 'string' && typeof head[field][name] === 'string' &&
        version.test(base[field][name]) && version.test(head[field][name]), 'Unsupported dependency source or range');
    }
  }
}

function lockScope(before, after) {
  const base = JSON.parse(before);
  const head = JSON.parse(after);
  check(object(base) && object(head), 'Invalid lockfile');
  check([2, 3].includes(base.lockfileVersion) && base.lockfileVersion === head.lockfileVersion, 'Unsupported lockfile format or migration');
  check(object(base.packages) && object(head.packages), 'Missing lockfile packages');
  // Dependabot is trusted to generate the tree. Only protect non-tree configuration.
  const configuration = lock => {
    const { packages, dependencies, ...rest } = lock;
    return rest;
  };
  check(isDeepStrictEqual(configuration(base), configuration(head)), 'Lockfile configuration changes');
  check(object(base.packages['']) && object(head.packages['']), 'Missing lockfile root');
  npmScope(JSON.stringify(base.packages['']), JSON.stringify(head.packages['']));
}

function normalizedWorkflow(text) {
  // Parse only as data, using the trusted default branch's dependency installation.
  const yaml = require('js-yaml');
  const document = yaml.load(text);
  check(object(document) && object(document.jobs), 'Invalid workflow');
  const reference = /^([\w.-]+\/[\w.-]+(?:\/[\w.-]+)*)@[a-f0-9]{40}$/;
  let count = 0;
  const normalizeUse = entry => {
    if (!object(entry) || typeof entry.uses !== 'string') return;
    const match = reference.exec(entry.uses);
    if (!match) return;
    entry.uses = `${match[1]}@SHA`;
    count++;
  };
  for (const job of Object.values(document.jobs)) {
    check(object(job), 'Invalid workflow job');
    normalizeUse(job);
    if (job.steps !== undefined) {
      check(Array.isArray(job.steps), 'Invalid workflow steps');
      for (const step of job.steps) normalizeUse(step);
    }
  }
  let lines = 0;
  const source = text.replace(
    /^(\s*(?:-\s*)?uses:[ \t]+)([\w.-]+\/[\w.-]+(?:\/[\w.-]+)*)@([a-f0-9]{40})([ \t]*(?:#[ \t]*v?\d+(?:\.\d+){0,2}(?:-[\w.-]+)?)?)(\r?)$/gm,
    (_, prefix, identity, sha, comment, ending) => {
      lines++;
      return `${prefix}${identity}@SHA${comment.replace(/(#[ \t]*)v?\d+(?:\.\d+){0,2}(?:-[\w.-]+)?$/, '$1VERSION')}${ending}`;
    }
  );
  // Reject unsupported quoting/annotations and matches inside multiline commands.
  check(count > 0 && count === lines, 'Unsupported or ambiguous Action references');
  return { document, source };
}

function actionsScope(before, after) {
  const base = normalizedWorkflow(before);
  const head = normalizedWorkflow(after);
  check(isDeepStrictEqual(base.document, head.document) && base.source === head.source, 'Changes outside Action SHA/version comments');
}

function ghApi(endpoint) {
  return JSON.parse(execFileSync('gh', ['api', endpoint], { encoding: 'utf8', timeout: 60000, maxBuffer: 8 * 1024 * 1024 }));
}

function pullIdentity(pull, repo, expectedHead) {
  return object(pull) && pull.user?.id === BOT_ID && pull.head?.repo?.full_name === repo &&
    pull.base?.repo?.full_name === repo && pull.base.ref === 'main' && pull.state === 'open' &&
    pull.draft === false && SHA.test(expectedHead) && pull.head.sha === expectedHead && SHA.test(pull.base.sha);
}

function validate({ repo, number, expectedHead, ecosystem, directory, dependencies, api = ghApi }) {
  check(directory === '/', 'Unsupported Dependabot directory');
  const metadata = JSON.parse(dependencies);
  check(Array.isArray(metadata) && metadata.length > 0 && metadata.every(item =>
    object(item) && typeof item.dependencyName === 'string' && item.dependencyName.length > 0), 'Missing or invalid Dependabot metadata');
  const endpoint = `repos/${repo}/pulls/${number}`;
  const pull = api(endpoint);
  check(pullIdentity(pull, repo, expectedHead), 'PR identity, state or head changed');
  check(Number.isInteger(pull.changed_files) && pull.changed_files > 0 && pull.changed_files <= 3000, 'Unsupported file count');
  const files = [];
  for (let page = 1; files.length < pull.changed_files; page++) {
    const batch = api(`${endpoint}/files?per_page=100&page=${page}`);
    check(Array.isArray(batch) && batch.length > 0 && batch.length <= 100, 'Incomplete file list');
    files.push(...batch);
  }
  check(files.length === pull.changed_files && new Set(files.map(file => file.filename)).size === files.length, 'Incomplete or duplicate file list');
  check(files.every(file => file.status === 'modified' && !file.previous_filename), 'File added, deleted or renamed');
  const npm = ecosystem === 'npm_and_yarn';
  const actions = ecosystem === 'github_actions';
  check(npm || actions, 'Unsupported ecosystem');
  check(files.every(file => npm ? ['package.json', 'package-lock.json'].includes(file.filename) : /^\.github\/workflows\/[^/]+\.ya?ml$/.test(file.filename)), 'Mixed or out-of-scope files');
  const content = (filename, ref) => {
    const path = filename.split('/').map(encodeURIComponent).join('/');
    const blob = api(`repos/${repo}/contents/${path}?ref=${ref}`);
    check(object(blob) && blob.type === 'file' && blob.encoding === 'base64' && typeof blob.content === 'string' &&
      Number.isInteger(blob.size) && blob.size <= 1024 * 1024, 'Unsupported or incomplete content');
    const bytes = Buffer.from(blob.content, 'base64');
    check(bytes.length === blob.size && bytes.toString('base64') === blob.content.replace(/\s/g, ''), 'Truncated or invalid content');
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  };
  check(!npm || !files.some(file => file.filename === 'package.json') || files.some(file => file.filename === 'package-lock.json'), 'Manifest update without lockfile');
  for (const file of files) {
    const before = content(file.filename, pull.base.sha);
    const after = content(file.filename, expectedHead);
    if (actions) actionsScope(before, after);
    else if (file.filename === 'package.json') npmScope(before, after);
    else lockScope(before, after);
  }
  check(pullIdentity(api(endpoint), repo, expectedHead), 'Head changed during validation');
  return true;
}

function manage({ repo, number, expectedHead, eligible, enabled, api = ghApi,
  command = args => execFileSync('gh', args, { stdio: 'inherit', timeout: 60000 }) }) {
  const endpoint = `repos/${repo}/pulls/${number}`;
  const pull = api(endpoint);
  check(pull.user?.id === BOT_ID, 'Not a Dependabot PR');
  check(['open', 'closed'].includes(pull.state), 'Unknown PR state');
  if (pull.state === 'closed') return 'closed';
  if (eligible && enabled && pullIdentity(pull, repo, expectedHead)) {
    command(['pr', 'merge', String(number), '--repo', repo, '--auto', '--squash', '--match-head-commit', expectedHead]);
    const current = api(endpoint);
    check(['open', 'closed'].includes(current.state), 'Unknown PR state after enabling auto-merge');
    if (current.state === 'closed') return 'closed';
    if (!pullIdentity(current, repo, expectedHead)) {
      manage({ repo, number, expectedHead, eligible: false, enabled, api, command });
      throw new Error('PR changed while enabling auto-merge; automatic merge revoked');
    }
    check(object(current.auto_merge), 'Could not confirm auto-merge is enabled');
    return 'enabled';
  }
  if (pull.auto_merge !== null) {
    check(object(pull.auto_merge), 'Unknown auto-merge state');
    command(['pr', 'merge', String(number), '--repo', repo, '--disable-auto']);
  }
  const current = api(endpoint);
  check(current.head?.sha === pull.head.sha, 'Head changed while disabling auto-merge; retry required');
  check(current.auto_merge === null, 'Could not confirm auto-merge is disabled');
  return 'manual';
}

module.exports = { validate, manage };

if (require.main === module) {
  const options = {
    repo: process.env.REPO,
    number: process.env.PR,
    expectedHead: process.env.HEAD_SHA,
    ecosystem: process.env.ECOSYSTEM,
    directory: process.env.DIRECTORY,
    dependencies: process.env.DEPENDENCIES,
    eligible: process.env.ELIGIBLE === 'true',
    enabled: process.env.AUTOMERGE_ENABLED === 'true'
  };
  try {
    check(/^[\w.-]+\/[\w.-]+$/.test(options.repo) && /^[1-9]\d*$/.test(options.number), 'Invalid repository or PR number');
    if (process.argv[2] === 'validate') {
      validate(options);
      appendFileSync(process.env.GITHUB_OUTPUT, 'eligible=true\n');
      console.log('Eligible Dependabot update (including major updates).');
    } else if (process.argv[2] === 'manage') {
      console.log(`Auto-merge outcome: ${manage(options)}`);
    } else throw new Error('Expected validate or manage');
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
