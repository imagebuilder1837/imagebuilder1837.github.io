'use strict';

// Continuous whole-site checks over current output. The redirect map is runtime
// configuration, not a frozen inventory of articles or migration evidence.
const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const yaml = require('js-yaml');
const { document } = require('./helpers/html');
const { discovery } = require('./helpers/discovery');

test("current blog discovery, canonical links, targets and fragments", () => {
  const site = path.resolve(__dirname, "..");
  const publicDir = path.join(site, "public");
  const config = yaml.load(
    fs.readFileSync(path.join(site, "_config.yml"), "utf8"),
  );
  const aliases = JSON.parse(
    fs.readFileSync(path.join(site, "migrations/redirects.json"), "utf8"),
  );
  const read = (route) => fs.readFileSync(path.join(publicDir, route), "utf8");
  const aliasPaths = new Set(aliases.map((alias) => alias.from));
  const aliasRoutes = new Set(
    aliases.map((alias) => alias.from.slice(1) + "index.html"),
  );
  const urls = discovery(publicDir, config.url, aliases);
  const routes = new Set(
    fs
      .readdirSync(publicDir, { recursive: true })
      .filter((route) => fs.statSync(path.join(publicDir, route)).isFile()),
  );
  const htmlDocs = new Map(
    [...routes]
      .filter((route) => route.endsWith(".html"))
      .map((route) => [route, document(read(route))]),
  );
  let localLinks = 0;
  let fragments = 0;
  for (const [route, doc] of htmlDocs) {
    if (aliasRoutes.has(route)) continue;
    assert.equal(
      new Set(doc.ids).size,
      doc.ids.length,
      `${route}: no duplicate IDs`,
    );
    for (const node of [
      ...doc.tags("a"),
      ...doc.tags("img"),
      ...doc.tags("script"),
      ...doc.tags("link"),
    ]) {
      const attrs = doc.attrs(node);
      const href = attrs.href || attrs.src;
      if (!href) continue;
      const url = new URL(href, doc.canonical[0] || config.url + "/" + route);
      if (
        url.origin !== new URL(config.url).origin ||
        !["http:", "https:"].includes(url.protocol)
      )
        continue;
      assert.ok(
        !aliasPaths.has(url.pathname),
        `${route}: internal link points directly to a current address (${href})`,
      );
      const filename = decodeURIComponent(url.pathname).replace(/^\//, "");
      const target = routes.has(filename)
        ? filename
        : filename.replace(/\/$/, "") + (filename ? "/" : "") + "index.html";
      assert.ok(routes.has(target), `${route}: local target exists (${href})`);
      localLinks++;
      if (
        htmlDocs.has(target) &&
        !aliasRoutes.has(target) &&
        htmlDocs.get(target).canonical.length
      ) {
        const canonical = new URL(htmlDocs.get(target).canonical[0]);
        assert.equal(
          url.pathname,
          canonical.pathname,
          `${route}: formal page link uses its canonical path (${href})`,
        );
      }
      if (url.hash && htmlDocs.has(target)) {
        const id = decodeURIComponent(url.hash.slice(1));
        if (id) {
          assert.ok(
            htmlDocs.get(target).ids.includes(id),
            `${route}: fragment exists (${href})`,
          );
          fragments++;
        }
      }
    }
  }
  console.log(
    `ok ${urls.length} formal discovery URLs, ${localLinks} local links and ${fragments} fragments`,
  );
});
