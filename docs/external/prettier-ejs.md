# Prettier 的 EJS 格式化阻塞

博客与通用主题暂未引入 Prettier 及其格式检查。当前候选 `prettier-plugin-ejs-safe@1.1.4` 在 `ignoreTags: ["html"]` 与含 EJS 的多行 `style` 属性组合下不满足格式化幂等性：每次运行继续增加属性内部缩进，无法稳定通过格式检查。

主题将 HTML 外壳拆在不同模板中，`layout.ejs` 的 `<html>` 开始标签由片段提供；`ignoreTags: ["html"]` 用于让插件跳过该标签的文件内配对检查。插件保留 EJS 标签原文，不负责格式化标签内部 JavaScript，也不保证生成 HTML 的空白语义不变。

## 已验证范围

- Node.js `v26.13.1`，Linux；插件 `1.1.4`，分别搭配 Prettier `3.8.4` 和 `3.10.1` 均复现。
- `-%>` 和 `_%>` 两种 EJS 结束标签均触发本项目模板中的重复缩进；下面的最小复现使用 `_%>`。
- 缩小后的复现不依赖 Hexo，也不需要跨文件片段；完整 HTML 中忽略 `html` 标签即可触发。
- 对同一完整 HTML 取消 `ignoreTags` 后，重复格式化稳定。这个对照不能直接用于主题的跨文件外壳。
- 本地临时副本中，18 个模板均可格式化和编译，17 个格式化结果稳定；`layout.ejs` 每轮继续增加多行 `style` 的缩进。三组空白裁剪组合均能完成 Hexo 生成，对比 131 个 HTML，在忽略普通排版空白后，结构和内容一致，代码块、脚本、样式等内容保留。

上游修复后，重新验证全部主题模板的幂等性、格式化后检查及生成内容等价，再评估整体引入 Prettier。仅能解析或保留 EJS 标签原文不足以解除阻塞。

## 上游状态与来源

核查日期：2026-11-17。未向上游提交本文草稿。

- [插件说明](https://github.com/Vajkis/prettier-plugin-ejs-safe)：标签保留方式、`ignoreTags` 的用途和范围。
- [npm 发布元数据](https://registry.npmjs.org/prettier-plugin-ejs-safe/latest)：核查时最新发布为 `1.1.4`。
- [已核查源码](https://github.com/Vajkis/prettier-plugin-ejs-safe/blob/711275559d8c05eb392194c4f88de19468ea8fe3/index.js)：默认分支该版本与本地安装的 `1.1.4` 入口源码逐字节相同；`applyVirtualIndent` 在内部 HTML 格式化之后给行追加缩进。
- [已有 issue #1](https://github.com/Vajkis/prettier-plugin-ejs-safe/issues/1)：EJS 后紧邻数字导致占位符恢复错误，与本文的重复缩进问题不同。核查全部开放及关闭 issue、开放 PR 时未找到同类报告。
- [Prettier 插件文档](https://prettier.io/docs/plugins)：第三方插件与 Prettier 核心的职责边界。

以下是可独立复制给上游的英文 issue 标题与正文；根因段落明确标为推测。

## Issue title

`ignoreTags: ["html"]` makes formatting non-idempotent for multiline style attributes containing EJS

## Issue body

### Summary

With `ignoreTags: ["html"]`, repeatedly formatting a multiline `style` attribute containing EJS adds another indentation level on every pass.

This prevents a format-then-check workflow from reaching a stable result. The reproduction below uses a complete HTML document, so it does not require Hexo or a partial/include setup.

### Environment

- `prettier-plugin-ejs-safe`: `1.1.4`
- Prettier: reproduced with both `3.8.4` and `3.10.1`
- Node.js: `v26.13.1`
- OS: Linux
- The installed plugin entrypoint is identical to `index.js` at commit `711275559d8c05eb392194c4f88de19468ea8fe3`.

### Reproduction

In a new temporary directory:

```sh
npm init -y
npm install --save-dev prettier@3.10.1 prettier-plugin-ejs-safe@1.1.4
```

Save this as `repro.mjs` and run `node repro.mjs`:

```js
import * as prettier from "prettier";
import * as plugin from "prettier-plugin-ejs-safe";

const input = `<html>
<body style="
<%_ if (color) { _%>
  color: <%= color %>;
<%_ } _%>
">text</body>
</html>
`;

const options = {
  parser: "ejs",
  plugins: [plugin],
  ignoreTags: ["html"],
  tabWidth: 2,
};

let text = input;
for (let pass = 1; pass <= 3; pass++) {
  const next = await prettier.format(text, options);
  const line = next.split("\n").find((line) => line.includes("color:"));
  console.log(
    `pass ${pass}: color indentation = ${line.match(/^ */)[0].length}; unchanged = ${next === text}`,
  );
  if (pass === 1) console.log(next);
  text = next;
}
```

### Actual behavior

The indentation before `color:` keeps increasing:

```text
pass 1: color indentation = 4; unchanged = false
pass 2: color indentation = 6; unchanged = false
pass 3: color indentation = 8; unchanged = false
```

The first formatted output is:

```ejs
<html>
  <body
    style="
  <%_ if (color) { _%>
    color: <%= color %>;
  <%_ } _%>
  "
  >
    text
  </body>
</html>
```

On the second pass, the lines inside the quoted `style` attribute each gain two spaces. The third pass adds two more.

### Expected behavior

Formatting should reach a fixed point after the first pass:

```js
const once = await prettier.format(input, options);
const twice = await prettier.format(once, options);
console.assert(once === twice);
```

### Scope and possible cause

Removing `ignoreTags: ["html"]` from this complete-document reproduction makes the result stable. Our application needs that option because its opening and closing HTML shell tags are split across EJS templates.

A possible cause is the interaction between the preserved multiline attribute value and `applyVirtualIndent`: the latter adds indentation to every nonempty line after the internal HTML formatting step, including lines inside the attribute. A later pass appears to preserve that added indentation and then adds another level. This is a hypothesis, not a verified fix.

This report concerns formatting stability; it does not claim that this reproduction corrupts EJS tags or changes rendered content.
