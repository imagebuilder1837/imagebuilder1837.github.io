'use strict';

// Run from the blog root; the theme is checked out at themes/clover and the
// blog's installed dependencies (including Hexo) drive the generated sites:
// node test/integration.js
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const yaml = require('js-yaml');
const { withSite } = require('./helpers/site');

const all = ['Plain story', 'Tagged story', 'Category story', 'Both story', 'Blocked story', 'Ignored story'];
const cases = [
  ['unconfigured', '', all],
  ['empty home', 'home: {}', all],
  ['null home', 'home: null', all],
  ['empty conditions', 'home: {category: "", tag: [], except_category: [], except_tag: null}', all],
  ['only tag string', 'home: {tag: Featured}', ['Tagged story', 'Both story', 'Blocked story']],
  ['only category string', 'home: {category: News}', ['Category story', 'Both story']],
  ['tag array', 'home: {tag: [Featured, Ignored]}', ['Tagged story', 'Both story', 'Blocked story', 'Ignored story']],
  ['category array', 'home: {category: [News, Hidden]}', ['Category story', 'Both story', 'Blocked story']],
  ['either category or tag', 'home: {category: News, tag: Ignored}', ['Category story', 'Both story', 'Ignored story']],
  ['excluded category with tag match', 'home: {tag: Featured, except_category: Hidden}', ['Tagged story', 'Both story']],
  ['excluded tag with category match', 'home: {category: News, except_tag: Featured}', ['Category story']],
  ['exceptions without inclusion', 'home: {except_category: Hidden, except_tag: Ignored}', ['Plain story', 'Tagged story', 'Category story', 'Both story']],
  ['empty exceptions with inclusion', 'home: {tag: Featured, except_category: "", except_tag: []}', ['Tagged story', 'Both story', 'Blocked story']]
];

// Site overrides for every case: nav and footer must agree on social order.
const socialLines = [
  '  social:',
  '    Mastodon: https://example.com/mastodon',
  '    Unused: ""',
  '  social_order: [Mastodon, GitHub]'
];

for (const [label, override, expected] of cases) {
  const themeConfig = yaml.load(socialLines.concat(override ? [`  ${override}`] : []).join('\n'));
  withSite({ config: { theme_config: themeConfig } }, (dir, result) => {
    assert.equal(result.status, 0, `${label}: ${result.stdout}\n${result.stderr}`);
    const html = fs.readFileSync(path.join(dir, 'public', 'index.html'), 'utf8');
    const found = [...html.matchAll(/<a href="[^"]+" class="title">([^<]+)<\/a>/g)]
      .map(match => match[1]).filter(name => all.includes(name)).sort();
    assert.deepEqual(found, [...expected].sort(), label);
    const socialHrefs = [...html.matchAll(/href="(https:\/\/example\.com\/(?:mastodon|github))"/g)]
      .map(match => match[1]);
    assert.deepEqual(socialHrefs, [
      'https://example.com/mastodon', 'https://example.com/github',
      'https://example.com/mastodon', 'https://example.com/github'
    ], `${label}: social order (nav then footer)`);
    assert.ok(!html.includes('icon-unused') && !html.includes('>Unused<'), `${label}: empty social filtered`);
    if (label === 'unconfigured') {
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
    }
    process.stdout.write(`ok ${label}\n`);
  });
}
