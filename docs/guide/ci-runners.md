---
type: guide
status: Accepted
updated: 2026-11-21
---

# CI 与制品任务

## 普通检查

先在 PR 中核对待合入提交及对应运行，确认检查名称、run、attempt 和实际 runner。使用以下命令等待指定运行结束：

```bash
gh run watch <run-id> --interval 120 --exit-status
gh run view <run-id> --log-failed
```

失败时先读失败步骤和 annotations，区分计费拒绝、排队与执行错误。修复后重新运行受影响的检查。改动工作流时提交新 revision，由新运行验证；旧运行重跑仍使用原工作流。

用 `gh repo view --json visibility` 核对仓库可见性。公开 Linux 作业使用 `ubuntu-26.04`，私有 Linux 作业使用 `stuhelper-arc` 组。调用共享 Go 或 Node 检查时选择相应工作流，保留 job ID、name 与检查命令。见[检查规格](../spec/ci-runners.md)。

## 镜像与部署

Web 和 Admin 的 `image.yml` 在 GitHub 托管 runner 构建正式 tag 并发布到 GHCR。Backend 由私有组接单，用站点远程 BuildKit 构建并发布到 GHCR。镜像发行前核对 tag、对应的 main 源码提交与授权，发布后核对 manifest digest。

Ops 使用已构建制品，容器组合通过发布文件选择并校验远端 digest。生产运行方式、晋级与回退入口见私有 ops 的生产基线。Casdoor 维护流程独立执行，见 [SSO 候选检查](sso-candidate.md)。

## 存储检查

共享 setup 按锁文件恢复 pnpm 和 Go 缓存。私有站点必须完成缓存接入并启用 `STUHELPER_CACHE_READY` 才能缓存。PR 只恢复，可信 develop/main 上的 push 或手动运行可在成功后保存。缓存范围见[依赖与存储规格](../spec/ci-runners.md#依赖与存储)。

复查时比较同一提交两次运行的命中类型、恢复字节和准备耗时，单列排队、安装、编译与检查时间。把镜像预装、缓存恢复与网络下载的结果分别记录。

公开仓库可用 `gh cache list --repo StuHelper/<仓库名>` 盘点托管缓存。私有缓存由站点服务维护。清理前核对仓库、key、ref、访问时间及其他任务是否使用。

Docker 测试使用任务专属 Compose project、镜像标签和 builder。退出时删除本任务容器与闲置镜像，保留持久卷、运行中的部署、回退制品和其他任务资源。

## 镜像与主机升级

上海私有池已使用 Ubuntu 26.04 的 `ubuntu26.04-v0.2.3` 镜像。镜像由公开 GHCR 提供，以版本 tag 拉取。主机系统单独维护，站点配置、缓存接入、升级和回退步骤由私有 ops 的 runner 维护说明提供。

发布新 runner 镜像前检查全部镜像层、配置及构建历史，确认只有公共工具和配置。在无镜像缓存及拉取凭据的环境完整下载，核对 manifest digest，再验证候选能接单并运行工具链、数据库和浏览器检查。

切换时用独立候选验证运行和回退所需的旧 tag，再调整正式 scale set。旧实例完成任务后退出。回收前检查运行实例、Helm 配置和镜像引用，保留现用及已验证的回退制品。
