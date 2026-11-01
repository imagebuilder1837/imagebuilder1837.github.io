# 依赖调查

## YAML 安全覆盖

`hexo-front-matter` 发布版固定依赖受 [GHSA-48c2-rrv3-qjmp](https://github.com/eemeli/yaml/security/advisories/GHSA-48c2-rrv3-qjmp) 影响的 `yaml`；本站局部覆盖到已修复的 `2.8.3`，避免连带改变其他 YAML 依赖。上游发布修复不代表本仓库的锁文件与实际解析结果已满足解除条件。

## MathJax 的间接依赖

MathJax 的菜单依赖带入 `rimraf → glob/minimatch`，涉及 [glob](https://github.com/advisories/GHSA-3g3m-2fjr-6pw4) 和 [minimatch](https://github.com/advisories/GHSA-g3hv-75wg-m249) 的审计告警。本站服务端 TeX/SVG 渲染不加载这条清理工具链；`npm audit fix --force` 会建议降级数学插件，而非只修复该链。
