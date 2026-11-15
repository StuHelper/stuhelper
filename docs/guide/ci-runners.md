---
type: guide
status: Accepted
updated: 2026-11-15
---

# CI 与制品任务

## 普通检查

每个仓库的 `make check` 是本地与 CI 的共同入口。先确认失败 job 的实际提交，再读取失败步骤日志。修复后重跑原检查，并验证受影响的后续阶段。

公开仓库普通检查使用 ubuntu-26.04，私有仓库使用 stuhelper-arc 组和 stuhelper-arc-sh-k8s 标签。先用 gh repo view --json visibility 核对可见性，再修改 runner。保留 job ID、name 与原检查命令，分支保护继续引用实际 check 名称。

调用 tooling v0.1.7 的 Node、Go 或附件发行工作流时，通过 with.runs-on 传入 JSON。直接 job 使用相同的 group/labels 映射。公开调用方始终使用托管环境，完整规则见 [CI 规格](../spec/ci-runners.md)。

```yaml
with:
  runs-on: '{"group":"stuhelper-arc","labels":"stuhelper-arc-sh-k8s"}'
```

setup action 可用 go-version-file: .go-version 准备 Go，用 postgres: 'true' 准备数据库工具。准确版本已预装时直接复用。缺失时从官方源下载并校验，日志输出实际版本，不输出凭据。

迁移合入 develop 后，使开放 PR 包含新的 workflow，再按具体 head、run、attempt 和 job 核对。旧运行的 rerun 使用旧工作流，不能用于验证新 runner。检查启动失败时先读取 annotations，再区分计费拒绝、排队和运行错误。

## 镜像与部署

Docker/OCI 和 BJ1 Registry 任务固定使用自建 runner。应用仓库构建版本制品，ops 验证和部署已经构建的镜像。生产部署不拉默认分支重新构建。

SSO 使用独立维护流程。更改主站发布组合不会更新 Casdoor。配置、凭据与生产数据通过部署环境提供，日志只记录可公开的提交、版本与结果。

## 存储检查

私有缓存使用自建持久卷或主机目录。缓存种类、容量和保留期见 [CI 规格](../spec/ci-runners.md#依赖与存储)。PR 挂载只读快照，复制或恢复到作业临时目录后运行；成功的可信 develop/main 才能由独立维护身份发布新快照。

Go 使用 GOMODCACHE 和 GOCACHE，pnpm 使用独立 store-dir，Playwright 使用 PLAYWRIGHT_BROWSERS_PATH。目录按仓库、操作系统、架构和工具版本分区，快照保留来源提交与运行标识。工具链版本改变时建立新分区。

检查缓存时记录恢复字节数、命中种类和耗时。对同一提交执行两次，比较准备依赖、实际检查与总耗时，排队时间单列。首次运行已有镜像预装或缓存时明确记录，避免把网络波动直接归因于缓存。

普通检查不上传 Actions cache 或 artifact。可用 gh cache list --repo StuHelper/<仓库名> 盘点遗留缓存，删除前核对 key、ref、访问时间与其他任务用途。

Docker 测试使用任务专属 Compose project 和镜像标签。退出时删除本任务容器与闲置镜像，保留持久卷、运行中的部署、回退制品和其他任务资源。

## 镜像与主机升级

先基于 Ubuntu 26.04 构建 runner 镜像，预装工具链清单中的准确版本及 PostgreSQL、编译工具和浏览器运行库。镜像使用 BJ1 Registry 的明确版本 tag，回读 manifest digest 和工具版本后，在独立 runner 验证。

切换镜像前保留旧 Helm values、镜像 tag 与 digest。现有任务结束后再滚动替换，新任务失败时恢复旧 values。镜像切换与主机升级分别记录停机和回退结果。

主机升级先确认系统、k3s、ARC、BuildKit、磁盘、内存与缓存，再确认离机备份或虚拟机快照可恢复。暂停接单并等待运行任务清空，备份集群数据库、配置和持久卷信息，按当前 Ubuntu 版本选择受支持升级路径。

升级后核对主机网络、容器运行时、k3s 节点就绪、ARC 伸缩、BuildKit 和私有检查。未确认备份可用时保持当前系统，记录具体缺项。系统失败时通过控制台恢复已验证快照，再核对 runner 注册和缓存权限。
