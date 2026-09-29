# Pages 切换方案（准备阶段，尚未获准上线）

关联：[准备工作 #4](https://github.com/imagebuilder1837/imagebuilder1837.github.io/issues/4)；
[首次切换 #5](https://github.com/imagebuilder1837/imagebuilder1837.github.io/issues/5)。
完成 #4、合并或推送工作流都**不构成** #5 的首次上线批准。

## 现状与边界

- 博客 `main` 是旧静态产物，Pages 来源为 legacy `main` `/`；
  `pre-migration-baseline` 指向产物提交 `fc6874d0aec3d978218cdb3252d7aefdd13e9ff2`，不是源码。
  `source/bootstrap` 从该提交分出，是待验证的源码。准备阶段不推动博客 `main`，不改 Pages 来源。
- 主题通用维护线改名为主题仓库的 `main`；主题工作流只在主题仓库验证虚构样例。
  博客通过固定的公开 HTTPS submodule 提交获取主题，主题推送不会更新博客指针或触发博客发布。
- 博客 CI 在分支推送和 PR 上用只读权限检出固定主题、`npm ci`、清理、构建、运行
  主题筛选行为及博客输出检查。它没有 `pages: write` 或 `id-token: write`。
- 发布工作流只响应博客 `main` 推送或人工 `workflow_dispatch`。其发布 job 还要求
  `github.ref == refs/heads/main`、仓库名匹配，且仓库变量 `PAGES_RELEASE_ENABLED` **恰为**
  `true`；变量未设置时不会启动 job。发布 job 在上传 Pages artifact 之前，同样执行
  `npm ci`、清理、生成和行为检查；检查失败不发布。仅该 job 有 `pages: write` 和
  `id-token: write`，使用 `github-pages` environment（当前仅允许 `main`）。
- 不使用 `pull_request_target`、PR 提供的凭证或主题仓库远程触发。没有首次切换批准时，
  **不得设置/开启** `PAGES_RELEASE_ENABLED`；工作流的存在本身不授权部署。

| 事件 | 主题样例 CI | 博客只读 CI | 博客 Pages 发布 job（开关关闭 / 切换后开启） |
| --- | --- | --- | --- |
| 主题分支推送或 PR | 运行 | 不触发 | 不触发 |
| 博客非 `main` 推送或 PR | 不触发 | 运行 | 不触发 / 不触发 |
| 博客 `main` 推送 | 不触发 | 运行 | 跳过 / 检查通过后发布 |
| 博客人工运行发布工作流，ref 为非 `main` | 不触发 | 不触发 | 跳过 / 跳过 |
| 博客人工运行发布工作流，ref 为 `main` | 不触发 | 不触发 | 跳过 / 检查通过后发布 |

## #4 交付证据（供首次切换前复核）

- 核对主题与博客远端 CI 的绿色运行、博客固定主题 SHA、锁文件安装与构建结果；
  保存工作流 run URL 及源码提交 SHA，**不以本地 node_modules 为通过证据**。
- 比较旧产物与候选产物的关键路由：首页、文章固定链接、归档、分类、标签、关于页、
  `atom.xml` 和引用资源。已知文章隐式更新时间从文件 mtime 回退为发布日期，
  这是一项已接受的一次性 Feed/HTML 元数据差异，不能要求全站字节级相同。
- 检查本表对应的触发条件、job `if`、权限及 `github-pages` 环境分支策略；
  审阅仓库变量仍不存在或非 `true`，Pages 仍为 legacy `main` `/`，博客默认分支仍为 `main`。
- 不通过生产环境试部署来验证门禁；外站链接可用性和视觉截图不作为自动发布门槛。

### 本次准备的核验记录（2026-09-29）

- 主题固定提交 `5a77a5a83cbca440c96d5b4a50b9b7f810a4064c` 已先推送；
  主题 `main` [样例构建与 13 组筛选检查通过](https://github.com/imagebuilder1837/hexo-theme-clover/actions/runs/36537634979)。
  主题默认分支现在是 `main`，旧 `master` 仍保留。
- 博客源码提交 `cb90f97f434a8b94a61b070780c323633080b4fd` 的
  [只读分支 CI 通过](https://github.com/imagebuilder1837/imagebuilder1837.github.io/actions/runs/36537716489)：
  `npm ci`、Hexo 清理及构建、同一组筛选检查与博客输出检查（38 篇文章、88 个 HTML 页面）。
- 与旧 `main` 的静态文件列表比对：旧 66 个 HTML 路由和 73 个 CSS/图片/字体/JS
  资源文件在候选产物中均存在；候选产物新增 22 个标签页。新旧 Feed 均有 20 个条目。
  这只是路径和文件存在性核对，不能替代 #5 的线上访问与视觉检查；
  更新时间元数据的预期差异见[维护手册](./maintenance.md#日期元数据的一次性差异)。
- 发布工作流仅订阅博客 `main` 推送和人工触发；独立 CI 订阅分支与 PR、权限只有
  `contents: read`。发布 job 同时检查仓库、`main` ref、显式开启变量和事件类型，
  在通过构建检查前不会上传或部署 artifact。已按上表核对 PR、普通分支、开关关闭时
  都不满足发布条件；没有进行真实部署预演。
- 核查时博客默认分支仍为 `main`（旧静态产物 `fc6874d0`），Pages 仍为
  legacy `main` `/`，`PAGES_RELEASE_ENABLED` 未设置；`github-pages` environment
  已限制为 `main`。切换执行前须**重新核对**，不能将这些快照视为永久保证。

## #5 才能执行：首次切换（必须另行明确批准）

切换前冻结向旧站点的手工发布；再次确认远端 CI、待发布源码的确切提交、Pages 来源、
变量状态和旧 `main` SHA。任何前提不符就停止，不能强推或覆盖旧历史。

1. 将旧 `main` 的**当前**提交保存到独立的旧产物归档分支，并确认远端存在。
   不以旧 tag 替代当前产物；若旧站点在准备期变化，保存实际最新的产物 SHA。
2. 在 Pages 设置中将发布来源从 legacy 分支改为 **GitHub Actions**。
   先停止旧 Pages 分支路径，再改变 `main`，不要让 legacy 把源码当产物发布。
3. 确认旧 `main` 是已验证的 `source/bootstrap` 提交的祖先；将该**确切已验证提交**
   快进至博客 `main`，不强推、不合并旧产物到源码，也不改动/自动跟踪主题指针。
   `main` 保持仓库默认分支；旧源码分支可以暂时保留用于审计。
4. 确认 Pages 已是 Actions 来源、旧发布入口已从新源码移除、`main` 指向已验证提交；
   然后才把仓库变量 `PAGES_RELEASE_ENABLED` 设为 `true`。手工在博客 `main` 上运行一次
   `pages.yml`，确认发布 job 构建和检查通过、上传并部署 Pages artifact。
5. 核对工作流部署 SHA 与批准的 SHA、Pages 状态及在线首页、旧文章链接、站内资源、
   归档/分类/标签、关于页和 Atom Feed；记录预期的更新时间元数据变化与异常。
   后续仅 `main` 推送自动触发发布，发布流程仍须在同次运行通过检查。

这些步骤**不是原子操作**：允许旧路径停用到新发布成功之间有短暂空窗，
不允许两套活动发布路径同时写线上。不要以本节作为预先授予切换权限。

## 人工回退

首次发布失败、关键线上检查不通过或来源状态异常时，暂停继续推进源码：

1. 把 `PAGES_RELEASE_ENABLED` 改为 `false`，确认无待运行的 Pages 发布 job；
   必要时取消正在运行的发布 job，避免回退后仍有 Actions 发布。
2. 由维护者将 Pages 来源手工改回 legacy，指向第一步保存的**旧产物归档分支** `/`，
   等待 Pages 完成构建并检查首页、旧链接、资源和 Feed。不要将产物推回源码 `main`。
3. 记录回退后的 Pages 设置、归档 SHA、失败工作流及线上检查结果。修复后重新申请
   首次切换批准；不要保持两条活动发布路径。

正常运行之后如需回退单次源码变更，应在源码 `main` 上回滚该变更，让合格构建重新
发布；不要改写公开历史或恢复 `hexo deploy`。
