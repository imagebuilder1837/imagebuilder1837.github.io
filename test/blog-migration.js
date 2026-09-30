'use strict';

// Whole-site gate over actual Hexo output. Historical evidence is frozen data,
// not inferred from today's Markdown or fetched from the network in CI.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { parse } = require('hexo-front-matter');
const yaml = require('js-yaml');
const moment = require('moment-timezone');
const { withSite } = require('./helpers/site');
const { document, pageMetadata } = require('./helpers/html');
const { compatibility, discovery } = require('./helpers/discovery');
const { XMLParser, XMLValidator } = require('fast-xml-parser');

const site = path.resolve(__dirname, '..');
const publicDir = path.join(site, 'public');
const config = yaml.load(fs.readFileSync(path.join(site, '_config.yml'), 'utf8'));
const history = JSON.parse(fs.readFileSync(path.join(site, 'migrations/history.json'), 'utf8'));
const aliases = JSON.parse(fs.readFileSync(path.join(site, 'migrations/redirects.json'), 'utf8'));
const approved = JSON.parse(fs.readFileSync(path.join(site, 'migrations/approved-slugs.json'), 'utf8'));
const read = route => fs.readFileSync(path.join(publicDir, route), 'utf8');
const source = file => fs.readFileSync(path.join(site, 'source/_posts', file), 'utf8');
const posts = fs.readdirSync(path.join(site, 'source/_posts')).filter(file => file.endsWith('.md'));
assert.deepEqual(Object.keys(approved).sort(), [...posts].sort(), 'approved slug plan covers every source article');
assert.deepEqual(history.posts.map(post => post.post).sort(), [...posts].sort(), 'historical inventory covers every source article');
assert.equal(new Set(Object.values(approved)).size, posts.length);
for (const slug of Object.values(approved)) assert.match(slug, /^[a-z0-9]+(?:-[a-z0-9]+)*$/);
const expectedAliases = history.posts.flatMap(post => [...new Set([post.oldPath, post.publishedPath])].map(from => ({ from, to: post.newPath })));
const sorted = values => [...values].sort((a, b) => a.from.localeCompare(b.from));
assert.deepEqual(sorted(aliases), sorted(expectedAliases), 'all confirmed old addresses, including the published course-09 exception');
assert.equal(new Set(aliases.map(alias => alias.from)).size, aliases.length);
const aliasPaths = new Set(aliases.map(alias => alias.from));
const aliasRoutes = new Set(aliases.map(alias => alias.from.slice(1) + 'index.html'));
const docs = new Map();
for (const post of history.posts) {
  const raw = source(post.post);
  const data = parse(raw);
  assert.equal(data.title, post.title, `${post.post}: original title`);
  assert.equal(raw.match(/^date: (.+)$/m)?.[1], post.date, `${post.post}: original date`);
  assert.equal(data.updated, undefined);
  assert.equal(data.permalink, post.newPath, `${post.post}: explicit approved address`);
  assert.equal(post.newPath.split('/').at(-2), approved[post.post]);
  assert.ok(typeof data.description === 'string' && data.description.trim());
  const canonical = config.url + post.newPath;
  const doc = pageMetadata(read(post.newPath.slice(1) + 'index.html'), canonical, 'zh-CN', true);
  assert.equal(doc.ld[0].datePublished, moment.tz(post.date, 'YYYY-MM-DD HH:mm:ss', true, config.timezone).toISOString());
  assert.equal(new Set(doc.ids).size, doc.ids.length, `${post.post}: no duplicate IDs`);
  docs.set(post.title, doc);
}
for (const alias of aliases) compatibility(read(alias.from.slice(1) + 'index.html'), config.url + alias.to, config.url + alias.from);
const urls = discovery(publicDir, config.url, aliases);
for (const post of history.posts) assert.ok(urls.includes(config.url + post.newPath));
const routes = new Set(fs.readdirSync(publicDir, { recursive: true }).filter(route => fs.statSync(path.join(publicDir, route)).isFile()));
const htmlDocs = new Map([...routes].filter(route => route.endsWith('.html')).map(route => [route, document(read(route))]));
let localLinks = 0;
let fragments = 0;
for (const [route, doc] of htmlDocs) {
  if (aliasRoutes.has(route)) continue;
  for (const node of [...doc.tags('a'), ...doc.tags('img'), ...doc.tags('script'), ...doc.tags('link')]) {
    const attrs = doc.attrs(node);
    const href = attrs.href || attrs.src;
    if (!href) continue;
    const url = new URL(href, doc.canonical[0] || config.url + '/' + route);
    if (url.origin !== new URL(config.url).origin || !['http:', 'https:'].includes(url.protocol)) continue;
    assert.ok(!aliasPaths.has(url.pathname), `${route}: internal link points directly to a new address (${href})`);
    const filename = decodeURIComponent(url.pathname).replace(/^\//, '');
    const target = routes.has(filename) ? filename : filename.replace(/\/$/, '') + (filename ? '/' : '') + 'index.html';
    assert.ok(routes.has(target), `${route}: local target exists (${href})`);
    localLinks++;
    if (htmlDocs.has(target) && !aliasRoutes.has(target) && htmlDocs.get(target).canonical.length) {
      const canonical = new URL(htmlDocs.get(target).canonical[0]);
      assert.equal(url.pathname, canonical.pathname, `${route}: formal page link uses its canonical path (${href})`);
    }
    if (url.hash && htmlDocs.has(target)) {
      const id = decodeURIComponent(url.hash.slice(1));
      if (id) {
        assert.ok(htmlDocs.get(target).ids.includes(id), `${route}: fragment exists (${href})`);
        fragments++;
      }
    }
  }
}
// These seven malformed course URLs were never found in either published
// artifact. They must not become compatibility pages by accidental inference.
for (let i = 2; i <= 8; i++) assert.ok(!routes.has(`2026/08/27/2026-08-28-${i}/index.html`));
const index = document(read('2026/08/27/media-course-00-index/index.html'));
const courseLinks = index.tags('a').map(index.attrs).map(attrs => attrs.href).filter(href => /\/media-course-\d{2}-/.test(href || ''));
for (const post of history.posts.filter(post => /^2026-08-(27|28)-/.test(post.post) && post.post !== '2026-08-27-1.md')) {
  assert.ok(courseLinks.includes(post.newPath), `course index links directly to ${post.post}`);
}

// Production feed keeps its existing limit. A temporary real-content site
// includes all articles so even older migrated entries are cross-checked.
const files = { 'migrations/redirects.json': JSON.stringify(aliases) };
for (const file of ['01-plain.md', '02-tag.md', '03-category.md', '04-both.md', '05-blocked.md', '06-ignored.md']) files['source/_posts/' + file] = null;
for (const file of posts) files['source/_posts/' + file] = source(file);
withSite({ blogScripts: true, config: {
  url: config.url, language: 'zh-CN', author: config.author, timezone: config.timezone,
  updated_option: 'empty', feed: { type: 'atom', path: 'atom.xml', limit: 0 }
}, files }, (dir, result) => {
  assert.equal(result.status, 0, result.stdout + result.stderr);
  const xml = fs.readFileSync(path.join(dir, 'public/atom.xml'), 'utf8');
  assert.equal(XMLValidator.validate(xml), true);
  const entries = [].concat(new XMLParser({ ignoreAttributes: false, parseTagValue: false }).parse(xml).feed.entry || []);
  assert.equal(entries.length, posts.length, 'every real article can enter the feed');
  for (const entry of entries) {
    const doc = docs.get(entry.title);
    assert.ok(doc, 'no compatibility pages or fabricated articles enter Atom');
    assert.equal(entry.id, doc.canonical[0]); assert.equal(entry.link['@_href'], entry.id);
    assert.equal(entry.author.name, doc.ld[0].author.name);
    assert.equal(entry.published, doc.ld[0].datePublished);
    assert.equal(entry.updated, entry.published);
    assert.equal(entry.summary, doc.ld[0].description);
  }
});
console.log(`ok ${posts.length} migrated articles, ${aliases.length} historical redirects, ${urls.length} formal discovery URLs, ${localLinks} local links, ${fragments} fragments and all-article Atom`);
