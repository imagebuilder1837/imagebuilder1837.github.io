'use strict';

// Run from the blog root; the checked-out theme uses the host's dependencies.
const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const { withSite, testSite } = require('./helpers/site');

const all = ['Plain story', 'Tagged story', 'Category story', 'Both story', 'Blocked story', 'Ignored story'];
testSite('complete home, social order, defaults and taxonomy routes', { config: { theme_config: {
  social: { Mastodon: 'https://example.com/mastodon', Unused: '' },
  social_order: ['Mastodon', 'GitHub']
} } }, (dir, result) => {
  assert.equal(result.status, 0, result.stdout + result.stderr);
  const html = fs.readFileSync(path.join(dir, 'public', 'index.html'), 'utf8');
  const found = [...html.matchAll(/<a href="[^"]+" class="title">([^<]+)<\/a>/g)]
    .map(match => match[1]).filter(name => all.includes(name)).sort();
  assert.deepEqual(found, [...all].sort());
  const socialHrefs = [...html.matchAll(/href="(https:\/\/example\.com\/(?:mastodon|github))"/g)]
    .map(match => match[1]);
  assert.deepEqual(socialHrefs, [
    'https://example.com/mastodon', 'https://example.com/github',
    'https://example.com/mastodon', 'https://example.com/github'
  ], 'social order (nav then footer)');
  assert.ok(!html.includes('icon-unused') && !html.includes('>Unused<'), 'empty social filtered');
  for (const value of ['hello@example.com', 'https://example.com/github', 'https://example.com/author', 'https://example.com/terms']) {
    assert.ok(html.includes(value), `missing example default: ${value}`);
  }
  for (const page of ['archives/index.html', 'tags/index.html', 'categories/index.html', 'tags/Featured/index.html', 'categories/News/index.html']) {
    assert.ok(fs.existsSync(path.join(dir, 'public', page)), `missing example route: ${page}`);
  }
  const tagPage = fs.readFileSync(path.join(dir, 'public', 'tags', 'Featured', 'index.html'), 'utf8');
  assert.ok(tagPage.includes('Tagged story') && !tagPage.includes('Category story'), 'tag page content');
  const categoryPage = fs.readFileSync(path.join(dir, 'public', 'categories', 'News', 'index.html'), 'utf8');
  assert.ok(categoryPage.includes('Category story') && !categoryPage.includes('Tagged story'), 'category page content');
});

for (const fails of [false, true]) {
  test(`temporary site cleanup after verification ${fails ? 'failure' : 'success'}`, () => {
    let temporary;
    const verify = () => withSite({}, (dir, result) => {
      temporary = dir;
      assert.equal(result.status, 0, result.stdout + result.stderr);
      if (fails) assert.fail('deliberate verification failure');
    });
    if (fails) assert.throws(verify, /deliberate verification failure/);
    else verify();
    assert.ok(temporary && !fs.existsSync(temporary), 'temporary site removed after verification');
  });
}
