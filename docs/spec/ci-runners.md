---
type: spec
status: Accepted
updated: 2026-11-15
---

# CI 与 runner 约定

## 工作流职责

各仓使用职责明确的工作流。架构仓库检查清单和文档，platform 检查公共 Go 框架，backend 检查正式依赖装配，Web/Admin 检查各自应用，ops 检查部署配置与镜像组合。

普通检查覆盖 develop/main push 和面向这两个分支的 PR。同一 workflow、事件及分支或 PR 的新运行取消旧运行。实际检查 job 直接作为 required check，不增加仅用于显示结果的汇总 job。

跨仓浏览器联调独立运行，验证契约与界面组合，不重复各仓全部测试。PR 描述记录配套提交，检查结果只证明本次实际提交组合。公开 PR 不在能够读取私有源码的环境执行。

| 仓库 | 可见性 | 必需检查 |
| --- | --- | --- |
| stuhelper-next | public | Architecture checks |
| stuhelper-tooling | public | Tooling checks |
| stuhelper-platform | public | Platform checks |
| stuhelper-backend | private | Backend checks |
| stuhelper-web | public | Web checks、Contribution browser checks |
| stuhelper-admin | public | Admin checks、Storage browser checks |
| verification | private | Verification checks |
| campus-adapters | private | Campus adapter checks |
| billing | private | Billing checks |
| qq-binding | private | QQ binding checks |
| ops | private | Documents checks、Deployment configuration、Database role permissions |
| storage-bhpan | public | BHpan checks |
| storage | public | Storage checks |
| media | public | Media checks |
| resources | public | Resources checks |
| storage-contribution | public | Contribution checks |
| catalog、reviews、moderation | public | Catalog checks、Reviews checks、Moderation checks |

GitHub 对 reusable workflow 显示调用 job 与实际 job 的组合名称，分支规则使用远端实际产生的 check 名称。迁移 runner 时保持 job ID、name 与检查命令。私有仓库的强制保护受套餐能力限制时，合并前仍须核对完整结果，不降低必需检查。

公开应用联调默认使用各仓 develop。首次跨仓实现的 academic-community PR 使用 workspace.lock.json 中显式登记的提交，push 到 develop/main 后仍使用 develop。手动运行可通过完整 SHA 指定候选，实际组合写入 CI summary。

## runner 与权限

私有仓库的普通 push/PR 检查使用 stuhelper-arc 组、stuhelper-arc-sh-k8s 标签。公开仓库普通检查使用 GitHub ubuntu-26.04。可见性以 gh repo view --json visibility 核验，工作区登记不能代替远端权限状态。

Docker/OCI、镜像组合和 BJ1 Registry 任务使用自建 runner。公开 PR 不在能够读取私有源码、凭据或缓存的环境运行。共享普通检查工作流接收调用方的 runs-on JSON，公开调用方固定使用托管环境。

私有 stuhelper-arc 组禁止公开仓库访问。Web/Admin 的正式镜像发行使用独立 stuhelper-arc-release 组，仅允许固定版本的共享发行工作流。公开发行池不挂载私有缓存，PR 事件在分配 runner 前跳过。

自建 runner 不可用时排队或失败，不自动改走托管环境。runner 镜像与主机系统分别升级；系统升级须先确认可用快照或备份，并在无任务执行时维护。实际系统与 Kubernetes 版本记录在运维验收中。

Kubernetes runner 通过 `BUILDKIT_HOST` 提供远端 BuildKit。镜像发行使用 remote driver，不假设本地 Docker daemon 可用；部署连接使用明确的目标 Docker context。作业只清理自己的 builder 注册，远端服务和共享缓存由 runner 维护。

默认权限为 `contents: read`。制品推送和部署工作流按任务增加最小权限，受保护环境控制晋级。跨私有仓库拉取优先使用按仓授权的 GitHub App 短期凭据，公开 PR 不接触这些凭据。

Actions 使用明确版本 tag。私有检查使用 tooling v0.1.8 的预装检测与直接工具引导，公开发行使用 v0.1.9 的独立 runner 入口。完整 Go 与 Node 检查使用 reusable workflow，应用专用命令留在各仓。

