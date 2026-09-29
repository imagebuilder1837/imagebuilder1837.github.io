# 博客维护手册

## 从零重建

```bash
git clone git@github.com:imagebuilder1837/imagebuilder1837.github.io.git
cd imagebuilder1837.github.io
git checkout source/bootstrap
git submodule update --init
npm ci
npx hexo generate    # 产物输出到 public/
npx hexo server      # 本地预览
```

依赖以 `package-lock.json` 为准（`npm ci` 严格按锁文件安装）。请保持锁定版本，
仅针对具体问题升级；清理候选无用依赖前先确认无引用，删除后对比构建产物一致。

## 回退

- `main` 分支上的 tag **`pre-migration-baseline`** 指向本次维护整理前的最新发布提交。
- 旧发布路径未变：本地 `npx hexo deploy` 会把 `public/` 推送到 `main`（legacy 分支发布）。
- 需要恢复到迁移前状态时，从上述 tag 检出源码，重复重建步骤后执行 `npx hexo deploy`。
- 不要在源码已进入 `main` 之后继续执行旧的产物推送命令，避免两套流程同时写线上。

## 日期元数据的一次性差异

`_config.yml` 的 `updated_option` 已由 `mtime` 改为 `date`：

- 文章页 `<meta property="article:modified_time">` 与 `atom.xml` 中机器读取的
  更新时间，旧产物取自**文件修改时间**（每次检出/复制都会漂移）；本次改造后
  首次生成起统一回退为**文章发布日期**。
- 这是已接受的一次性变化，影响范围：全部文章页的 `article:modified_time` 和
  `atom.xml` 的 `<updated>` 字段。页面展示不受影响，仍然只显示发布日期。
- 改造后同内容构建结果与文件修改时间无关（已验证：改动全部文章文件 mtime 后
  重新构建，产物逐字节一致）。文章 front-matter 中显式书写的 `updated` 仍优先生效。
