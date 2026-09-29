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

## 发布准备与回退

- 当前 Pages 仍以 legacy 模式从旧 `main` 根目录提供站点；`source/bootstrap` 是待切换源码。
  在获得首次切换的**另行明确批准**前，不更改博客默认分支、Pages 来源或发布开关，不执行部署。
- 源码已移除 `hexo deploy` 的脚本、插件和仓库目标。准备期间现网保持原状；如必须更新现网，
  需要另行决定临时操作，不能从待切换源码向旧 `main` 推送产物。
- `pre-migration-baseline`（`fc6874d0`）是**已发布的静态产物**，不是可运行 `npm ci` 的源码。
  可重建的源码在 `source/bootstrap` 历史中；不要从产物 tag 检出后尝试重建。
- 已同意的首次切换和回退顺序见 [Pages 切换方案](./pages-cutover.md)。只有正式切换获批后，
  才能将旧产物保存在独立分支，并把已经验证的源码快进至 `main`；失败时先停用 Actions 发布，
  再按方案将 Pages 切回旧产物分支。绝不向已变为源码的 `main` 执行旧部署命令。

## 日期元数据的一次性差异

`_config.yml` 的 `updated_option` 已由 `mtime` 改为 `date`：

- 文章页 `<meta property="article:modified_time">` 与 `atom.xml` 中机器读取的
  更新时间，旧产物取自**文件修改时间**（每次检出/复制都会漂移）；本次改造后
  首次生成起统一回退为**文章发布日期**。
- 这是已接受的一次性变化，影响范围：全部文章页的 `article:modified_time` 和
  `atom.xml` 的 `<updated>` 字段。页面展示不受影响，仍然只显示发布日期。
- 改造后同内容构建结果与文件修改时间无关（已验证：改动全部文章文件 mtime 后
  重新构建，产物逐字节一致）。文章 front-matter 中显式书写的 `updated` 仍优先生效。
