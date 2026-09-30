'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const yaml = require('js-yaml');
const { XMLParser, XMLValidator } = require('fast-xml-parser');
const { withSite } = require('./helpers/site');
const { pageMetadata } = require('./helpers/html');

const markdown = (data, body = '## Body\n\nExample text.\n') => `---\n${yaml.dump(data)}---\n\n${body}`;
const post = (title, fields = {}) => markdown({ title, date: '2024-01-01 08:00:00', ...fields });
const read = (dir, route) => fs.readFileSync(path.join(dir, 'public', route), 'utf8');
const succeeds = result => assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
const parseFeed = xml => {
  assert.equal(XMLValidator.validate(xml), true, 'well-formed Atom XML');
  return new XMLParser({ ignoreAttributes: false, parseTagValue: false }).parse(xml).feed;
};

const longSummary = 'Accurate summary '.repeat(20) + '&lt;/script&gt; &lt;script&gt;alert(1)&lt;/script&gt; &amp; detail';
const expectedSummary = 'Accurate summary '.repeat(20) + '</script> <script>alert(1)</script> & detail';
const files = {
  'source/_posts/01-plain.md': post('Default author', {
    description: longSummary, excerpt: '<b>Card</b> only', permalink: '/notes/default/',
    photos: ['/images/cover.webp', '//cdn.example.com/second.png']
  }),
  'source/_posts/02-tag.md': post('Override author', {
    author: '  Guest & Writer  ', description: 'Guest summary', permalink: '/notes/override/index.html',
    source_url: 'https://example.net/community/', lang: 'en_gb', language: 'fr-FR',
    updated: '2024-02-02 08:00:00', tags: ['Featured']
  }),
  'source/_posts/03-category.md': post('No author', {
    author: false, description: 'Anonymous summary', permalink: '/notes/anonymous/',
    date: '2024-03-03 08:00:00', categories: ['News']
  }),
  'source/_posts/04-both.md': post('Excerpt fallback', {
    description: '  ', excerpt: '<p>Fallback &amp; detail</p>', permalink: '/notes/fallback/',
    categories: ['News'], tags: ['Featured']
  }),
  'source/_posts/05-blocked.md': post('No summary', { permalink: '/notes/empty/' }),
  'source/_posts/06-ignored.md': post('Script-safe author', {
    author: 'Guest </script><script>alert(1)</script>', permalink: '/notes/safe/'
  }),
  'source/_drafts/secret.md': post('Unpublished draft', { description: 'Not public' }),
  'source/about/index.md': markdown({ layout: 'about', title: 'About', lang: 'de-DE' }, '# About this example\n\n## Body\n\nExample text.\n'),
  'source/info/index.md': markdown({ layout: 'page', title: 'Info', description: 'Page summary', language: 'ja-JP' }),
  'source/images/cover.webp': 'fixture image bytes',
  'source/raw.html': 'verification: unchanged',
};

