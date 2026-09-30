'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { XMLParser, XMLValidator } = require('fast-xml-parser');
const { document } = require('./html');

function compatibility(html, target, oldURL) {
  const doc = document(html);
  assert.deepEqual(doc.canonical, [target]);
  const refresh = doc.tags('meta').filter(node => doc.attrs(node)['http-equiv'] === 'refresh');
  assert.equal(refresh.length, 1);
  const navigationPath = new URL(target).pathname;
  assert.equal(doc.attrs(refresh[0]).content, `0; url=${navigationPath}`, 'same-origin immediate no-JS fallback');
  const link = doc.tags('a').find(node => doc.attrs(node).href === navigationPath && doc.text(node).trim());
  assert.ok(link, 'same-origin clickable no-JS fallback');
  assert.equal(doc.ld.length, 0, 'compatibility page is not an article');
  assert.equal(doc.meta('og:url').length, 0);
  const scripts = doc.tags('script');
  assert.equal(scripts.length, 1);
  const previewURL = new URL(new URL(oldURL).pathname, 'http://localhost:4000').href;
  for (const pageURL of [oldURL, previewURL]) {
    const expected = new URL(navigationPath, pageURL);
    assert.equal(new URL(doc.attrs(link).href, pageURL).href, expected.href, 'fallback stays on the current host and port');
    for (const suffix of ['', '?a=1&b=%26', '?q=%3Cscript%3E']) {
      const initial = new URL(pageURL + suffix);
      let destination;
      vm.runInNewContext(doc.text(scripts[0]), { location: {
        search: initial.search,
        replace(value) { destination = new URL(value, initial).href; }
      } }, { timeout: 100 });
      const queriedTarget = new URL(expected);
      queriedTarget.search = initial.search;
      assert.equal(destination, queriedTarget.href, 'replacement stays on the current origin and preserves query parameters');
    }
  }
  return doc;
}

function discovery(publicDir, siteURL, aliases) {
  const xml = fs.readFileSync(path.join(publicDir, 'sitemap.xml'), 'utf8');
  assert.equal(XMLValidator.validate(xml), true, 'valid sitemap XML');
  const parsed = new XMLParser({ ignoreAttributes: false, parseTagValue: false }).parse(xml);
  assert.equal(parsed.urlset['@_xmlns'], 'http://www.sitemaps.org/schemas/sitemap/0.9');
  const items = [].concat(parsed.urlset.url || []);
  const urls = items.map(item => item.loc);
  assert.equal(new Set(urls).size, urls.length, 'no duplicate sitemap URLs');
  const base = siteURL.replace(/\/$/, '') + '/';
  const aliasRoutes = new Set(aliases.map(alias => alias.from.slice(1) + 'index.html'));
  const expected = [];
  for (const route of fs.readdirSync(publicDir, { recursive: true }).filter(route => route.endsWith('.html'))) {
    const html = fs.readFileSync(path.join(publicDir, route), 'utf8');
    const doc = document(html);
    if (aliasRoutes.has(route) || /^404(?:\/|\.)/.test(route) || !doc.canonical.length) continue;
    assert.ok(route.endsWith('index.html'), 'formal pages use directory routes');
    const canonical = new URL(route.replace(/index\.html$/, ''), base).href;
    assert.deepEqual(doc.canonical, [canonical], `${route}: self-canonical`);
    assert.deepEqual(doc.meta('og:url'), [canonical], `${route}: OG consistency`);
    assert.equal(doc.tags('h1').length, 1);
    expected.push(canonical);
  }
  assert.deepEqual([...urls].sort(), [...expected].sort(), 'sitemap includes exactly formal pages, no redirects/assets');
  const robots = fs.readFileSync(path.join(publicDir, 'robots.txt'), 'utf8');
  assert.equal(robots, `User-agent: *\nAllow: /\nSitemap: ${base}sitemap.xml\n`);
  return urls;
}

module.exports = { compatibility, discovery };
