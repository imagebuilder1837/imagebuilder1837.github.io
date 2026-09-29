# 博客维护手册

## 从零重建

```bash
git clone git@github.com:imagebuilder1837/imagebuilder1837.github.io.git
cd imagebuilder1837.github.io
git submodule update --init
npm ci
npx hexo generate    # 产物输出到 public/
npx hexo server      # 本地预览
```

依赖以 `package-lock.json` 为准（`npm ci` 严格按锁文件安装）。清理候选无用依赖前先确认无引用，删除后对比构建产物一致。

## 发布与回退

- Pages 来源是 GitHub Actions：`main` 上文章／页面、站点配置或主题指针的变更自动发布，发布前执行干净安装、构建和主题行为检查。纯依赖、文档及 CI 变更只运行只读 CI，不更新线上产物；PR、其他分支和主题推送不能直接部署。
- `hexo deploy` 已移除，不要向源码 `main` 推送构建产物。
- 回退：在 `main` 上 `git revert` 出问题的提交后推送，或 `git reset --hard` 到上一个好基线后强推，由 Actions 按新 `main` 重新构建发布。reset 会改写公开历史，是否使用由维护者决定。

## 依赖更新与发文

- Dependabot 每月检查常规 npm 更新，安全更新 PR 仍可能在月中出现。仅可信 Dependabot 的 npm 依赖 PR（含 major 和安全更新）在最新 `main` 上通过必需 CI 后自动合并；依赖更新不单独发布，等下一次内容、配置或主题指针变更。
- 发文前 `git pull --ff-only origin main` 取得可能已合并的依赖更新；无法快进时先审查差异，正常变基或合并，不要强推。锁文件更新后 `npm ci` 同步本地依赖，再用 `npx hexo generate && npx hexo server` 本地预览外观与内容（自动合并的依赖可能含 major 更新，即使 CI 通过也应本地预览）。
- Clover 的集成测试由博客层承担：`npm test`（`test/integration.js`）用博客已安装的依赖在临时站点上验证；主题仓库不携带测试或 CI，测试要求 `themes/clover` 子模块已检出。Clover 仓库不启用自动依赖更新，主题推送不会自动更新博客的固定指针。
