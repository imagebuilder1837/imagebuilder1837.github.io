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
  const ids = nodes.map(node => attrs(node).id).filter(Boolean);
  return { attrs, text, tags, meta, canonical, ld, ids };
}

function pageMetadata(html, url, language, article = false) {
  const doc = document(html);
  assert.deepEqual(doc.canonical, [url], 'one self-canonical');
  assert.deepEqual(doc.meta('og:url'), [url], 'OG matches canonical');
  assert.equal(doc.attrs(doc.tags('html')[0]).lang, language);
  assert.equal(doc.tags('h1').length, 1, 'one page H1');
  assert.equal(doc.ld.length, article ? 1 : 0, 'BlogPosting only on articles');
  if (article) {
    assert.equal(doc.ld[0]['@type'], 'BlogPosting');
    assert.equal(doc.ld[0].url, url);
    assert.equal(doc.ld[0].mainEntityOfPage, url);
    assert.equal(doc.ld[0].inLanguage, language);
  }
  return doc;
}

function pagination(doc, current, total, root = '/') {
  const nav = doc.tags('nav').find(node => doc.attrs(node).class === 'pagination');
  if (total === 1) return assert.equal(nav, undefined);
  assert.ok(nav, 'pagination navigation exists');
  assert.ok(!doc.text(nav).includes('<span'), 'arrow markup is not displayed as text');
  for (const [direction, target, visible] of [
    ['prev', current - 1, current > 1], ['next', current + 1, current < total]
  ]) {
    const link = doc.tags('a').find(node => node.parentNode === nav && doc.attrs(node).rel === direction);
    if (!visible) {
      assert.equal(link, undefined, `${direction}: absent at boundary`);
      continue;
    }
    assert.ok(link, `${direction}: navigation exists`);
    assert.equal(doc.attrs(link).href, root + (target === 1 ? '' : `page/${target}/`));
    const icon = link.childNodes.find(node => node.tagName === 'span');
    assert.ok(icon, `${direction}: actual arrow element`);
    assert.equal(doc.attrs(icon).class, `iconfont icon-arrow-${direction === 'prev' ? 'left' : 'right'}`);
  }
}

module.exports = { document, pageMetadata, pagination };
