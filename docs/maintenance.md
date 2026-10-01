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

依赖以 `package-lock.json` 为准（`npm ci` 严格按锁文件安装）。CI／Pages 使用 `.github/workflows/ci.yml` 中的 Node 24 major，允许补丁更新；自动合并工作流同样使用 Node 24。本机可使用自己的 Node 版本，不承诺其他 major 的兼容支持。清理、替换或升级直接依赖前先审计用途与影响，取得批准后执行并验证产物行为。

## 发布与回退

- Pages 来源是 GitHub Actions：本仓库 `main` 上任何 push（包括依赖、Actions、文档和 CI）只要触发工作流，完整 CI 成功就发布。`build` 只读执行干净安装和一次 `npm test`，独立 `deploy` job 持有 Pages／OIDC 写权限并消费同次已验证产物，不再次构建；PR、其他分支和主题推送只能检查，不能直接部署。
- 发布要求 `PAGES_RELEASE_ENABLED=true` 和 `github-pages` 环境；主分支的 `workflow_dispatch` 也执行同一验证／发布流程，其他 ref 的手动运行只检查。只有部署 job 使用串行组，不取消无关 PR 的 `build`。部署开始前再次读取主分支 head；已过时产物不部署，API 错误也不部署。这是开始前的检查，不是整个部署期间的原子锁。
- 接受 `GITHUB_TOKEN` 产生的合并事件可能不触发后续 CI／发布；不新增 PAT、外部 App 或合并后监听。需要发布自动合并后的依赖时，在 Actions 中手动运行 **Blog build and publish**，选择 `main`。部署失败检查 Actions 日志，不自动回滚。
- `hexo deploy` 已移除，不要向源码 `main` 推送构建产物。
- 回退：在 `main` 上 `git revert` 出问题的提交后推送，或 `git reset --hard` 到上一个好基线后强推，由 Actions 按新 `main` 重新构建发布。reset 会改写公开历史，是否使用由维护者决定。

## 依赖更新与发文

- `package.json` 暂时只对 `hexo-front-matter@^5.0.0` 下的 `yaml` 覆盖为 `2.8.3`，对齐上游已合并但尚未发布的修复，避免 GHSA-48c2-rrv3-qjmp。上游发布包含修复的版本后，升级并移除此 override，再更新锁文件、干净安装、运行完整检查与安全审计；不将它扩展为全局 YAML 覆盖。
- Dependabot 本体由 GitHub 托管维护；`.github/dependabot.yml` 每月检查 npm 和所有工作流的第三方 Action 引用。npm patch/minor 保持既有分组，Actions 初始不分组；两者的合格 major 和同生态分组均可自动合并。已有安全更新 PR 同样按范围规则处理，本次不另外启用 GitHub 安全更新设置。
- `.github/workflows/dependabot-automerge.yml` 使用 `pull_request_target`，只 checkout／执行可信默认分支代码；只读验证 job 用 `npm ci --ignore-scripts` 安装可信锁文件以解析 YAML，写权限 job 不安装依赖，不执行 PR 的脚本、Action 或产物。核验真实 Dependabot 身份、同仓库 head、主分支 base、PR 状态及当前 SHA；开启合并前再次读取 head 并使用 SHA 匹配。普通人工 PR 不进入此路径，不新增可信必需检查或外部 App，现有 `build` 仍是合并要求。
- npm 仅允许根目录清单中既有依赖的版本及对应锁文件变化：脚本／工程配置、新增／删除／跨区移动依赖、当前未支持的版本范围／来源及锁文件格式迁移转人工。锁文件可单独更新传递依赖，不自建完整依赖树审计，信任 Dependabot 正确生成依赖树。
- Actions 只允许既有同一 owner/repository/path 的完整 SHA 和版本注释变化；不核验每个上游 tag 映射，信任 Dependabot 的版本判断。输入、命令、权限、条件、事件、runner、环境、结构和工作流增删改名变化均转人工；不支持的引用写法也保守转人工。npm／Actions 混合 PR 不自动合并。
- `DEPENDABOT_AUTOMERGE_ENABLED=true` 才开启合格更新的自动合并。不合格、验证失败或开关关闭时，确认既有自动合并请求已关闭后转人工；API 错误或关闭无法确认会报错，不能视为处理成功。人工修改已开启自动合并的 Dependabot PR 前先关闭自动合并；追加提交会重新验证，但此方案不承诺消除所有竞态。完整 SHA 与绿色 CI 不是上游安全审计，也不保证未运行路径的 major 兼容性。
- 发文前 `git pull --ff-only origin main` 取得可能已合并的依赖更新；无法快进时先审查差异，正常变基或合并，不要强推。锁文件更新后 `npm ci` 同步本地依赖，再用 `npx hexo generate && npx hexo server` 本地预览外观与内容（自动合并的依赖可能含 major 更新，即使 CI 通过也应本地预览）。
- `npm test` 是本地与 CI 的完整验证入口：真实博客先 clean/build 一次，再以原生 `node:test` 串行执行显式列出的测试文件；构建失败立即停止，独立检查失败继续汇总并最终返回非零。真实站点检查只读取本轮产物。`npm run test:checks` 或 `node --test test/verification.js` 可用于排错，但仅检查已有产物，缺失会报错，不保证新鲜度，也不替代完整验收。
- 首页、归档、分类详情与标签详情由宿主的四个标准生成器提供；分类／标签总览仍是源页面。Clover 不再支持首页分类／标签筛选。样式使用 `hexo-renderer-dartsass` 和 `sass.style` 等现代选项，不再使用 `node_sass` 配置。
- Clover 的集成测试由博客层承担：虚构样例用宿主依赖在独立临时站点和同步子进程中生成，验证后清理，不写真实博客产物。生成子进程最多等待 120 秒，文章集合读取最多 60 秒；启动错误、信号及超时单独报告，不作为预期的配置拒绝。测试要求 `themes/clover` 子模块已检出；主题仓库不携带测试或 CI。Clover 仓库不启用自动依赖更新，主题推送不会自动更新博客的固定指针。

## 自动合并改造上线

代码和本地测试通过不等于远端已启用或验收。上线前另获远端操作授权：暂停自动合并入口并清查、关闭已开启的请求（仅关闭变量不会撤销既有请求）；确认主分支仍要求 `build`，核验普通 PR／更新 PR 行为后再恢复入口。

重新核验适用及继承的 Actions 事件策略，必要时只为 `.github/workflows/dependabot-automerge.yml` 配置 `pull_request_target` 许可；`allowed_actions=all`、空策略列表及历史成功记录都不能证明事件永久可用。GitHub 已公告受影响仓库的默认策略将于 2026-11-02 强制执行，参考 [官方安全说明](https://docs.github.com/en/actions/reference/security/securely-using-pull_request_target)。策略无法满足或自动合并机制验证失败时保留更新 PR、暂停自动合并并报告，不自行降低保护。不要创建会误合并或误发布的测试 PR，也不要求专用测试仓库。
