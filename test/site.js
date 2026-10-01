'use strict';

// File-level smoke check of the single build produced by npm test.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { parse } = require('parse5');
const yaml = require('js-yaml');

const site = path.resolve(__dirname, '..');
const config = yaml.load(fs.readFileSync(path.join(site, '_config.yml'), 'utf8'));
const publicDir = path.resolve(site, config.public_dir || 'public');
const base = new URL(config.url.replace(/\/?$/, '/'));
const files = new Map();
for (const route of fs.readdirSync(publicDir, { recursive: true })) {
  const stat = fs.statSync(path.join(publicDir, route));
  if (stat.isFile()) files.set(route.split(path.sep).join('/'), stat.size);
}

function requireFile(route, context) {
  assert.ok(files.has(route), `${context}: missing ${route}`);
  assert.ok(files.get(route) > 0, `${context}: empty ${route}`);
}

requireFile('index.html', 'Homepage');
let articles = 0;
let stylesheets = 0;
let localLinks = 0;
for (const route of files.keys()) {
  if (!route.endsWith('.html')) continue;
  const doc = parse(fs.readFileSync(path.join(publicDir, route), 'utf8'));
  const pageURL = new URL(route, base);
  function walk(node) {
    const attrs = Object.fromEntries((node.attrs || []).map(attr => [attr.name, attr.value]));
    if (node.tagName === 'body' && attrs['data-layout'] === 'post') {
      requireFile(route, 'Article');
      articles++;
    }
    if (['a', 'img', 'script', 'link'].includes(node.tagName)) {
      const href = attrs.href || attrs.src;
      if (href) {
        const url = new URL(href, pageURL);
        if (url.origin === base.origin && ['http:', 'https:'].includes(url.protocol)) {
          const filename = decodeURIComponent(url.pathname).replace(/^\//, '');
          const index = path.posix.join(filename, 'index.html');
          const target = files.has(filename) ? filename
            : files.has(index) || url.pathname.endsWith('/') ? index : filename;
          requireFile(target, `${route}: ${href}`);
          localLinks++;
          if (route === 'index.html' && node.tagName === 'link' && attrs.rel === 'stylesheet') {
            stylesheets++;
          }
        }
      }
    }
    for (const child of node.childNodes || []) walk(child);
  }
  walk(doc);
}
assert.ok(articles > 0, 'At least one article was generated');
assert.ok(stylesheets > 0, 'Homepage links to a local stylesheet');
console.log(`Checked homepage, ${articles} articles and ${localLinks} local file targets.`);
