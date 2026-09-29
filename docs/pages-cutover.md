# Pages 切换与回退

关联：[准备工作 #4](https://github.com/imagebuilder1837/imagebuilder1837.github.io/issues/4)；
[首次切换 #5](https://github.com/imagebuilder1837/imagebuilder1837.github.io/issues/5)。
完成 #4、合并或推送工作流都**不构成** #5 的首次上线批准。

## 首次切换授权记录

2026-09-29：维护者在讨论并确认 #5 的切换、人工验收与回退边界后，明确指令
“按以上决策实现”。按已确认的授权规则，该指令批准本次首次切换 Pages 来源与首次部署；
不代表人工验收已经通过。首次部署成功后须关闭自动发布开关，等待维护者人工检查首页、
旧文章、导航、站内资源和 RSS 并回复“通过”，再恢复日常自动发布。

## 现状与边界

- 博客 `main` 现为正式源码分支，Pages 发布来源已切为 GitHub Actions。
  旧静态产物在 `archive/legacy-pages-2026-09-29`，提交为
  `fc6874d0aec3d978218cdb3252d7aefdd13e9ff2`；同一提交的 `pre-migration-baseline`
  是产物 tag，不是源码。`source/bootstrap` 保留作为切换前源码分支。
- 主题通用维护线改名为主题仓库的 `main`；主题工作流只在主题仓库验证虚构样例。
  博客通过固定的公开 HTTPS submodule 提交获取主题，主题推送不会更新博客指针或触发博客发布。
- 博客 CI 在分支推送和 PR 上用只读权限检出固定主题、`npm ci`、清理、构建、运行
  主题虚构样例的筛选行为检查。它没有 `pages: write` 或 `id-token: write`。
- 发布工作流只响应博客 `main` 上文章／页面、站点配置、固定主题指针的推送，或人工
  `workflow_dispatch`。纯依赖、文档及 CI 变更不会自动发布。发布 job 还要求
  `github.ref == refs/heads/main`、仓库名匹配，且仓库变量 `PAGES_RELEASE_ENABLED` **恰为**
  `true`；变量未设置时不会启动 job。发布 job 在上传 Pages artifact 之前，同样执行
  `npm ci`、清理、生成和行为检查；检查失败不发布。仅该 job 有 `pages: write` 和
  `id-token: write`，使用 `github-pages` environment（当前仅允许 `main`）。
- 不使用 `pull_request_target`、PR 提供的凭证或主题仓库远程触发。首次部署后
  `PAGES_RELEASE_ENABLED` 曾设回 `false`；维护者人工验收通过后才恢复为 `true`。

| 事件 | 主题样例 CI | 博客只读 CI | 博客 Pages 发布 job（开关关闭 / 开启） |
| --- | --- | --- | --- |
| 主题分支推送或 PR | 运行 | 不触发 | 不触发 |
| 博客非 `main` 推送或 PR | 不触发 | 运行 | 不触发 / 不触发 |
| 博客 `main` 仅依赖／文档／CI 推送 | 不触发 | 运行 | 不触发 / 不触发 |
| 博客 `main` 内容／站点配置／主题指针推送 | 不触发 | 运行 | 跳过 / 检查通过后发布 |
| 博客人工运行发布工作流，ref 为非 `main` | 不触发 | 不触发 | 跳过 / 跳过 |
| 博客人工运行发布工作流，ref 为 `main` | 不触发 | 不触发 | 跳过 / 检查通过后发布 |

## #4 准备证据（切换前已复核）

- 切换前核对主题与博客远端 CI 的绿色运行、博客固定主题 SHA、锁文件安装与构建结果；
  保存工作流 run URL 及源码提交 SHA，**不以本地 node_modules 为通过证据**。
- 比较旧产物与候选产物的关键路由：首页、文章固定链接、归档、分类、标签、关于页、
  `atom.xml` 和引用资源。已知文章隐式更新时间从文件 mtime 回退为发布日期，
  这是一项已接受的一次性 Feed/HTML 元数据差异，不能要求全站字节级相同。
- 切换前检查本表对应的触发条件、job `if`、权限及 `github-pages` 环境分支策略；
  确认当时仓库变量不存在或非 `true`，Pages 是 legacy `main` `/`，博客默认分支是 `main`。
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
  已限制为 `main`。切换执行时已重新核对这些条件；本段只记录切换前快照。

## 首次切换记录（2026-09-29）

1. 复核获批候选源码 `7d368fb3e0421ca6bbc80cbfcf11d0c71cdaa169` 的
   [分支 CI](https://github.com/imagebuilder1837/imagebuilder1837.github.io/actions/runs/36538758229)；
   确认旧 `main` 为 `fc6874d0`、Pages 来源为 legacy、发布变量不存在。
2. 将旧 `main` 的**实际当前提交** `fc6874d0` 保存在远端
   `archive/legacy-pages-2026-09-29`，并核对归档分支的 SHA。没有改写历史。
3. 先将 Pages 来源切为 GitHub Actions，才将获批源码快进至 `main`；
   [这次推送的发布 job 因开关关闭而跳过](https://github.com/imagebuilder1837/imagebuilder1837.github.io/actions/runs/36538909535)，
   [只读构建 CI 通过](https://github.com/imagebuilder1837/imagebuilder1837.github.io/actions/runs/36538909568)。
4. 确认 Pages 已是 Actions 来源后开启仓库变量，
   [手工触发首次 Pages artifact 部署](https://github.com/imagebuilder1837/imagebuilder1837.github.io/actions/runs/36539074122)：
   清理、构建、主题和博客行为检查、artifact 上传与部署全部通过。
   `github-pages` 部署记录 `6729523246` 对应上述获批源码 SHA，状态为 `success`。
5. **首次部署成功后将发布变量设为 `false`**，等待维护者人工验收；期间文档提交
   `87b2c5d` 的[只读 CI 通过](https://github.com/imagebuilder1837/imagebuilder1837.github.io/actions/runs/36539466719)，
   [发布 job 跳过](https://github.com/imagebuilder1837/imagebuilder1837.github.io/actions/runs/36539466869)，
   线上仍是首次部署的 `7d368fb` 产物。不要误以为 CI 通过就已更新现网。

这些步骤不是原子操作：切换时允许了短暂的发布空窗，没有让两条活动路径同时写线上。
GitHub 返回的部署成功只说明 artifact 已发布，**不等于维护者已确认读者体验**。

## 维护者人工验收

2026-09-29：维护者在获提示自行检查线上首页、旧文章链接、导航、站内资源及 RSS 后
回复“通过”。这是维护者的人工验收结论；未运行全部旧链接的自动逐项探测，
也不以外部网站的可达性作为门槛。首次生成时文章与 Feed 隐式更新时间回退为
发布日期，是已接受的预期差异（详见维护手册）。

验收时核对 Pages 来源仍为 Actions、最近成功部署仍为 `7d368fb`、发布变量仍为 `false`。
验收记录提交并通过只读 CI 后，发布变量恢复为 `true`；启用变量本身不会补跑此前
被跳过的推送。后续依赖维护调整为仅内容／站点配置／主题指针变更才自动发布，
且发布仍须通过同次构建与检查。

## 人工回退

人工检查不通过或来源状态异常时，暂停继续推进源码；是否回退由维护者决定：

1. 保持 `PAGES_RELEASE_ENABLED` 为 `false`，确认无待运行的 Pages 发布 job；
   必要时取消正在运行的发布 job，避免回退后仍有 Actions 发布。
2. 由维护者将 Pages 来源手工改回 legacy，指向
   **`archive/legacy-pages-2026-09-29` 的根目录**。检查 `github-pages` 环境的部署
   分支规则：当前只允许 `main`；如 GitHub 没有自动加入归档分支，仅在回退时为此归档
   分支添加精确许可。等待旧产物分支重新发布成功，再检查首页、旧链接、资源和 Feed。
   不要将产物推回源码 `main`，也不要为回退预先放宽环境规则。
3. 记录回退后的 Pages 设置、环境规则、归档 SHA、失败工作流及线上检查结果。
   修复后重新申请再次切换的批准；切回 Actions 时恢复环境规则为仅允许 `main`。
   不要保持两条活动发布路径。

正常运行之后如需回退单次源码变更，应在源码 `main` 上回滚该变更，让合格构建重新
发布；不要改写公开历史或恢复 `hexo deploy`。
