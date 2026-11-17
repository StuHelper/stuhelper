---
type: guide
status: Accepted
updated: 2026-11-17
---

# CI 与制品任务

## 普通检查

每个仓库的 `make check` 是本地与 CI 的共同入口。先确认失败 job 的实际提交，再读取失败步骤日志。修复后重跑原检查，并验证受影响的后续阶段。

公开仓库普通检查使用 ubuntu-26.04，私有仓库使用 stuhelper-arc 组和 stuhelper-arc-sh-k8s 标签。先用 gh repo view --json visibility 核对可见性，再修改 runner。保留 job ID、name 与原检查命令，分支保护继续引用实际 check 名称。

调用 tooling v0.1.8 的 Node、Go 或附件发行工作流时，通过 with.runs-on 传入 JSON。直接 job 使用相同的 group/labels 映射。公开普通检查始终使用托管环境，完整规则见 [CI 规格](../spec/ci-runners.md)。

```yaml
with:
  runs-on: '{"group":"stuhelper-arc","labels":"stuhelper-arc-sh-k8s"}'
```

setup action 可用 go-version-file: .go-version 准备 Go，用 postgres: 'true' 准备数据库工具。准确版本已预装时直接复用。缺失时从官方源下载并校验，日志输出实际版本，不输出凭据。

迁移合入 develop 后，使开放 PR 包含新的 workflow，再按具体 head、run、attempt 和 job 核对。旧运行的 rerun 使用旧工作流，不能用于验证新 runner。检查启动失败时先读取 annotations，再区分计费拒绝、排队和运行错误。

## 镜像与部署

Docker/OCI 和 BJ1 Registry 任务固定使用自建 runner。应用仓库构建版本制品，ops 验证和部署已经构建的镜像。生产部署不拉默认分支重新构建。

公开 Web/Admin 使用独立发行组与 tooling v0.1.9 image.yml。升级共享工作流前，先把新版本登记到发行组的允许列表，再更新调用方。发行池无私有缓存与 Kubernetes API token。私有 runner 组禁止公开仓库使用。

SSO 使用独立维护流程。更改主站发布组合不会更新 Casdoor。配置、凭据与生产数据通过部署环境提供，日志只记录可公开的提交、版本与结果。

## 存储检查

私有缓存使用自建持久卷或主机目录。缓存种类、容量和保留期见 [CI 规格](../spec/ci-runners.md#依赖与存储)。PR 挂载只读快照，复制或恢复到作业临时目录后运行；成功的可信 develop/main 才能由独立维护身份发布新快照。

Go 使用 GOMODCACHE 和 GOCACHE，pnpm 使用独立 store-dir，Playwright 使用 PLAYWRIGHT_BROWSERS_PATH。目录按仓库、操作系统、架构和工具版本分区，快照保留来源提交与运行标识。工具链版本改变时建立新分区。

检查缓存时记录恢复字节数、命中种类和耗时。对同一提交执行两次，比较准备依赖、实际检查与总耗时，排队时间单列。首次运行已有镜像预装或缓存时明确记录，避免把网络波动直接归因于缓存。

普通检查不上传 Actions cache 或 artifact。可用 gh cache list --repo StuHelper/<仓库名> 盘点遗留缓存，删除前核对 key、ref、访问时间与其他任务用途。

Docker 测试使用任务专属 Compose project 和镜像标签。退出时删除本任务容器与闲置镜像，保留持久卷、运行中的部署、回退制品和其他任务资源。

## 镜像与主机升级

先基于 Ubuntu 26.04 构建 runner 镜像，预装准确版本的工具链、PostgreSQL 和浏览器运行库。当前临时使用 public 的 ghcr.io/stuhelper/ci-runner，BJ1 恢复后再迁回。镜像内容改变时使用新版本 tag，已发行 tag 不覆盖。

公开前核对所有镜像层、配置和构建历史，检查私有源码、凭据、缓存和宿主配置。自动生成的默认 PostgreSQL 证书与私钥在安装所在的同一条 RUN 中删除，并关闭默认 TLS。重新构建后验证本机 PostgreSQL 能正常启动。

推送后将包设为 public，回读 manifest digest，并在无已有镜像内容和无拉取凭据的环境完整下载。随后运行 k3s canary，验证 PostgreSQL、Chromium 和 pnpm，确认新 runner 注册成功。组织禁止公开包时停止，不修改组织设置或计费。

ARC 通过版本 tag 拉取，digest 只记录在核验结果中。确认现有任务结束后切换，失败时重新部署已验证的上一版本 tag。版本与部署配置由 ops 维护，runner 主机不保存镜像归档或手工配置备份。

切换时将两个 ARC 池临时设为 minRunners = 0、maxRunners = 0，暂停新 runner 分配，并等待运行任务结束。核对旧 runner 已退出后更新镜像，分别验证私有池和公开发行池注册，再恢复各池原有容量。public GHCR 不配置 imagePullSecrets。

排空期间同时读取 Helm values 与 AutoscalingRunnerSet 的实际 minRunners、maxRunners。其他操作直接修改集群容量时，Helm 中的值可能仍为 0。核对维护安排并恢复一致后，继续等待已有任务结束。

新版本验证成功后，先列出待删对象与大小，再清理旧镜像归档、调整前配置副本、旧回退脚本和无人使用的旧镜像。保留依赖缓存、发布器服务、ARC/k3s/BuildKit 配置及其他服务数据，最后核对磁盘和 runner。

本轮主机保留 Debian，只更新 Ubuntu runner 容器。镜像源码、只读缓存发布器、版本配置与验收记录统一由私有 ops 仓库维护。

未来更换主机系统时，先确认离机备份或虚拟机快照可恢复，再暂停接单并等待运行任务结束。跨发行版更换需要重装或替代节点。升级后核对网络、持久卷、k3s、ARC、BuildKit 与完整私有检查。
