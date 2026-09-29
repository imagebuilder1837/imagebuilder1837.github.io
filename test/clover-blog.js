'use strict';

// Run after `npm run clean && npm run build` to verify site-owned overrides.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const publicDir = path.resolve(__dirname, '..', 'public');
const home = fs.readFileSync(path.join(publicDir, 'index.html'), 'utf8');
const expectedSocial = [
  'https://bgm.tv/user/imagebuilder183',
  'https://github.com/imagebuilder1837',
  'https://www.zhihu.com/people/imagebuilder1837',
  'https://space.bilibili.com/366719977',
  '/atom.xml'
];
const expectedMenu = ['/', '/archives', '/tags', '/about'];
const links = (html, className) => [...html.matchAll(new RegExp(`<a href="([^"]+)"[^>]*class="${className}(?: |")`, 'g'))]
  .map(match => match[1]);
assert.deepEqual(links(home, 'nav-icn'), [...expectedSocial, ...expectedSocial], 'nav and footer social links');
assert.deepEqual(links(home, 'nav-menu'), expectedMenu, 'menu links and order');
assert.ok(home.includes('mailto:imagebuilder1837@outlook.com'));
assert.ok(home.includes('CC BY-NC-SA 4.0'));
assert.equal((home.match(/class="project-card"/g) || []).length, 38, 'unfiltered home page');

function* htmlPages(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const file = path.join(dir, entry.name);
    if (entry.isDirectory()) yield* htmlPages(file);
    else if (entry.name.endsWith('.html')) yield file;
  }
}
const pages = [...htmlPages(publicDir)];
assert.equal(pages.length, 88, 'page routes changed from the pre-migration baseline');
for (const route of ['archives/index.html', 'tags/index.html', 'categories/index.html', 'about/index.html']) {
  assert.ok(fs.existsSync(path.join(publicDir, route)), `missing route: ${route}`);
}
for (const file of pages) {
  const html = fs.readFileSync(file, 'utf8');
  assert.ok(!html.includes('example.com'), `example URL leaked into ${file}`);
  assert.ok(!html.includes('cloverTuan') && !html.includes('clovertuan'), `upstream identity leaked into ${file}`);
}
console.log(`ok Clover blog: ${pages.length} pages, 38 unfiltered posts, owned social and menu links`);
