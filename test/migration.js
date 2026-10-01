'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { runSync } = require('./helpers/process');
const { XMLParser, XMLValidator } = require('fast-xml-parser');
const { testSite } = require('./helpers/site');
const { pageMetadata } = require('./helpers/html');
const { compatibility, discovery } = require('./helpers/discovery');

const oldPath = '/2025/01/01/old-name/';
const newPath = '/2025/01/01/new-name/';
const aliases = [{ from: oldPath, to: newPath }];
const files = {
  'migrations/redirects.json': JSON.stringify(aliases),
  'source/_posts/migrated.md': `---
title: Fictional migration
date: 2025-01-01
permalink: ${newPath}
description: A fictional migration example.
---
## New heading

A fictional body.`,
  'source/404.html': '<!doctype html><html><body>Not found</body></html>',
  'source/verification.html': 'verification-token'
};
for (const root of ['/', '/blog/']) {
  const siteURL = 'https://example.com' + (root === '/' ? '' : '/blog');
  testSite(`historical URLs, query fallback and discovery: ${root}`, { blogScripts: true, files, config: { url: siteURL, root, skip_render: ['404.html', 'verification.html'], feed: { type: 'atom', path: 'atom.xml', limit: 0 } } }, (dir, result) => {
    assert.equal(result.status, 0, result.stdout + result.stderr);
    const publicDir = path.join(dir, 'public');
    const read = route => fs.readFileSync(path.join(publicDir, route), 'utf8');
    const target = siteURL + newPath;
    pageMetadata(read(newPath.slice(1) + 'index.html'), target, 'en', true);
    compatibility(read(oldPath.slice(1) + 'index.html'), target, siteURL + oldPath);
    const urls = discovery(publicDir, siteURL, aliases);
    assert.ok(urls.includes(target));
    assert.ok(!urls.includes(siteURL + oldPath));
    const xml = read('atom.xml');
    assert.equal(XMLValidator.validate(xml), true);
    const entries = [].concat(new XMLParser({ ignoreAttributes: false, parseTagValue: false }).parse(xml).feed.entry);
    const entry = entries.find(entry => entry.title === 'Fictional migration');
    assert.equal(entry.id, target); assert.equal(entry.link['@_href'], target);
    assert.ok(!entries.some(entry => entry.id === siteURL + oldPath));
    if (root === '/') {
      const products = [oldPath.slice(1) + 'index.html', newPath.slice(1) + 'index.html', 'sitemap.xml', 'robots.txt'];
      const original = products.map(read);
      // Repeat without cleaning, then with cleaning: neither cached routes nor
      // output-directory leftovers may be required for compatibility/discovery.
      for (const commands of [['generate'], ['clean', 'generate']]) {
        for (const command of commands) {
          const rerun = runSync(`fictional migration ${command}`, process.execPath, [require.resolve('hexo-cli/bin/hexo'), command], { cwd: dir });
          assert.equal(rerun.status, 0, rerun.stdout + rerun.stderr);
        }
        assert.deepEqual(products.map(read), original, 'compatibility/discovery rebuilt deterministically');
      }
    }
  });
}

const invalid = [
  ['self redirect', [{ from: oldPath, to: oldPath }], /Self redirect/],
  ['duplicate', [aliases[0], aliases[0]], /Duplicate historical address/],
  ['chain', [{ from: oldPath, to: '/intermediate/' }, { from: '/intermediate/', to: newPath }], /chain or cycle/],
  ['cycle', [{ from: oldPath, to: '/intermediate/' }, { from: '/intermediate/', to: oldPath }], /chain or cycle/],
  ['missing target', [{ from: oldPath, to: '/missing/' }], /Missing redirect target/],
  ['page collision', [{ from: '/2024/01/01/01-plain/', to: newPath }], /collides/],
  ['asset directory collision', [{ from: '/images/', to: newPath }], /collides/],
  ['traversal', [{ from: '/../outside/', to: newPath }], /safe absolute directory paths/],
  ['encoded traversal', [{ from: '/%2e%2e/outside/', to: newPath }], /safe absolute directory paths/],
  ['external URL', [{ from: oldPath, to: 'https://other.invalid/' }], /safe absolute directory paths/],
  ['backslash', [{ from: '/legacy\\outside/', to: newPath }], /safe absolute directory paths/],
  ['query', [{ from: oldPath, to: '/target/?q=1' }], /safe absolute directory paths/],
  ['non-page target', [{ from: oldPath, to: '/raw/' }], /not a formal page/]
];
for (const [name, mapping, error] of invalid) {
  testSite(`reject historical mapping: ${name}`, { blogScripts: true, files: {
    ...files, 'migrations/redirects.json': JSON.stringify(mapping),
    'source/raw/index.html': 'raw asset',
    'source/generator-order.txt': 'order-independent asset'
  }, config: { skip_render: ['raw/index.html', '404.html', 'verification.html'] } }, (dir, result) => {
    assert.notEqual(result.status, 0, `${name}: build rejects invalid mapping`);
    assert.match(result.stdout + result.stderr, error, name);
  });
}
// A late asynchronous generator still participates in collision validation.
testSite('late asynchronous generator collision', { blogScripts: true, files: {
  ...files,
  'scripts/late-asset.js': `hexo.extend.generator.register('late-asset', async () => {
    await new Promise(resolve => setTimeout(resolve, 30));
    return { path: '${oldPath.slice(1)}index.html', data: 'asset to protect' };
  });`
} }, (dir, result) => {
  assert.notEqual(result.status, 0);
  assert.match(result.stdout + result.stderr, /collides/);
});
for (const reserved of ['sitemap.xml', 'robots.txt']) {
  testSite(`reserved discovery route collision: ${reserved}`, { blogScripts: true, files: { ...files, [`source/${reserved}`]: 'existing resource' } }, (dir, result) => {
    assert.notEqual(result.status, 0);
    assert.match(result.stdout + result.stderr, /Discovery route collision/);
  });
}