for (const prefix of ['', '/journal']) {
  withSite({
    config: {
      url: `https://example.com${prefix}`, root: `${prefix}/`, language: 'zh-CN',
      description: 'Site summary', keywords: ['Example', 'Stories'], timezone: 'Asia/Shanghai',
      // Deliberately retain Hexo's default mtime policy: the theme must not
      // mistake inferred timestamps for explicitly recorded revisions.
      skip_render: ['raw.html'], per_page: 2,
      index_generator: { per_page: 2, order_by: '-date' },
      archive_generator: { per_page: 2 }, tag_generator: { per_page: 2 },
      feed: { type: 'atom', path: 'atom.xml', limit: 0, content: true }
    }, files
  }, (dir, result) => {
    succeeds(result);
    const base = `https://example.com${prefix}`;
    const check = (route, language = 'zh-CN', article = false) => pageMetadata(read(dir, `${route}index.html`), `${base}/${route}`, language, article);
    for (const route of ['', 'page/2/', 'page/3/', 'archives/', 'archives/2024/', 'archives/2024/01/', 'tags/', 'categories/', 'tags/Featured/', 'categories/News/']) check(route);
    const home = check('');
    assert.deepEqual(home.meta('description'), ['Site summary']);
    assert.deepEqual(home.meta('keywords'), ['Example, Stories']);
    assert.ok(home.attrs(home.tags('h1')[0]).class.includes('visually-hidden'));
    const archive = check('archives/');
    assert.ok(archive.tags('h2').length, 'archive year groups are H2');
    const about = check('about/', 'de-DE');
    assert.deepEqual(about.meta('og:locale'), ['de_DE']);
    const aboutHeading = about.tags('h1')[0];
    assert.equal(about.text(aboutHeading), 'About this example', 'About heading comes from Markdown, not metadata');
    assert.equal(about.attrs(aboutHeading.parentNode).class, 'content');
    assert.deepEqual(about.meta('og:title'), ['关于'], 'About layout title uses theme translation');
    for (const [route, title] of [['archives/', '归档'], ['categories/', '分类'], ['tags/', '标签'], ['about/', '关于']]) {
      const doc = check(route, route === 'about/' ? 'de-DE' : 'zh-CN');
      assert.deepEqual(doc.tags('title').map(doc.text), [`${title} | Example site`], `${route}: localized browser title`);
      assert.deepEqual(doc.meta('og:title'), [title], `${route}: localized sharing title`);
      if (route !== 'about/') assert.deepEqual(doc.tags('h1').map(doc.text), [title], `${route}: localized heading`);
    }
    const info = check('info/', 'ja-JP');
    assert.deepEqual(info.meta('description'), ['Page summary']);

    const defaultPost = check('notes/default/', 'zh-CN', true);
    assert.deepEqual(defaultPost.meta('description'), [expectedSummary]);
    assert.deepEqual(defaultPost.meta('og:description'), [expectedSummary]);
    assert.equal(defaultPost.ld[0].description, expectedSummary);
    assert.deepEqual(defaultPost.meta('article:author'), ['Example Author']);
    assert.equal(defaultPost.ld[0].author.name, 'Example Author');
    assert.deepEqual(defaultPost.meta('og:locale'), ['zh_CN']);
    assert.equal(defaultPost.ld[0].datePublished, '2024-01-01T00:00:00.000Z');
    assert.ok(!('dateModified' in defaultPost.ld[0]));
    assert.deepEqual(defaultPost.meta('article:modified_time'), []);
    assert.ok(!('isBasedOn' in defaultPost.ld[0]));
    assert.deepEqual(defaultPost.ld[0].image, [`${base}/images/cover.webp`, 'https://cdn.example.com/second.png']);
    assert.deepEqual(defaultPost.meta('og:image'), defaultPost.ld[0].image);

    const overridePost = check('notes/override/', 'en-GB', true);
    assert.equal(overridePost.ld[0].author.name, 'Guest & Writer');
    assert.deepEqual(overridePost.meta('article:author'), ['Guest & Writer']);
    assert.equal(overridePost.ld[0].isBasedOn, 'https://example.net/community/');
    assert.ok(!('url' in overridePost.ld[0].author), 'source is not author homepage');
    assert.equal(overridePost.ld[0].dateModified, '2024-02-02T00:00:00.000Z');
    assert.deepEqual(overridePost.meta('og:locale'), ['en_GB']);
    assert.deepEqual(overridePost.meta('article:tag'), ['Featured']);
    const anonymous = check('notes/anonymous/', 'zh-CN', true);
    assert.ok(!('author' in anonymous.ld[0]));
    assert.deepEqual(anonymous.meta('article:author'), []);
    const fallback = check('notes/fallback/', 'zh-CN', true);
    assert.deepEqual(fallback.meta('description'), ['Fallback & detail']);
    const empty = check('notes/empty/', 'zh-CN', true);
    assert.deepEqual(empty.meta('description'), []);
    assert.ok(!('description' in empty.ld[0]));
    assert.ok(!('image' in empty.ld[0]));
    const safe = check('notes/safe/', 'zh-CN', true);
    assert.equal(safe.ld[0].author.name, 'Guest </script><script>alert(1)</script>');
    assert.ok(!safe.tags('script').some(node => safe.text(node) === 'alert(1)'), 'JSON-LD cannot close its script element');
    assert.equal(read(dir, 'raw.html'), files['source/raw.html'], 'skip-render resource untouched');

    const feed = parseFeed(read(dir, 'atom.xml'));
    const entries = Array.isArray(feed.entry) ? feed.entry : [feed.entry];
    assert.equal(feed['@_xml:lang'], 'zh-CN');
    assert.equal(entries.length, 5);
    assert.ok(!entries.some(entry => ['No author', 'Unpublished draft'].includes(entry.title)));
    for (const entry of entries) {
      assert.equal(entry.link['@_href'], entry.id);
      const doc = check(entry.id.slice(`${base}/`.length), entry['@_xml:lang'], true);
      assert.equal(entry.author.name, doc.ld[0].author.name);
      assert.equal(entry.summary || '', doc.ld[0].description || '');
      assert.equal(entry.published, doc.ld[0].datePublished);
      assert.equal(entry.updated, doc.ld[0].dateModified || entry.published);
    }
    console.log(`ok metadata and Atom ${prefix || 'root'}`);
  });
}

