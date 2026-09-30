'use strict';

const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');

// Read Hexo's current published collection, including its date/timezone and
// permalink processing. Neither migration evidence nor directory inventories
// define which articles are published today.
function currentPosts(dir) {
  const marker = '\nCURRENT_POSTS:';
  const script = `
const Hexo = require('hexo');
const { parse } = require('hexo-front-matter');
const hexo = new Hexo(process.cwd(), { silent: true });
hexo.init().then(() => hexo.load()).then(() => {
  const posts = hexo.locals.get('posts').sort(hexo.config.feed?.order_by || '-date').toArray()
    .filter(post => post.published !== false && post.draft !== true)
    .map(post => ({
      source: post.source, title: post.title, permalink: post.permalink,
      date: post.date.toISOString(), updated: post.updated?.toISOString(),
      revision: Boolean(parse(post.raw).updated), author: post.author,
      description: post.description, excerpt: post.excerpt, photos: post.photos,
      source_url: post.source_url, lang: post.lang, language: post.language
    }));
  process.stdout.write(${JSON.stringify(marker)} + JSON.stringify({ config: hexo.config, posts }));
  return hexo.exit();
}).catch(error => { console.error(error); process.exit(1); });
`;
  const result = spawnSync(process.execPath, ['-e', script], {
    cwd: dir, encoding: 'utf8', maxBuffer: 20 * 1024 * 1024
  });
  assert.equal(result.status, 0, result.stdout + result.stderr);
  const start = result.stdout.lastIndexOf(marker);
  assert.ok(start >= 0, 'Hexo exposes the current published collection');
  return JSON.parse(result.stdout.slice(start + marker.length));
}

module.exports = { currentPosts };
