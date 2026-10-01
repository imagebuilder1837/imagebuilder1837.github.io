'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { test } = require('node:test');

const site = path.resolve(__dirname, '..');
const filename = 'google17db084228384126.html';
test("Google verification file is published byte-for-byte unchanged", () => {
  const generated = fs.readFileSync(path.join(site, "public", filename));
  const original = fs.readFileSync(path.join(site, "source", filename));
  assert.ok(
    generated.equals(original),
    "Google verification file must be published byte-for-byte unchanged",
  );
});
