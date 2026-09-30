'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { withSite } = require('./helpers/site');
const { document } = require('./helpers/html');

const menu = html => {
  const doc = document(html);
  return doc.tags('a').filter(node => (doc.attrs(node).class || '').split(' ').includes('nav-menu'))
    .map(node => ({ label: doc.text(node), href: doc.attrs(node).href }));
};
withSite({ config: { theme_config: {
  menu: { Home: '/', Archive: '/archives', Topics: { path: '/categories', card: 'article-card' }, Tag: '/tags', About: '/about', Empty: '' }
} } }, (dir, result) => {
  assert.equal(result.status, 0, result.stdout + result.stderr);
  for (const route of ['index.html', 'archives/index.html', '2024/01/01/01-plain/index.html']) {
    const links = menu(fs.readFileSync(path.join(dir, 'public', route), 'utf8'));
    assert.deepEqual(links.map(link => link.label), ['HOME', 'ARCHIVE', 'TOPICS', 'TAG', 'ABOUT'], `${route}: declared menu order survives configuration merging`);
    assert.equal(links[2].href, '/categories', 'object-form menu path preserved');
  }
});
withSite({ config: { theme_config: {
  menu: { Tag: '/tags', Extra: '/extra', Disabled: null }
} } }, (dir, result) => {
  assert.equal(result.status, 0, result.stdout + result.stderr);
  const links = menu(fs.readFileSync(path.join(dir, 'public/index.html'), 'utf8'));
  assert.deepEqual(links.map(link => link.label), ['TAG', 'EXTRA', 'HOME', 'ARCHIVE', 'ABOUT'], 'declared entries come first; inherited entries retain relative order');
});
withSite({}, (dir, result) => {
  assert.equal(result.status, 0, result.stdout + result.stderr);
  assert.deepEqual(menu(fs.readFileSync(path.join(dir, 'public/index.html'), 'utf8')).map(link => link.label), ['HOME', 'ARCHIVE', 'TAG', 'ABOUT'], 'default menu unchanged');
});
console.log('ok menu ordering with merged defaults, object paths, disabled and unlisted entries');
