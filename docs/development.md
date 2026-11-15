# 开发与维护

## 安装与预览

```bash
git clone git@github.com:imagebuilder1837/imagebuilder1837.github.io.git
cd imagebuilder1837.github.io
git submodule update --init
npm ci
npm test
npm run server
```

## 验证

`npm test` 执行一次干净构建，再做轻量生成文件与本地链接检查。运行后查看构建日志中的错误与告警；验证范围见[行为边界](spec.md#验证范围)。

## 依赖维护

- 依赖变动后按影响范围本地预览；自动合并的保证范围见[行为边界](spec.md)。
- 调整或移除 YAML 安全覆盖前，核对上游发布版、锁文件和实际解析结果均避开相关公告，并完成构建与安全审计。覆盖范围保持在受影响的依赖路径；原因见[依赖调查](external/dependencies.md)。
- 不直接执行 `npm audit fix --force`，避免为处理间接依赖告警而降级数学插件。

## 自动合并的人工接管

- 人工编辑已开启自动合并的 PR 前，先关闭该 PR 的自动合并；停用或改造时清查并关闭既有请求。
- 启用或恢复前，核验实际主分支保护及适用、继承的 Actions 事件与 actor 策略。平台限制见 [GitHub Actions 调查](external/github-actions.md)。
- 确需 `pull_request_target` 时，仅为必要工作流配置明确许可，只执行可信默认分支代码。

## 发布与回退

- 若合并由 `GITHUB_TOKEN` 引发，需要发布时在 Actions 中手动运行 **Blog build and publish**，选择 `main`；手动触发仍遵循发布条件。原因见[平台事件限制](external/github-actions.md)。
- 发布失败先看 Actions 日志；回退优先在 `main` 上 revert 出问题的提交，再按新提交构建发布；reset 后强推会改写公开历史，需维护者明确选择。
