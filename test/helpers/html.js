'use strict';

const assert = require('node:assert/strict');
const { parse } = require('parse5');

function document(html) {
  const nodes = [];
  function walk(node) {
    nodes.push(node);
    for (const child of node.childNodes || []) walk(child);
  }
  walk(parse(html));
  const attrs = node => Object.fromEntries((node.attrs || []).map(attr => [attr.name, attr.value]));
  const text = node => node.nodeName === '#text' ? node.value : (node.childNodes || []).map(text).join('');
  const tags = name => nodes.filter(node => node.tagName === name);
  const meta = name => tags('meta').filter(node => attrs(node).property === name || attrs(node).name === name).map(node => attrs(node).content);
  const canonical = tags('link').filter(node => attrs(node).rel === 'canonical').map(node => attrs(node).href);
  const ld = tags('script').filter(node => attrs(node).type === 'application/ld+json').map(node => JSON.parse(text(node)));
  return { attrs, text, tags, meta, canonical, ld };
}

function pageMetadata(html, url, language, article = false) {
  const doc = document(html);
  assert.deepEqual(doc.canonical, [url], 'one self-canonical');
  assert.deepEqual(doc.meta('og:url'), [url], 'OG matches canonical');
  assert.equal(doc.attrs(doc.tags('html')[0]).lang, language);
  assert.equal(doc.tags('h1').length, 1, 'one template H1');
  assert.equal(doc.ld.length, article ? 1 : 0, 'BlogPosting only on articles');
  if (article) {
    assert.equal(doc.ld[0]['@type'], 'BlogPosting');
    assert.equal(doc.ld[0].url, url);
    assert.equal(doc.ld[0].mainEntityOfPage, url);
    assert.equal(doc.ld[0].inLanguage, language);
  }
  return doc;
}

module.exports = { document, pageMetadata };
