'use strict';

// Site-owned history and discovery. Run after every generator has registered
// its routes, so validation never depends on generator execution order.
const fs = require('node:fs');
const path = require('node:path');
const { parse } = require('parse5');
const { escapeHTML, full_url_for } = require('hexo-util');

const mapFile = path.join(hexo.base_dir, 'migrations', 'redirects.json');
const directoryPath = value => typeof value === 'string' && /^\/(?:[a-zA-Z0-9_-]+\/)+$/.test(value);
const routeFor = value => value.slice(1) + 'index.html';
const absolute = route => new URL(full_url_for.call({ config: hexo.config }, route)).href;
const expectedCanonical = route => absolute(route.replace(/index\.html$/, ''));
const xmlEscape = value => value.replace(/[&<>"']/g, char => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;'
})[char]);

function metadata(html) {
  const canonicals = [];
  let headings = 0;
  function walk(node) {
    const attrs = Object.fromEntries((node.attrs || []).map(attr => [attr.name, attr.value]));
    if (node.tagName === 'link' && attrs.rel === 'canonical') canonicals.push(attrs.href);
    if (node.tagName === 'h1') headings++;
    for (const child of node.childNodes || []) walk(child);
  }
  walk(parse(html));
  return { canonicals, headings };
}

async function readRoute(route) {
  const chunks = [];
  for await (const chunk of hexo.route.get(route)) chunks.push(Buffer.from(chunk));
  return Buffer.concat(chunks).toString('utf8');
}

function compatibilityPage(target) {
  const canonical = escapeHTML(target);
  // Root-relative navigation keeps previews on their current origin and
  // retains the configured site root. Only canonical uses the public domain.
  const navigationPath = new URL(target).pathname;
  const attr = escapeHTML(navigationPath);
  // JS preserves query parameters, not historical fragments.
  const json = JSON.stringify(navigationPath).replace(/</g, '\\u003c');
  return `<!doctype html>
<html lang="${escapeHTML(String(hexo.config.language || 'en'))}">
<head>
<meta charset="utf-8">
<title>文章地址已迁移</title>
<meta http-equiv="refresh" content="0; url=${attr}">
<link rel="canonical" href="${canonical}">
<script>location.replace(${json}+location.search);</script>
</head>
<body><p>文章地址已迁移：<a href="${attr}">继续阅读</a>。</p></body>
</html>\n`;
}

hexo.extend.filter.register('after_generate', async function () {
  const aliases = JSON.parse(fs.readFileSync(mapFile, 'utf8'));
  if (!Array.isArray(aliases)) throw new Error('Historical redirects must be an array');
  const routes = new Set(hexo.route.list());
  for (const reserved of ['sitemap.xml', 'robots.txt']) {
    if (routes.has(reserved)) throw new Error(`Discovery route collision: ${reserved}`);
  }
  const sources = new Set();
  for (const alias of aliases) {
    if (!alias || !directoryPath(alias.from) || !directoryPath(alias.to)) {
      throw new Error('Historical redirect paths must be safe absolute directory paths (no escapes, traversal, query or hash)');
    }
    if (sources.has(alias.from)) throw new Error(`Duplicate historical address: ${alias.from}`);
    sources.add(alias.from);
    if (alias.from === alias.to) throw new Error(`Self redirect: ${alias.from}`);
    const prefix = alias.from.slice(1);
    const ancestors = prefix.split('/').filter(Boolean).map((_, index, parts) => parts.slice(0, index + 1).join('/'));
    if ([...routes].some(route => route.startsWith(prefix) || ancestors.includes(route))) {
      throw new Error(`Historical address collides with a formal page or asset: ${alias.from}`);
    }
  }
  for (const alias of aliases) {
    if (sources.has(alias.to)) throw new Error(`Redirect chain or cycle: ${alias.from}`);
    if (!routes.has(routeFor(alias.to))) throw new Error(`Missing redirect target: ${alias.to}`);
  }

  // Directory HTML is formal by route, not by the metadata being validated.
  // Assets, standalone verification HTML and 404 are excluded; compatibility
  // pages are registered only after this validation.
  const pages = new Map();
  for (const route of [...routes].sort()) {
    if (!/(?:^|\/)index\.html$/.test(route) || /^404(?:\/|\.)/.test(route)) continue;
    const { canonicals, headings } = metadata(await readRoute(route));
    const expected = expectedCanonical(route);
    if (canonicals.length !== 1 || canonicals[0] !== expected || headings !== 1) {
      throw new Error(`Invalid discoverable page metadata: ${route}`);
    }
    pages.set(route, expected);
  }
  for (const alias of aliases) {
    if (!pages.has(routeFor(alias.to))) throw new Error(`Redirect target is not a formal page: ${alias.to}`);
  }

  // Validation completes before any new routes are registered.
  for (const alias of aliases) hexo.route.set(routeFor(alias.from), compatibilityPage(pages.get(routeFor(alias.to))));
  const urls = [...new Set(pages.values())].sort();
  hexo.route.set('sitemap.xml', '<?xml version="1.0" encoding="UTF-8"?>\n' +
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
    urls.map(url => `  <url><loc>${xmlEscape(url)}</loc></url>`).join('\n') + '\n</urlset>\n');
  hexo.route.set('robots.txt', `User-agent: *\nAllow: /\nSitemap: ${absolute('sitemap.xml')}\n`);
});
