'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { testSite } = require('./helpers/site');
const { document, pagination } = require('./helpers/html');

const highlight = { enable: true, line_number: false, auto_detect: false, wrap: false, hljs: true, strip_indent: false, tab_replace: '' };
const read = (dir, route) => fs.readFileSync(path.join(dir, 'public', route), 'utf8');
const cards = doc => doc.tags('a').filter(node => doc.attrs(node).class === 'title' && doc.attrs(node.parentNode).class === 'ctnWrap').map(doc.text);
const links = doc => doc.tags('a').map(node => doc.attrs(node).href);
const code = '  const text = "<tag> & value";\n\tconsole.log(text);';
const longLine = 'long line ' + 'x'.repeat(400);
const files = {};
for (let i = 0; i < 32; i++) {
  files[`source/_posts/sample-${i}.md`] = `---
title: Sample ${i}
date: 2025-01-01 00:00:00
photos: /images/example.webp
categories: Example
tags: Useful
---
${i === 0 ? `![](/images/example.webp)

![Author supplied text](/images/example.webp?version=1#image)

![](/images/missing.webp)

![](https://remote.invalid/example.webp)

<img src="/images/example.webp" alt="" width="10" height="5" loading="eager">

\`\`\`javascript
${code}
\`\`\`

\`\`\`not-a-language
${longLine}
\`\`\`

\`\`\`
const unmarked = 1;
\`\`\`` : 'Example body.'}`;
}

testSite('pagination, navigation, image dimensions, highlighting and styles', { files, config: {
  index_generator: { per_page: 12, order_by: '-date' },
  // Deliberately different: home must not determine archive/category behavior.
  per_page: 3,
  archive_generator: { per_page: 0 }, category_generator: { per_page: 0 },
  highlight,
  theme_config: { code_copy: true }
} }, (dir, result) => {
  assert.equal(result.status, 0, result.stdout + result.stderr);
  const seen = [];
  const routes = ['index.html', 'page/2/index.html', 'page/3/index.html', 'page/4/index.html'];
  for (const [i, route] of routes.entries()) {
    const html = read(dir, route);
    const doc = document(html);
    pagination(doc, i + 1, routes.length);
    const titles = cards(doc);
    assert.equal(titles.length, i === 3 ? 2 : 12, route);
    seen.push(...titles);
    for (const target of links(doc).filter(href => /^\/(?:page\/\d+\/)?$/.test(href))) {
      assert.ok(fs.existsSync(path.join(dir, 'public', target, 'index.html')), `reachable ${target}`);
    }
    if (i < 3) assert.ok(links(doc).includes(`/page/${i + 2}/`), 'next page link');
    const images = doc.tags('img');
    images.forEach((node, index) => {
      const attrs = doc.attrs(node);
      assert.equal(attrs.alt, '', 'covers remain decorative');
      assert.equal(attrs.width, '32'); assert.equal(attrs.height, '16');
      assert.equal(attrs.loading, index >= 2 ? 'lazy' : undefined);
    });
    assert.ok(!/bootcss|highlightBlock|highlight\.min\.js/.test(html));
    assert.ok(doc.tags('script').some(node => doc.attrs(node).src === '/js/code-copy.js' && 'defer' in doc.attrs(node)));
  }
  assert.equal(seen.length, 38);
  assert.equal(new Set(seen).size, 38, 'no omissions or duplicate articles');
  assert.ok(!fs.existsSync(path.join(dir, 'public/page/5/index.html')));
  const overview = document(read(dir, 'categories/index.html'));
  const archive = document(read(dir, 'archives/index.html'));
  for (const title of seen) {
    assert.ok(overview.tags('a').some(node => overview.text(node) === title), `overview includes ${title}`);
    assert.ok(archive.tags('a').some(node => archive.text(node).trim() === title), `archive includes ${title}`);
  }
  assert.equal(cards(document(read(dir, 'categories/Example/index.html'))).length, 32);
  assert.ok(!fs.existsSync(path.join(dir, 'public/categories/page/2/index.html')));
  assert.ok(!fs.existsSync(path.join(dir, 'public/categories/Example/page/2/index.html')));
  assert.ok(!fs.existsSync(path.join(dir, 'public/archives/page/2/index.html')));
  const article = document(read(dir, '2025/01/01/sample-0/index.html'));
  const allImages = article.tags('img');
  const cover = allImages[0];
  assert.deepEqual(article.attrs(cover), {
    class: 'cover', src: '/images/example.webp', alt: '', width: '32', height: '16', loading: 'eager'
  });
  const section = cover.parentNode;
  assert.deepEqual(section.childNodes.filter(node => node.tagName).slice(0, 4).map(node => node.tagName), ['img', 'h1', 'p', 'article'], 'cover precedes the title and body');
  const images = allImages.slice(1).map(article.attrs);
  assert.deepEqual(images.slice(0, 2).map(img => [img.width, img.height, img.loading, img.alt]), [
    ['32', '16', 'lazy', undefined], ['32', '16', 'lazy', 'Author supplied text']
  ]);
  assert.equal(images[2].width, undefined, 'missing dimensions are not invented');
  assert.equal(images[3].width, undefined, 'remote dimensions are not probed');
  assert.deepEqual([images[4].width, images[4].height, images[4].loading], ['10', '5', 'eager'], 'raw HTML overrides respected');
  const blocks = article.tags('code');
  assert.equal(article.text(blocks[0]), code, 'indentation, tabs, entities and internal newlines preserved');
  assert.equal(article.text(blocks[1]), longLine);
  assert.equal(blocks[1].childNodes.filter(node => node.tagName === 'span').length, 0, 'unknown language plaintext');
  assert.equal(blocks[2].childNodes.filter(node => node.tagName === 'span').length, 0, 'no automatic language guessing');
  assert.ok(article.tags('span').some(node => /hljs-/.test(article.attrs(node).class || '')), 'build token markup');
  assert.equal(article.tags('td').length, 0, 'no gutter or layout table');
  assert.equal(article.tags('button').length, 0, 'static/no-JS code has no inert copy controls');
  const css = read(dir, 'css/index.css');
  const declarations = selector => {
    const rules = [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)]
      .filter(([, selectors]) => selectors.split(',').some(value => value.trim() === selector));
    assert.ok(rules.length, `generated CSS contains ${selector}`);
    return Object.fromEntries(rules.flatMap(([, , body]) => body.split(';').filter(value => value.trim()).map(value => {
      const colon = value.indexOf(':');
      return [value.slice(0, colon).trim(), value.slice(colon + 1).trim()];
    })));
  };
  const preStyle = declarations('.article > .content pre');
  const codeStyle = declarations('.article > .content pre > code');
  assert.equal(preStyle.overflow, 'visible', 'no horizontal scrolling container');
  for (const style of [preStyle, codeStyle]) {
    assert.equal(style['white-space'], 'pre-wrap', 'preserve whitespace and wrap long lines');
    assert.equal(style['overflow-wrap'], 'anywhere', 'wrap unbroken tokens');
  }
  assert.equal(codeStyle['max-width'], '100%');
  assert.equal(codeStyle['box-sizing'], 'border-box', 'padding stays within available width');
  assert.equal(declarations('.article > .content img').height, 'auto');
  assert.equal(declarations('.article > .cover').width, '100%');
  assert.equal(declarations('.article > .cover').height, 'auto');
  assert.equal(declarations('.article.article-post > .content')['padding-bottom'], '32px');
  assert.equal(declarations('.article > footer').padding, '20px 0 0', 'mobile nav matches outer bottom inset');
  for (const [selector, padding] of [
    ['.article', ['48px 90px', '20px']],
    ['.project-card', ['48px 64px', '20px']],
    ['.archive', ['64px 90px', '20px']],
    ['.tagcloud', ['64px 90px', '20px']],
    ['body[data-layout=about] .article', ['64px 90px', '20px']],
    ['body[data-layout=category] .project-card', ['64px 90px', '20px']],
    ['body[data-layout=tag] .project-card', ['64px 90px', '20px']]
  ]) {
    const values = [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)]
      .filter(([, selectors]) => selectors.split(',').some(value => value.trim() === selector))
      .flatMap(([, , body]) => [...body.matchAll(/(?:^|;)\s*padding:\s*([^;]+)/g)].map(match => match[1].trim()));
    assert.deepEqual(values, padding, `${selector}: chosen desktop/mobile insets`);
  }
  for (const [route, layout] of [['index.html', 'home'], ['page/2/index.html', 'home'], ['categories/index.html', 'category'], ['categories/Example/index.html', 'category'], ['tags/index.html', 'tag'], ['tags/Useful/index.html', 'tag'], ['2025/01/01/sample-0/index.html', 'post']]) {
    const page = document(read(dir, route));
    assert.equal(page.attrs(page.tags('body')[0])['data-layout'], layout, `${route}: layout scope`);
  }
  assert.ok(!read(dir, 'index.html').includes('prototype'), 'no prototype controls in production');
  assert.match(css, /hljs-keyword/);
  assert.ok(fs.existsSync(path.join(dir, 'public/js/code-copy.js')));
});

// A source page owns the root even with categorized posts present. Removing it
// removes only the overview, not the individual category routes.
testSite('source-owned category overview and copy opt-in', { files: { 'source/categories/index.md': '---\nlayout: page\ntitle: Source-owned overview\n---\nUnique source marker.' } }, (dir, result) => {
  assert.equal(result.status, 0, result.stdout + result.stderr);
  assert.match(read(dir, 'categories/index.html'), /Unique source marker/);
  assert.ok(!read(dir, 'index.html').includes('src="/js/code-copy.js"'), 'copy opt-in');
});
testSite('no generated overview and custom category directory', { files: { 'source/categories/index.md': null }, config: { category_dir: 'topics' } }, (dir, result) => {
  assert.equal(result.status, 0, result.stdout + result.stderr);
  assert.ok(!fs.existsSync(path.join(dir, 'public/categories/index.html')));
  assert.ok(!fs.existsSync(path.join(dir, 'public/topics/index.html')), 'no generator-owned overview');
  assert.ok(fs.existsSync(path.join(dir, 'public/topics/News/index.html')), 'category_dir honored');
});

testSite('root-prefixed and relative local image paths', { config: { root: '/blog/', url: 'https://example.com/blog' }, files: {
  'source/_posts/local.md': '---\ntitle: Local root\ndate: 2025-01-01\nphotos: /images/example.webp\n---\n![](/images/example.webp)\n\n<img src="../../../../images/example.webp" alt="">'
} }, (dir, result) => {
  assert.equal(result.status, 0, result.stdout + result.stderr);
  const home = document(read(dir, 'index.html'));
  assert.equal(home.attrs(home.tags('img')[0]).src, '/blog/images/example.webp');
  assert.equal(home.attrs(home.tags('img')[0]).width, '32');
  const article = document(read(dir, '2025/01/01/local/index.html'));
  article.tags('img').forEach(node => assert.equal(article.attrs(node).width, '32', 'root/relative asset dimensions'));
});
testSite('optional detail covers and about layout', { files: {
  'source/_posts/no-cover.md': '---\ntitle: No cover\ndate: 2025-01-01\n---\n![](/images/example.webp)',
  'source/_posts/hidden-cover.md': '---\ntitle: Hidden cover\ndate: 2025-01-01\nphotos: /images/example.webp\ncover: false\n---\n![](/images/example.webp)',
  'source/about/index.md': '---\nlayout: about\n---\n# About\n\nAbout body.'
} }, (dir, result) => {
  assert.equal(result.status, 0, result.stdout + result.stderr);
  for (const slug of ['no-cover', 'hidden-cover']) {
    const article = document(read(dir, `2025/01/01/${slug}/index.html`));
    const images = article.tags('img').map(article.attrs);
    assert.equal(images.length, 1, `${slug}: no detail cover or placeholder`);
    assert.equal(images[0].loading, 'lazy', `${slug}: no first-body-image exception`);
  }
  const home = document(read(dir, 'index.html'));
  const hiddenLink = home.tags('a').find(node => home.attrs(node).href === '/2025/01/01/hidden-cover/');
  assert.ok(hiddenLink, 'hidden detail cover retains its listing');
  const about = document(read(dir, 'about/index.html'));
  assert.equal(about.attrs(about.tags('body')[0])['data-layout'], 'about');
  assert.equal(about.attrs(about.tags('section')[0]).class, 'article', 'about is not styled as a post');
});
