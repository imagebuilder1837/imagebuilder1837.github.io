'use strict';

// Run after verification.js generates the real blog. Taxonomy meaning remains
// editorial: tests compare generated membership to current source metadata,
// never impose tag counts, first-tag agreement or a permanent category roster.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const yaml = require('js-yaml');
const { parse } = require('hexo-front-matter');
const { imageSize } = require('image-size');
const { document, pagination } = require('./helpers/html');

const site = path.resolve(__dirname, '..');
const config = yaml.load(fs.readFileSync(path.join(site, '_config.yml'), 'utf8'));
const publicDir = path.join(site, 'public');
const read = route => fs.readFileSync(path.join(publicDir, route), 'utf8');
for (const [route, title] of [['archives', '归档'], ['categories', '分类'], ['tags', '标签'], ['about', '关于']]) {
  const doc = document(read(`${route}/index.html`));
  assert.deepEqual(doc.tags('title').map(doc.text), [`${title} | ${config.title}`], `${route}: Chinese page title`);
  assert.deepEqual(doc.tags('h1').map(doc.text), [route === 'about' ? 'About' : title], `${route}: heading`);
  assert.deepEqual(doc.meta('og:title'), [title], `${route}: Chinese sharing title`);
}
const posts = fs.readdirSync(path.join(site, 'source/_posts')).filter(file => file.endsWith('.md'))
  .map(file => parse(fs.readFileSync(path.join(site, 'source/_posts', file), 'utf8')));
const titleSet = new Set(posts.map(post => post.title));
const titleLinks = doc => doc.tags('a').map(doc.text).map(text => text.trim()).filter(title => titleSet.has(title));
const groups = new Map();
for (const post of posts) {
  assert.ok(typeof post.categories === 'string' && post.categories.trim(), 'one scalar category per article');
  if (!groups.has(post.categories)) groups.set(post.categories, []);
  groups.get(post.categories).push(post.title);
}
const overview = document(read('categories/index.html'));
assert.deepEqual(new Set(titleLinks(overview)), titleSet, 'complete category overview');
assert.equal(titleLinks(overview).length, posts.length, 'no duplicate category entries');
assert.deepEqual(new Set(titleLinks(document(read('archives/index.html')))), titleSet, 'complete archive');
for (const [category, titles] of groups) {
  const doc = document(read(`${config.category_dir}/${category}/index.html`));
  assert.deepEqual(new Set(titleLinks(doc)), new Set(titles), `${category}: membership matches source`);
}
const paginated = [];
for (let i = 1; i <= Math.ceil(posts.length / 12); i++) {
  const route = i === 1 ? 'index.html' : `page/${i}/index.html`;
  const doc = document(read(route));
  pagination(doc, i, Math.ceil(posts.length / 12));
  const titles = titleLinks(doc);
  assert.equal(titles.length, Math.min(12, posts.length - (i - 1) * 12), route);
  paginated.push(...titles);
  const covers = doc.tags('img').map(doc.attrs);
  covers.forEach((img, index) => {
    assert.equal(img.alt, '');
    assert.equal(img.loading, index >= 2 ? 'lazy' : undefined);
  });
  if (i < Math.ceil(posts.length / 12)) assert.ok(doc.tags('a').some(node => doc.attrs(node).href === `/page/${i + 1}/`));
}
assert.equal(paginated.length, posts.length);
assert.deepEqual(new Set(paginated), titleSet, 'every article appears on exactly one home page');
const home = document(read('index.html'));
assert.deepEqual(home.tags('a').filter(node => (home.attrs(node).class || '').split(' ').includes('nav-menu')).map(home.text),
  ['HOME', 'ARCHIVE', 'CATEGORY', 'TAG', 'ABOUT'], 'blog menu display order');
for (const href of ['/', '/archives/', '/categories/', '/tags/', '/about/']) {
  assert.ok(home.tags('a').some(node => docHref(home, node) === href && (home.attrs(node).class || '').split(' ').includes('nav-menu')), `canonical menu ${href}`);
}
function docHref(doc, node) { return doc.attrs(node).href || ''; }

let images = 0;
let blocks = 0;
for (const route of fs.readdirSync(publicDir, { recursive: true }).filter(route => route.endsWith('.html'))) {
  if (route.startsWith('google')) continue;
  const doc = document(read(route));
  for (const node of [...doc.tags('script'), ...doc.tags('link')]) {
    const attrs = doc.attrs(node);
    assert.ok(!/bootcss|highlight\.min\.(?:js|css)/.test(attrs.src || attrs.href || ''), 'old runtime resources removed');
  }
  for (const img of doc.tags('img').map(doc.attrs)) {
    const url = new URL(img.src, config.url);
    if (url.origin !== new URL(config.url).origin) continue;
    const filename = path.join(site, 'source', decodeURIComponent(url.pathname));
    assert.ok(fs.existsSync(filename), `local image exists: ${img.src}`);
    const size = imageSize(fs.readFileSync(filename));
    assert.equal(Number(img.width), size.width, `${img.src}: true width`);
    assert.equal(Number(img.height), size.height, `${img.src}: true height`);
    images++;
  }
  if (doc.ld.length) {
    const bodyImages = doc.tags('img').map(doc.attrs);
    bodyImages.forEach((img, index) => assert.equal(img.loading, index > 0 ? 'lazy' : undefined));
    assert.ok(doc.tags('script').some(node => doc.attrs(node).src === '/js/code-copy.js'), 'local copy enhancement enabled');
    assert.equal(doc.tags('td').filter(node => doc.attrs(node).class === 'gutter').length, 0, 'no line-number gutter');
    blocks += doc.tags('pre').length;
  }
}
assert.ok(images > 0 && blocks > 0);
assert.match(read('css/index.css'), /hljs-keyword/);
assert.ok(fs.existsSync(path.join(publicDir, 'js/code-copy.js')));
console.log(`ok ${posts.length} blog articles: category counts ${JSON.stringify(Object.fromEntries([...groups].map(([name, titles]) => [name, titles.length])))}, home pagination, ${images} image placements and ${blocks} code blocks`);
