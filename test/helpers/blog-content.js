'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { stripHTML, unescapeHTML } = require('hexo-util');
const { XMLParser, XMLValidator } = require('fast-xml-parser');
const { document, pageMetadata } = require('./html');
const { currentPosts } = require('./current-posts');

const plain = value => typeof value === 'string' ? unescapeHTML(stripHTML(value)).replace(/\s+/g, ' ').trim() : '';
const absolute = (value, config) => {
  if (typeof value !== 'string' || !value.trim()) return undefined;
  const url = new URL(value.trim(), config.url.replace(/\/$/, '') + '/');
  return ['http:', 'https:'].includes(url.protocol) ? url.href : undefined;
};
const language = (post, config) => {
  for (const value of [post.lang, post.language, ...[].concat(config.language)]) {
    if (!value || value === 'default') continue;
    try { return Intl.getCanonicalLocales(value.replace(/_/g, '-'))[0]; } catch { /* Skip invalid site defaults. */ }
  }
  return 'en';
};

function verifyBlogContent(dir) {
  const { config, posts } = currentPosts(dir);
  const publicDir = path.join(dir, 'public');
  const generated = new Map();
  for (const route of fs.readdirSync(publicDir, { recursive: true }).filter(route => route.endsWith('.html'))) {
    const html = fs.readFileSync(path.join(publicDir, route), 'utf8');
    const doc = document(html);
    if (!doc.ld.some(item => item['@type'] === 'BlogPosting')) continue;
    assert.ok(!generated.has(doc.canonical[0]), 'article canonical URLs are unique');
    generated.set(doc.canonical[0], { html, doc });
  }
  assert.equal(generated.size, posts.length, 'every current published article gets BlogPosting');
  for (const post of posts) {
    assert.ok(typeof post.description === 'string' && post.description.trim(), `${post.source}: non-empty independent description`);
    const url = new URL(post.permalink);
    url.search = ''; url.hash = '';
    url.pathname = url.pathname.replace(/\/index\.html$/i, '/');
    if (!url.pathname.endsWith('/')) url.pathname += '/';
    const entry = generated.get(url.href);
    assert.ok(entry, `${post.source}: generated article`);
    const doc = pageMetadata(entry.html, url.href, language(post, config), true);
    assert.equal(new Set(doc.ids).size, doc.ids.length, `${post.source}: no duplicate IDs`);
    assert.equal(doc.text(doc.tags('h1')[0]), post.title);
    const summary = plain(post.description) || plain(post.excerpt);
    assert.deepEqual(doc.meta('description'), [summary]);
    assert.deepEqual(doc.meta('og:description'), [summary]);
    assert.equal(doc.ld[0].description, summary);
    const author = post.author === false ? undefined : (post.author ?? config.author)?.trim() || undefined;
    assert.equal(doc.ld[0].author?.name, author, `${post.source}: declared or default author`);
    assert.deepEqual(doc.meta('article:author'), author ? [author] : []);
    if (author) assert.ok(!('url' in doc.ld[0].author), 'source is not an author homepage');
    assert.equal(doc.ld[0].isBasedOn, absolute(post.source_url, config));
    assert.equal(doc.ld[0].datePublished, post.date);
    const modified = post.revision ? post.updated : undefined;
    assert.equal(doc.ld[0].dateModified, modified);
    assert.deepEqual(doc.meta('article:modified_time'), modified ? [modified] : []);
    const photos = Array.isArray(post.photos) ? post.photos : post.photos ? [post.photos] : [];
    const images = photos.map(value => absolute(value, config)).filter(Boolean);
    assert.deepEqual(doc.ld[0].image || [], images);
    assert.deepEqual(doc.meta('og:image'), images);
  }

  const types = [].concat(config.feed?.type || []);
  if (config.feed?.enable !== false && types.includes('atom')) {
    const feedPath = Array.isArray(config.feed.path) ? config.feed.path[types.indexOf('atom')] : config.feed.path || 'atom.xml';
    const xml = fs.readFileSync(path.join(publicDir, feedPath), 'utf8');
    assert.equal(XMLValidator.validate(xml), true);
    const feed = new XMLParser({ ignoreAttributes: false, parseTagValue: false }).parse(xml).feed;
    const entries = [].concat(feed.entry || []);
    const eligible = posts.filter(post => post.author !== false);
    const selected = config.feed.limit ? eligible.slice(0, config.feed.limit) : eligible;
    assert.deepEqual(entries.map(entry => entry.id), selected.map(post => {
      const url = new URL(post.permalink);
      url.search = ''; url.hash = '';
      url.pathname = url.pathname.replace(/\/index\.html$/i, '/');
      if (!url.pathname.endsWith('/')) url.pathname += '/';
      return url.href;
    }), 'current feed selection: configured order, filtering, then limit');
    for (const entry of entries) {
      const { doc } = generated.get(entry.id);
      assert.equal(entry.author.name, doc.ld[0].author.name);
      assert.equal(entry.summary || '', doc.ld[0].description || '');
      assert.equal(entry.link['@_href'], entry.id);
      assert.equal(entry.published, doc.ld[0].datePublished);
      assert.equal(entry.updated, doc.ld[0].dateModified || entry.published);
    }
    assert.ok(Number.isFinite(Date.parse(feed.updated)), 'feed has a valid updated timestamp');
    if (entries.length) assert.equal(feed.updated, entries.map(entry => entry.updated).sort().at(-1));
    console.log(`ok ${posts.length} current blog articles and ${entries.length} Atom entries`);
  }
  return { config, posts };
}

module.exports = { verifyBlogContent };
