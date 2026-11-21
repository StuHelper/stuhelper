---
type: spec
status: Accepted
updated: 2026-11-21
---

# CI 与 runner 约定

## 工作流职责

各仓使用职责明确的工作流。架构仓库检查清单和文档，platform 检查公共 Go 框架，backend 检查正式依赖装配，Web/Admin 检查各自应用，ops 检查部署配置与镜像组合。

普通检查覆盖 develop/main push 和面向这两个分支的 PR。同一 workflow、事件及分支或 PR 的新运行取消旧运行。项目合入门槛使用实际检查 job 的结果。

跨仓浏览器联调独立运行，验证契约与界面组合，不重复各仓全部测试。PR 描述记录配套提交，检查结果只证明本次实际提交组合。公开 PR 不在能够读取私有源码的环境执行。

| 仓库 | 可见性 | 合入前核对的检查 |
| --- | --- | --- |
| stuhelper | public | Architecture checks |
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
| profiles、favorites、open-platform | public | Profiles checks、Favorites checks、Open platform checks |
| notifications、information-query | public | Notifications checks、Information query checks |
| groups、search | public | Groups checks、Search checks |

GitHub 的检查上下文可能包含调用 job 和实际 job。根仓、platform、Web、Admin 的 develop/main 分支保护要求 `check / <检查名>`，tooling 要求 `Tooling checks`。Web、Admin 浏览器检查按路径执行，命中时合入前核对结果。

其他公开仓的两条维护分支当前未设置必需状态检查。私有仓库受 GitHub 套餐能力限制，由合入者核对上表的结果。始终以当前待合入提交和 GitHub 实际报告的检查名称为准。

根仓基础检查覆盖文档改动。公开联调按工作流路径过滤触发，先核对契约并构建，再运行框架、学术、Web 资料和 Admin 资料四组浏览器检查。

联调默认检出各仓 develop。修改锁文件的 PR、面向 main 的 PR 使用锁定组合。main push 和手动运行在存在发行锁时使用该组合。手动输入完整 SHA 可覆盖单项，CI summary 分别记录锁定及实际组合。

## runner 与权限

私有 Linux 作业只声明 runner group `stuhelper-arc`，由组内可用站点接单。公开 Linux 作业使用 GitHub 托管的 `ubuntu-26.04`。调用共享工作流时选择对应可见性的入口，检查名称保持稳定。

Web 和 Admin 在 GitHub 托管环境使用 BuildKit 构建。Backend 在私有组使用站点提供的远程 BuildKit。三者凭发行作业的 packages 写权限推送 GHCR。Ops 校验已发布的制品并独立执行环境晋级。

runner 镜像发布在公开 GHCR，按明确版本 tag 拉取。ops 在发行前逐层核对公共软件来源，记录 manifest 摘要并验证匿名完整拉取。站点配置提供包源、DNS、BuildKit 和 Actions 缓存入口。

新站点部署独立的 scale set 并加入同一私有组。先验证新模板接单、网络和缓存，再退出旧模板。vm999 运行 runner 及配套服务。回退使用上一版可拉取的 tag，备份不存放在 runner 主机。

默认权限为 `contents: read`。制品推送和部署工作流按任务增加最小权限，受保护环境控制晋级。跨私有仓库拉取优先使用按仓授权的 GitHub App 短期凭据，公开 PR 不接触这些凭据。

Actions 引用明确版本 tag。Go 和 Node 检查按仓库可见性选择对应的共享工作流，应用专用命令留在各仓。工作流采用的版本以调用方声明为准。

预装版本由 architecture/toolchains.yaml 确定。镜像构建核验公共工具来源和归档摘要。作业使用 setup-node、setup-go 安装其他声明版本。PostgreSQL 安装程序验证 PGDG 签名元数据和包摘要。

## 依赖与存储

依赖按锁文件安装。setup-node 复用 pnpm store，setup-go 复用 Go 模块与编译缓存。公开项目可复用 Vite 优化依赖、TypeScript 的构建信息和与锁文件匹配的 Chromium。

私有缓存保存在支持 Actions 缓存协议的自建服务，其后端为 S3 兼容对象存储。仓库身份与分支作用域由服务端验证。对象存储凭据留在服务端。站点接入后要用两个仓库的合成样本验证隔离。

共享检查在可信 develop/main 的成功 push 或手动运行后保存，PR 只恢复。缓存键按依赖类型纳入工具链或锁文件等输入。托管缓存遵循仓库限额，自建缓存按服务配置的容量与生命周期回收。

tooling 的 develop 已将附件发行拆为两步。构建作业以只读权限上传保留 1 天的制品，发布作业持有写权限，按制品 ID 下载和校验。当前 Web、Admin 和 Backend 仍调用单作业版本。

BuildKit 层缓存与 Actions 依赖缓存分别维护，清理仅处理作业拥有的临时资源。各站点维护方法与实际验证记录由 ops 管理。

## 验收场景

| 场景 | 操作与预期结果 |
| --- | --- |
| CI-01 | 私有 push/PR 的实际 job 使用指定 ARC 组，公开 push/PR 使用 ubuntu-26.04，检查名称保持不变 |
| CI-02 | 公开 PR 使用托管环境，公开仓库调用私有入口时跳过私有 job，私有 runner group 禁止公开仓库接入 |
| CI-03 | 公开镜像发行在托管 runner 推送 GHCR，私有镜像作业由私有组接单 |
| CI-04 | 自建 runner 不可用时排队或失败，不切换环境 |
| CI-05 | 更新 Casdoor 候选只验证官方制品，不重新编译 |
| CI-06 | 安装按锁文件执行，依赖失败使检查失败 |
| CI-07 | Docker 缓存由本任务的 builder 或站点远程 BuildKit 管理 |
| CI-08 | 发布组合保留版本 tag 并核验 digest |
| CI-09 | 同一 PR 连续提交取消旧运行 |
| CI-10 | develop 文档提交仍执行本仓基础检查 |
| CI-11 | 组合检查报告实际参与的源码提交 |
| CI-12 | 实际检查失败或取消时不得宣称通过 |
| CI-13 | 同仓同版本可恢复，其他仓库查询相同标记无法命中。PR 只恢复，可信分支成功后保存 |
| CI-14 | hook 只检查暂存快照，失败和中断不改动索引 |
| CI-15 | 子命令非零退出码保留到检查结果 |
| CI-16 | 对已提交的发行组合只读检查 GHCR manifest，远端摘要与锁定摘要不符时失败 |
| CI-17 | 缺失或损坏的工具下载失败并保留非零退出码，摘要校验成功后才使用工具 |
| CI-18 | 记录相同提交首次与第二次运行的检查、工具安装和依赖准备耗时，列明命中与未命中的缓存 |
| CI-19 | runner 镜像逐层公开审计通过，版本 tag 与远端 digest 核验一致，匿名完整拉取成功后才切换 ARC |
| CI-20 | 新模板先注册并接单。已验证现用 tag 可拉取后退出旧模板，再回收无引用资源 |

## PostgreSQL 检查版本

开发与 CI 的 PostgreSQL 主版本为 18，补丁版本由软件源提供。各仓仍在使用的旧 setup tag 通过元包选择已安装主版本，上海 runner 预装 PostgreSQL 18。Tooling 的 develop 已显式检查或安装主版本 18 的服务端和客户端。

本地可以通过 STUHELPER_TEST_PG_BIN 指定任务专用工具目录。测试仍使用独立数据库、运行身份和可清理资源。生产部署按实际验收后的明确镜像版本维护，开发依赖更新不触发生产升级。
