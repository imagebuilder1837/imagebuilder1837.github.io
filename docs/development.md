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

## 公式写作

复杂公式中的 `_`、`*`、`\\` 可能需要额外 Markdown 转义，参见[插件说明](https://github.com/next-theme/hexo-filter-mathjax#renderer)；不要假定标准 LaTeX 原稿可直接跨工具复用。正文中的美元符可能被识别为公式，字面示例宜放在行内代码或代码块中。

## 依赖维护

- 依赖变动后按影响范围本地预览；自动合并的保证范围见[行为边界](spec.md)。
- 调整或移除 YAML 安全覆盖前，核对上游发布版、锁文件和实际解析结果均避开相关公告，并完成构建与安全审计。不扩大为全局 YAML 覆盖；原因见[依赖调查](external/dependencies.md)。
- 不直接执行 `npm audit fix --force`，避免为处理间接依赖告警而降级数学插件。

## 自动合并的人工接管

- 人工编辑已开启自动合并的 PR 前，先关闭该 PR 的自动合并；停用或改造时清查并关闭既有请求。追加提交后的重新验证不能消除所有竞态。
- 启用或恢复前，核验实际主分支保护及适用、继承的 Actions 事件与 actor 策略，不能只看历史成功记录。平台限制见 [GitHub Actions 调查](external/github-actions.md)。
- 确需 `pull_request_target` 时，仅为必要工作流配置明确许可，只执行可信默认分支代码。

## 发布与回退

- 若合并由 `GITHUB_TOKEN` 引发，需要发布时在 Actions 中手动运行 **Blog build and publish**，选择 `main`；手动触发不绕过发布条件。不为此新增 PAT、App 或合并后监听；原因见[平台事件限制](external/github-actions.md)。
- 发布失败先看 Actions 日志；回退优先在 `main` 上 revert 出问题的提交，再按新提交构建发布。不要把旧 `public/` 推入源码；reset 后强推会改写公开历史，需维护者明确选择。
