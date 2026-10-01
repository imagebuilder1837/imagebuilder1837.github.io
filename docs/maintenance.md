# 博客维护手册

## 安装与预览

使用 [CI 指定的 Node major](../.github/workflows/ci.yml)；不承诺其他 major 的兼容支持。

```bash
git clone git@github.com:imagebuilder1837/imagebuilder1837.github.io.git
cd imagebuilder1837.github.io
git submodule update --init
npm ci
npm test
npm run server
```

## 依赖安全例外

`hexo-front-matter` 发布版固定依赖受 [GHSA-48c2-rrv3-qjmp](https://github.com/eemeli/yaml/security/advisories/GHSA-48c2-rrv3-qjmp) 影响的 `yaml`。局部 override 将它解析到已修复的 `2.8.3`；保持局部覆盖，不扩大为全局 YAML 覆盖。

解除时，确认采用的上游发布版不再要求受影响版本，且移除 override 后锁文件及实际解析结果仍避开公告受影响范围，再完成既定验证与安全审计。上游发布修复本身不代表本仓库已满足解除条件。

## 自动合并的信任边界与人工接管

- 自动合并信任 Dependabot 生成的依赖树与 Action 版本判断，不自行审计整棵依赖树或核验每个上游 tag。完整 SHA 与绿色构建不证明上游安全，也不保证未经运行路径的 major 兼容性；依赖变动后按影响范围本地预览。
- 人工编辑已开启自动合并的 PR 前，先关闭该 PR 的自动合并。仅关闭仓库开关不会主动撤销既有请求；停用或改造时须清查并关闭这些请求。追加提交后的重新验证也不消除所有竞态。
- 启用或恢复前核验实际主分支保护、适用及继承的事件与 actor 策略；`allowed_actions=all`、单层空策略列表或历史成功记录不是策略许可的证据。确需 `pull_request_target` 时，仅为必要工作流配置明确许可，只执行可信默认分支代码。参见 [GitHub 安全说明](https://docs.github.com/en/actions/reference/security/securely-using-pull_request_target)。
- 保护或策略条件无法满足、验证失败时，保留更新 PR 并暂停自动合并，不以降低保护或创建可能误合并、误发布的 PR 来验收。

## 发布与回退的陷阱

- 若合并／push 事件由 `GITHUB_TOKEN` 引发，不依赖它触发后续 push CI 或发布（[平台限制](https://docs.github.com/en/actions/concepts/security/github_token)）。需要发布时，在 Actions 中手动运行 **Blog build and publish**，选择 `main`；手动触发也不绕过发布条件。不为此新增 PAT、App 或合并后监听。
- 陈旧产物检查只发生在部署开始前，不是覆盖整个部署期间的原子锁。发布失败不会自动回滚；先看 Actions 日志。
- 回退优先在 `main` 上 revert 出问题的提交，让 Actions 按新提交重新构建发布；不要把旧 `public/` 推入源码。reset 后强推会改写公开历史，需维护者明确选择。