预装版本以 architecture/toolchains.yaml 为准。缺失工具从官方来源有界下载，Node、Go、actionlint 核验 SHA-256，pnpm 核验 SHA-512。PostgreSQL 通过官方 PGDG 源安装，校验源密钥、签名元数据和包摘要。

## 依赖与存储

依赖按锁文件安装。私有 runner 可以保存 Go 模块、Go 构建、pnpm store 和 Playwright 浏览器缓存，私有模块只留在自建环境。公开仓库不使用这些缓存，不向 GitHub 上传私有模块缓存或普通检查 artifact。

持久缓存按仓库和工具链版本分区，只接收 develop/main 上成功的可信运行。PR 只读取已发布缓存，缺失依赖与构建写入作业临时目录，结束后丢弃。只读权限由卷挂载或宿主身份保证，不能只依赖工作流中的 if 条件。

持久缓存总上限为 40 GiB。每仓 Go 模块至多 3 GiB、Go 构建至多 2 GiB、pnpm store 至多 1 GiB，浏览器共享区至多 4 GiB。物理空间不足时缩小预算或拒绝写入，不自动扩盘。

私有 Go 模块与 pnpm 快照生成后三十天到期，Go 构建七天后停止恢复。替换的快照保留两小时再清理，避免影响正在恢复的作业。浏览器和公共依赖随版本化镜像维护，浏览器最多保留两个受支持修订，总预算为 4 GiB。

可信维护任务在发布前校验容量与来源。复制只接受普通文件，跳过 pnpm 指向临时检出的项目链接。源码检查失败、取消、工具版本变化或容量超限时保留已有快照。清理只涉及本任务的缓存目录。

不自动扩大付费额度。Docker/BuildKit 缓存使用任务专属 builder 或 BJ1 Registry，不使用 Actions cache。构建和测试完成、失败或中断后清理本任务容器、builder 和闲置镜像，保留其他任务与持久数据。

## 验收场景

| 场景 | 操作与预期结果 |
| --- | --- |
| CI-01 | 私有 push/PR 的实际 job 使用指定 ARC 组与标签，公开 push/PR 使用 ubuntu-26.04，检查名称保持不变 |
| CI-02 | 公开 PR 使用托管环境，不能读取私有源码凭据或持久缓存；公开调用方传入自建 runner 仍使用托管环境 |
| CI-03 | 镜像任务固定使用自建 runner |
| CI-04 | 自建 runner 不可用时排队或失败，不切换环境 |
| CI-05 | 更新 Casdoor 候选只验证官方制品，不重新编译 |
| CI-06 | 安装按锁文件执行，依赖失败使检查失败 |
| CI-07 | Docker 缓存使用本任务 builder 或 BJ1 Registry |
| CI-08 | 发布组合保留版本 tag 并核验 digest |
| CI-09 | 同一 PR 连续提交取消旧运行 |
| CI-10 | develop 文档提交仍执行本仓基础检查 |
| CI-11 | 组合检查报告实际参与的源码提交 |
| CI-12 | 实际检查失败或取消时不得宣称通过 |
| CI-13 | 可信 develop/main 成功后才发布缓存；PR 挂载只读快照，写入被拒绝；容量与保留期清理可验证 |
| CI-14 | hook 只检查暂存快照，失败和中断不改动索引 |
| CI-15 | 子命令非零退出码保留到检查结果 |
| CI-16 | Registry 验证只使用 Next 应用命名空间的唯一临时 tag，核验 manifest digest 后清理本次制品 |
| CI-17 | 缺失或损坏的工具下载失败并保留非零退出码，摘要校验成功后才使用工具 |
| CI-18 | 记录相同提交首次与第二次运行的检查、工具安装和依赖准备耗时，列明命中与未命中的缓存 |

## PostgreSQL 检查版本

开发与 CI 使用软件源当前提供的最新稳定 PostgreSQL，不固定 18.6 或某个发行包修订。安装 postgresql 与 postgresql-client 元包，检查脚本从已安装元包解析实际主版本，并输出服务器版本。预发布版本不自动纳入普通检查。

本地可以通过 STUHELPER_TEST_PG_BIN 指定任务专用工具目录。测试仍使用独立数据库、运行身份和可清理资源。生产部署按实际验收后的明确镜像版本维护，开发依赖更新不触发生产升级。
