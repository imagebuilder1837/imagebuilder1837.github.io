'use strict';

// Run after verification.js has cleanly generated the real blog. This checks
// Metadata plus #15's objective, non-empty description gate. URL migration
// and discovery are checked by blog-migration.js.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { parse } = require('hexo-front-matter');
const { stripHTML, unescapeHTML } = require('hexo-util');
const yaml = require('js-yaml');
const moment = require('moment-timezone');
const { XMLParser, XMLValidator } = require('fast-xml-parser');
const { document, pageMetadata } = require('./helpers/html');

const site = path.resolve(__dirname, '..');
const publicDir = path.join(site, 'public');
const config = yaml.load(fs.readFileSync(path.join(site, '_config.yml'), 'utf8'));
const originals = fs.readdirSync(path.join(site, 'source', '_posts')).filter(file => file.endsWith('.md'))
  .map(file => {
    const raw = fs.readFileSync(path.join(site, 'source', '_posts', file), 'utf8');
    // Front-matter YAML dates otherwise inherit the machine timezone. Public
    // dates follow the site's timezone, including on UTC CI runners.
    const dateText = raw.match(/^date: (.+)$/m)?.[1];
    const published = moment.tz(dateText, 'YYYY-MM-DD HH:mm:ss', true, config.timezone).toISOString();
    assert.ok(published, `${file}: valid publication date`);
    return { file, data: parse(raw), published };
  });
const generated = new Map();
for (const route of fs.readdirSync(publicDir, { recursive: true }).filter(route => route.endsWith('.html'))) {
  if (route === 'google17db084228384126.html') continue;
  const html = fs.readFileSync(path.join(publicDir, route), 'utf8');
  const doc = document(html);
  if (doc.ld.length) generated.set(doc.ld[0].headline, { html, doc });
}
assert.equal(generated.size, originals.length, 'every real article gets BlogPosting');
for (const { file, data, published } of originals) {
  // Summary meaning remains editorial; description must exist independently
  // of the card excerpt. No length or keyword-count threshold is imposed.
  assert.ok(typeof data.description === 'string' && data.description.trim(), `${file}: non-empty description`);
  const plain = value => typeof value === 'string' ? unescapeHTML(stripHTML(value)).replace(/\s+/g, ' ').trim() : '';
  const summary = plain(data.description) || plain(data.excerpt);
  const entry = generated.get(data.title);
  assert.ok(entry, `${file}: generated article`);
  const doc = pageMetadata(entry.html, entry.doc.canonical[0], 'zh-CN', true);
  assert.ok(doc.canonical[0].startsWith(config.url + '/') && doc.canonical[0].endsWith('/'));
  assert.ok(!doc.canonical[0].endsWith('/index.html/'));
  assert.equal(doc.text(doc.tags('h1')[0]), data.title);
  assert.deepEqual(doc.meta('description'), summary ? [summary] : []);
  assert.deepEqual(doc.meta('og:description'), summary ? [summary] : []);
  assert.equal(doc.ld[0].description, summary || undefined);
  const course = /^2026-08-(27|28)-/.test(file);
  const reprint = ['2026-08-17-1.md', '2026-09-29-1.md'].includes(file);
  const translated = file === '2026-03-14-1.md';
  const expectedAuthor = course || reprint ? '马前卒' : translated ? 'Graham Duncan' : config.author;
  assert.equal(doc.ld[0].author.name, expectedAuthor, `${file}: real author`);
  assert.deepEqual(doc.meta('article:author'), [expectedAuthor]);
  if (!course && !reprint && !translated) assert.equal(data.author, undefined, 'original authors remain default');
  const source = course ? 'https://www.bilibili.com/cheese/play/ep229829' : reprint ? 'https://wx.zsxq.com/group/88888851184282' : translated ? 'https://grahamduncan.blog/whats-going-on-here/' : undefined;
  assert.equal(data.source_url, source);
  assert.equal(doc.ld[0].isBasedOn, source);
  assert.ok(!('url' in doc.ld[0].author));
  assert.equal(doc.ld[0].datePublished, published);
  assert.equal(data.updated, undefined, 'metadata cleanup does not invent revisions');
  assert.ok(!('dateModified' in doc.ld[0]));
  assert.deepEqual(doc.meta('article:modified_time'), []);
  assert.equal(doc.ld[0].image.length, Array.isArray(data.photos) ? data.photos.length : 1);
  assert.deepEqual(doc.meta('og:image'), doc.ld[0].image);
  for (const image of doc.ld[0].image) assert.ok(/^https?:\/\//.test(image) && !image.endsWith('/'));
  if (course && file !== '2026-08-27-1.md') {
    const content = doc.tags('article').find(node => doc.attrs(node).class === 'content');
    const children = content.childNodes.filter(node => node.tagName);
    assert.equal(children[0].tagName, 'p', 'course source declaration stays first');
    assert.equal(children[1].tagName, 'hr', 'course title replaced by Markdown separator');
  }
}

const xml = fs.readFileSync(path.join(publicDir, config.feed.path), 'utf8');
assert.equal(XMLValidator.validate(xml), true);
const feed = new XMLParser({ ignoreAttributes: false, parseTagValue: false }).parse(xml).feed;
const entries = Array.isArray(feed.entry) ? feed.entry : [feed.entry];
const selected = [...originals].sort((a, b) => b.data.date - a.data.date).slice(0, config.feed.limit || originals.length);
assert.deepEqual(new Set(entries.map(entry => entry.title)), new Set(selected.map(post => post.data.title)), 'configured feed selection');
for (const entry of entries) {
  const { doc } = generated.get(entry.title);
  assert.equal(entry.author.name, doc.ld[0].author.name);
  assert.equal(entry.summary || '', doc.ld[0].description || '');
  assert.equal(entry.id, doc.canonical[0]);
  assert.equal(entry.link['@_href'], entry.id);
  assert.equal(entry.published, doc.ld[0].datePublished);
  assert.equal(entry.updated, entry.published, 'Atom fallback is publication, not an asserted revision');
}
for (const route of ['index.html', 'about/index.html', 'archives/index.html', 'tags/index.html', 'categories/index.html']) {
  const url = config.url + '/' + route.replace(/index\.html$/, '');
  const doc = pageMetadata(fs.readFileSync(path.join(publicDir, route), 'utf8'), url, 'zh-CN');
  if (route === 'about/index.html') {
    assert.equal(doc.text(doc.tags('h1')[0]), 'About');
    assert.equal(doc.attrs(doc.tags('h1')[0].parentNode).class, 'content', 'About H1 is rendered from source Markdown');
    assert.deepEqual(doc.meta('og:title'), ['About']);
    assert.equal(doc.text(doc.tags('title')[0]), `About | ${config.title}`);
  }
}
console.log(`ok ${originals.length} blog article metadata, course separators and ${entries.length} Atom entries`);