for (const [label, config, expected, locale] of [
  ['unconfigured', {}, 'en', undefined],
  ['default alias', { language: 'default' }, 'en', undefined],
  ['language list', { language: ['default', 'bad!', 'fr-fr'] }, 'fr-FR', 'fr_FR'],
  ['script-only language', { language: 'zh-Hant' }, 'zh-Hant', undefined]
]) {
  withSite({ config, feedPlugin: false }, (dir, result) => {
    succeeds(result);
    const doc = pageMetadata(read(dir, 'index.html'), 'https://example.com/', expected);
    assert.deepEqual(doc.meta('og:locale'), locale ? [locale] : []);
    assert.deepEqual(doc.meta('keywords'), [], 'site keywords are optional');
    assert.ok(!fs.existsSync(path.join(dir, 'public', 'atom.xml')), 'theme does not enable optional feed');
    console.log(`ok language ${label}`);
  });
}

for (const invalid of ['', null, true, [], {}, 42]) {
  withSite({ files: { 'source/_posts/01-plain.md': post('Invalid author', { author: invalid }) } }, (dir, result) => {
    assert.notEqual(result.status, 0);
    assert.match(result.stderr + result.stdout, /01-plain\.md.*author must be/);
  });
}
for (const invalid of ['bad!', true, []]) {
  withSite({ files: { 'source/_posts/01-plain.md': post('Invalid language', { lang: invalid }) } }, (dir, result) => {
    assert.notEqual(result.status, 0);
    assert.match(result.stderr + result.stdout, /01-plain\.md.*invalid language/);
  });
}
withSite({ config: { language: 'bad!' } }, (dir, result) => {
  assert.notEqual(result.status, 0);
  assert.match(result.stderr + result.stdout, /invalid language/);
});
withSite({ config: { feed: { type: 'atom', limit: 1 } }, files }, (dir, result) => {
  succeeds(result);
  const feed = parseFeed(read(dir, 'atom.xml'));
  assert.notEqual(feed.entry.title, 'No author', 'false excluded before applying feed limit');
  assert.equal(Array.isArray(feed.entry), false);
});
withSite({ config: { render_drafts: true, feed: { type: 'atom', limit: 0 } }, files }, (dir, result) => {
  succeeds(result);
  const feed = parseFeed(read(dir, 'atom.xml'));
  assert.ok(!feed.entry.some(entry => entry.title === 'Unpublished draft'), 'preview drafts never enter Atom');
});
withSite({ config: { feed: { type: ['rss2', 'atom'], path: ['rss.xml', 'custom-atom.xml'], limit: 0 } }, files }, (dir, result) => {
  succeeds(result);
  const feed = parseFeed(read(dir, 'custom-atom.xml'));
  assert.equal(feed.entry.length, 5);
  assert.equal(XMLValidator.validate(read(dir, 'rss.xml')), true, 'existing RSS sibling is not replaced');
});
console.log('ok invalid declarations, feed limit, drafts and combined feed routes');
