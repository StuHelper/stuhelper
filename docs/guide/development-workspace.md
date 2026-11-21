---
type: guide
status: Accepted
updated: 2026-11-21
---

# 开发工作区

## 初始化

主机安装 Git 与 Mani，项目 Node.js、pnpm 和 Go 版本见 `architecture/toolchains.yaml`。在主仓库运行 `make setup`、`mani sync`，再按需要运行 `mani run setup --tags code`。私有仓库使用开发者已有的 GitHub 授权。

主检出位于 `workspace/<仓库名>`，任务工作树位于 `workspace/worktrees/<任务>/<仓库名>`。Mani 登记 25 个配套仓库。各仓路径和可见性以 `mani.yaml` 为准，职责见[模块仓库](../design/module-repositories.md)。

## 日常操作

```bash
mani run status --all
mani run fetch --all
mani run setup --tags code
mani run check --tags code
mani run hooks --tags code
```

每次开发先在目标仓库运行 `git fetch origin develop` 刷新 `origin/develop`。使用 `git worktree add -b <分支> <路径> origin/develop` 建立独立工作树，每个工作树指定一名主要写入者。

同一任务持续更新同一 PR，短期分支通过 squash 合入 develop。正式发布使用 develop 到 main 的 merge commit。发行 tag、镜像和环境晋级各自按授权执行。

## 联合开发与正式依赖

运行 `node scripts/workspace.mjs go-work`，在本地生成含已检出 Go module 的 `go.work`。候选测试显式设置 `GOWORK=<工作区绝对路径>/go.work`。这个文件不提交。

正式 backend 构建设置 `GOWORK=off`，依赖来自自己的 `go.mod` 和 `go.sum`。platform 保留 `examples/server`，公开 CI 无需 backend 或私有业务源码。

## 联调记录

`node scripts/workspace.mjs snapshot` 显示已检出仓库的实际提交和脏状态。`snapshot --write` 用于写入非发行快照，要求当前检出干净并包含已有快照的每个仓库。发行锁文件通过单独的发行流程维护。

跨仓 PR 在描述中列出依赖 PR、测试提交和合并顺序。应用集成工作流默认使用公开仓库 develop；手动候选输入使用完整提交 SHA。每轮把实际提交写入 CI summary，候选更新后重新执行。

`workspace.lock.json` 固定发行源码组合。发布报告关联组件 tag、提交、制品摘要与检验结果。Ops 另以发行组合或版本槽位记录运行环境所用的制品。
