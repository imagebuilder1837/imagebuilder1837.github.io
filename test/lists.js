'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { testSite } = require('./helpers/site');
const { document } = require('./helpers/html');

testSite('native ordered, unordered and nested list markers', { files: {
  'source/_posts/lists.md': '---\ntitle: Lists\ndate: 2025-01-01\n---\n1. Ordered item\n2. Another ordered item\n\n- Unordered item\n- Another unordered item\n  - Nested item\n'
} }, (dir, result) => {
  assert.equal(result.status, 0, result.stdout + result.stderr);
  const read = route => fs.readFileSync(path.join(dir, 'public', route), 'utf8');
  const article = document(read('2025/01/01/lists/index.html'));
  assert.equal(article.tags('ol').length, 1, 'ordered list retained');
  assert.equal(article.tags('ul').length, 2, 'unordered and nested lists retained');
  assert.doesNotMatch(read('css/index.css'), /\.article\s*>\s*\.content\s+(?:ul|ol)\s*>\s*li::before/, 'native list markers must not be duplicated by pseudo-element dots');
});
