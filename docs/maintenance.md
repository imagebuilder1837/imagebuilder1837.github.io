# 博客维护手册

## 从零重建

```bash
git clone git@github.com:imagebuilder1837/imagebuilder1837.github.io.git
cd imagebuilder1837.github.io
git submodule update --init
npm ci
npm test            # 清理、构建一次真实博客到 public/，再执行全部检查
npx hexo server      # 本地预览
```

依赖以 `package-lock.json` 为准（`npm ci` 严格按锁文件安装）。CI 和发布构建目前分别在两个工作流中声明 Node 24 major，允许补丁更新；本机可使用自己的 Node 版本，不承诺其他 major 的兼容支持。清理、替换或升级直接依赖前先审计用途与影响，取得批准后执行并验证产物行为。

## 发布与回退

- Pages 来源是 GitHub Actions：`main` 上文章／页面、站点配置或主题指针的变更自动发布，发布前执行干净安装、构建和主题行为检查。纯依赖、文档及 CI 变更只运行只读 CI，不更新线上产物；PR、其他分支和主题推送不能直接部署。
- `hexo deploy` 已移除，不要向源码 `main` 推送构建产物。
- 回退：在 `main` 上 `git revert` 出问题的提交后推送，或 `git reset --hard` 到上一个好基线后强推，由 Actions 按新 `main` 重新构建发布。reset 会改写公开历史，是否使用由维护者决定。

## 依赖更新与发文

- `package.json` 暂时只对 `hexo-front-matter@^5.0.0` 下的 `yaml` 覆盖为 `2.8.3`，对齐上游已合并但尚未发布的修复，避免 GHSA-48c2-rrv3-qjmp。上游发布包含修复的版本后，升级并移除此 override，再更新锁文件、干净安装、运行完整检查与安全审计；不将它扩展为全局 YAML 覆盖。
- Dependabot 每月检查常规 npm 更新，安全更新 PR 仍可能在月中出现。仅可信 Dependabot 的 npm 依赖 PR（含 major 和安全更新）在最新 `main` 上通过必需 CI 后自动合并；依赖更新不单独发布，等下一次内容、配置或主题指针变更。
- 发文前 `git pull --ff-only origin main` 取得可能已合并的依赖更新；无法快进时先审查差异，正常变基或合并，不要强推。锁文件更新后 `npm ci` 同步本地依赖，再用 `npx hexo generate && npx hexo server` 本地预览外观与内容（自动合并的依赖可能含 major 更新，即使 CI 通过也应本地预览）。
- `npm test` 是本地与 CI 的完整验证入口：真实博客先 clean/build 一次，再以原生 `node:test` 串行执行显式列出的测试文件；构建失败立即停止，独立检查失败继续汇总并最终返回非零。真实站点检查只读取本轮产物。`npm run test:checks` 或 `node --test test/verification.js` 可用于排错，但仅检查已有产物，缺失会报错，不保证新鲜度，也不替代完整验收。
- 首页、归档、分类详情与标签详情由宿主的四个标准生成器提供；分类／标签总览仍是源页面。Clover 不再支持首页分类／标签筛选。样式使用 `hexo-renderer-dartsass` 和 `sass.style` 等现代选项，不再使用 `node_sass` 配置。
- Clover 的集成测试由博客层承担：虚构样例用宿主依赖在独立临时站点和同步子进程中生成，验证后清理，不写真实博客产物。生成子进程最多等待 120 秒，文章集合读取最多 60 秒；启动错误、信号及超时单独报告，不作为预期的配置拒绝。测试要求 `themes/clover` 子模块已检出；主题仓库不携带测试或 CI。Clover 仓库不启用自动依赖更新，主题推送不会自动更新博客的固定指针。
