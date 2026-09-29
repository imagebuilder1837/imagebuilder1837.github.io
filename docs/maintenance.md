# 博客维护手册

## 从零重建

```bash
git clone git@github.com:imagebuilder1837/imagebuilder1837.github.io.git
cd imagebuilder1837.github.io
git checkout main
git submodule update --init
npm ci
npx hexo generate    # 产物输出到 public/
npx hexo server      # 本地预览
```

依赖以 `package-lock.json` 为准（`npm ci` 严格按锁文件安装）。请保持锁定版本，
仅针对具体问题升级；清理候选无用依赖前先确认无引用，删除后对比构建产物一致。

## 发布与回退

- 首次切换已获批准并执行：博客 `main` 现在是正式源码分支，Pages 来源是 GitHub Actions，
  不再从分支上的静态文件发布。首次 Pages artifact 部署成功，维护者已人工验收通过。
  验收后已恢复仓库变量 `PAGES_RELEASE_ENABLED=true`；`main` 上文章／页面、站点配置或
  固定主题指针的变更才自动发布，并在发布前执行干净安装、构建和主题行为检查。
  纯依赖、文档及 CI 变更只运行只读 CI，不更新线上产物；PR、其他分支和主题推送不能直接部署。
- 源码已移除 `hexo deploy` 的脚本、插件和仓库目标。旧产物保存在
  `archive/legacy-pages-2026-09-29`（`fc6874d0`）。不要向现在的源码 `main` 推送产物。
- `pre-migration-baseline`（`fc6874d0`）是**已发布的静态产物**，不是可运行 `npm ci` 的源码。
  可重建的源码在 `main`；不要从产物 tag 检出后尝试重建。
- 真实切换记录、人工验收及回退步骤见 [Pages 切换与回退](./pages-cutover.md)。
  如需恢复旧产物，先保持发布开关关闭，再将 Pages 来源切回归档产物分支，
  核对 `github-pages` 环境分支限制；不得让新旧发布路径同时处于活动状态。

## 依赖更新与发文

- 博客仓库 Dependabot 每月检查常规 npm 版本更新；安全更新 PR 仍可能在月中出现。
  仅可信 Dependabot 的 npm 依赖 PR（含 major 和安全更新）在最新 `main` 上通过必需 CI 后
  自动合并。更新不会单独发布，需等下一次站点内容、配置或主题指针变更。
- 发文前运行 `git pull --ff-only origin main`，先取得可能已合并的依赖更新；如果自己已有
  未推送提交而无法快进，应先审查差异并正常变基或合并，不要强推。锁文件更新后运行
  `npm ci` 以同步本地依赖，再用 `npx hexo generate && npx hexo server` 本地预览。
  远端会为内容变更重新构建并检查，无需在本地重复整套 CI。
- Clover 仓库不启用自动依赖更新；主题推送不会自动更新博客的固定指针。

## 日期元数据的一次性差异

`_config.yml` 的 `updated_option` 已由 `mtime` 改为 `date`：

- 文章页 `<meta property="article:modified_time">` 与 `atom.xml` 中机器读取的
  更新时间，旧产物取自**文件修改时间**（每次检出/复制都会漂移）；本次改造后
  首次生成起统一回退为**文章发布日期**。
- 这是已接受的一次性变化，影响范围：全部文章页的 `article:modified_time` 和
  `atom.xml` 的 `<updated>` 字段。页面展示不受影响，仍然只显示发布日期。
- 改造后同内容构建结果与文件修改时间无关（已验证：改动全部文章文件 mtime 后
  重新构建，产物逐字节一致）。文章 front-matter 中显式书写的 `updated` 仍优先生效。
