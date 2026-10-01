'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { test } = require('node:test');
const { runSync } = require('./process');
const yaml = require('js-yaml');

const site = path.resolve(__dirname, '..', '..');
const fixture = path.join(site, 'test', 'fixture');
const modules = path.join(site, 'node_modules');
const theme = path.join(site, 'themes', 'clover');
const generateScript = `
const Hexo = require('hexo');
const instance = new Hexo(process.cwd(), { silent: true });
instance.init()
  .then(() => instance.call('generate', { bail: true }))
  .then(() => instance.exit())
  .catch(error => { console.error(error); process.exit(1); });
`;

// All integration tests observe Hexo's generated routes, not private helpers.
// The temporary site never cleans or writes the real blog's public directory.
function withSite({ config = {}, files = {}, feedPlugin = true, blogScripts = false } = {}, verify) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'clover-example-'));
  try {
    fs.cpSync(fixture, dir, { recursive: true });
    fs.symlinkSync(modules, path.join(dir, 'node_modules'), 'dir');
    fs.mkdirSync(path.join(dir, 'themes'));
    fs.symlinkSync(theme, path.join(dir, 'themes', 'clover'), 'dir');
    if (blogScripts) {
      fs.cpSync(path.join(site, 'scripts'), path.join(dir, 'scripts'), { recursive: true });
      fs.mkdirSync(path.join(dir, 'migrations'));
      fs.writeFileSync(path.join(dir, 'migrations', 'redirects.json'), '[]');
    }
    const sitePkg = JSON.parse(fs.readFileSync(path.join(site, 'package.json'), 'utf8'));
    const dependencies = { ...sitePkg.dependencies };
    if (!feedPlugin) delete dependencies['hexo-generator-feed'];
    fs.writeFileSync(path.join(dir, 'package.json'), JSON.stringify({
      name: 'clover-example-site', private: true, hexo: sitePkg.hexo || {},
      dependencies, devDependencies: sitePkg.devDependencies
    }));
    const fixtureConfig = yaml.load(fs.readFileSync(path.join(dir, '_config.yml'), 'utf8'));
    fs.writeFileSync(path.join(dir, '_config.yml'), yaml.dump({ ...fixtureConfig, ...config }));
    for (const [filename, content] of Object.entries(files)) {
      const target = path.join(dir, filename);
      if (content === null) {
        fs.rmSync(target, { force: true });
        continue;
      }
      fs.mkdirSync(path.dirname(target), { recursive: true });
      fs.writeFileSync(target, content);
    }
    const result = runSync('generate fictional site', process.execPath, ['-e', generateScript], { cwd: dir });
    return verify(dir, result);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

// Registration is separate from the synchronous fixture lifetime. Each named
// test owns its site until verification returns, including expected build errors.
function testSite(name, options, verify) {
  return test(name, () => withSite(options, verify));
}

module.exports = { withSite, testSite };
