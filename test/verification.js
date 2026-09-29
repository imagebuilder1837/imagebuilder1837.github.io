'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const site = path.resolve(__dirname, '..');
const filename = 'google17db084228384126.html';
for (const script of ['clean', 'build']) {
  const result = spawnSync('npm', ['run', script], { cwd: site, encoding: 'utf8' });
  assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
}
const generated = fs.readFileSync(path.join(site, 'public', filename));
const original = fs.readFileSync(path.join(site, 'source', filename));
assert.ok(generated.equals(original), 'Google verification file must be published byte-for-byte unchanged');
console.log('ok Google verification file');
