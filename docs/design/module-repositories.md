---
type: design
status: Accepted
updated: 2026-11-22
---

# 按模块划分仓库

## 划分原则

项目按业务模块分仓。每个模块维护自己的代码、数据、接口和版本，其他模块通过公开接口或事件协作。

可插拔表示模块可以启停、替换或独立升级，并且缺失时有明确的功能表现。仓库边界与运行进程分别设计。公开和私有业务 Go module 都可静态编译进私有 backend；独立进程按实际运行需求选择。Casdoor 独立部署。启用机器人时，Koishi 作为独立服务接入。platform 的公开检查不读取私有源码。

本仓库保留跨模块架构、公共业务规格、接口目录和迁移进度。各模块仓库维护自己的详细设计、实现、验收与迁移。私有模块的具体设计存放于私有仓库，公开页面只说明用户入口及必要对接范围。

完整开发工作区由一份 Mani 清单登记。仓库可见性表达代码和文档的保密范围，GitHub 管理仓库访问权限。业务管理员、学校范围和普通用户权限由运行中的服务管理。各仓库按自身接口依赖独立构建，同进程模块通过 Go 接口与函数协作，独立服务通过网络 API 协作。

## 仓库与数据归属

下表对应 [Mani 工作区清单](https://github.com/StuHelper/stuhelper/blob/develop/mani.yaml)。backend 维护应用装配、identity 和 legal。同仓模块各自拥有接口、数据与运行身份。

| 模块 | 仓库 | 可见性 | 拥有的数据与职责 |
| --- | --- | --- | --- |
| platform | stuhelper-platform | public | 模块注册、接口发现、动作资格配置、授权范围、组合 API 与通用运行能力 |
| identity | stuhelper-backend | private | 本应用 OIDC 接入、身份映射与会话适配 |
| legal | stuhelper-backend | private | 法律文件、全局变量、发布快照及管理审计。见[法律文件规格](../spec/legal-documents.md) |
| 应用装配 | stuhelper-backend | private | main 入口、模块连接、正式二进制与镜像 |
| Web | stuhelper-web | public | 学生端 Web、同源 API 传输与用户业务入口 |
| Admin | stuhelper-admin | public | 基于 Vben 的管理端、运营入口与宿主认证接入 |
| 工程工具 | stuhelper-tooling | public | 共享 CLI、action、workflow 与 Lefthook 预设 |
| profiles | stuhelper-profiles | public | 昵称、头像引用、简介、隐私偏好与业务账号生命周期 |
| verification | stuhelper-verification | private | 学生资格、独立实名、审核材料与具体认证流程 |
| campus-adapters | stuhelper-campus-adapters | private | 学校认证协议、学校数据适配与来源映射 |
| storage | stuhelper-storage | public | 存储实例、准入与容量预占、副本账本、校验修复、可靠任务、清理，以及用户账号托管申请流程 |
| storage-contribution | stuhelper-storage-contribution | public | 贡献同意、额度与保留空间、期限、暂停退出、撤权及核验统计 |
| storage-bhpan | stuhelper-storage-bhpan | public | BHpan 登录、稳定身份、目录与文件传输协议；由 storage 的 adapter 桥接使用 |
| catalog | stuhelper-catalog | public | 学校、院系、学期、课程、教师、开课与个人课表 |
| reviews | stuhelper-reviews | public | 课程评价、导师评论、评分、回复、投票与草稿 |
| resources | stuhelper-resources | public | 统一分类及字段、课程关联、资料版本、作品许可、审核、访问授权、目录与交付状态 |
| billing | stuhelper-billing | private | 积分、Ivory、收费、会员售卖、奖励、退款与交易权益凭据 |
| moderation | stuhelper-moderation | public | 内容审核、举报、申诉与处置结果，内容模块执行状态变化 |
| media | stuhelper-media | public | 通用文件、不可变版本、上传会话、业务引用、当前权限下载与文件清理协调 |
| qq-binding | stuhelper-qq-binding | private | 三项 QQ 身份、验证码、OAuth、绑定审计和事件 |
| favorites | stuhelper-favorites | public | 收藏、收藏夹及目标名称快照 |
| groups | stuhelper-groups | public | 群准入、名片、消息治理与娱乐命令 |
| information-query | stuhelper-information-query | public | 授权范围内的跨模块查询、审计和批量预览 |
| open-platform | stuhelper-open-platform | public | 开发者应用审批、业务授权与撤回 |
| search | stuhelper-search | public | 可重建搜索索引、热度与发现查询 |
| notifications | stuhelper-notifications | public | 站内通知、发送意图、渠道投递与偏好 |
| 运维仓库 | stuhelper-ops | private | Compose、部署组合、官方 SSO/Koishi 运维与恢复 |

延期的社交模块 community 在架构清单中标记为 `not-implemented`，当前工作区不检出 stuhelper-community。动态、关注、屏蔽和动态内互动见[社交规格](../spec/social-content.md)。

campus-adapters 负责学校认证与教务数据接入。文件业务按业务 → media → storage → adapter 的方向调用，供应商凭据由私有 backend 管理。

## 存储架构与代码归属

[通用存储设计](storage-architecture.md#模块职责)中的职责对应下表的代码归属。源码组合和测试结果见[存储实施状态](../development/storage-module.md)。

| 架构中的职责 | 当前模块或仓库 | 边界 |
| --- | --- | --- |
| 课程资料业务 | resources；调用 catalog、moderation 等公开接口 | 课程关联、业务审核、访问权益、展示和目录由使用方维护 |
| 其他业务或文件系统 | 相应业务模块 | 使用 media 的文件引用，不直接操作副本、供应商账号或凭据 |
| 通用文件服务 | media / stuhelper-media | 管理逻辑文件、版本和业务引用，通过 storage 接口使用物理存储 |
| 通用存储服务 | storage / stuhelper-storage | 管理实例、容量、物理副本、放置、校验、修复及清理 |
| 平台存储账号管理 | storage + 私有 backend；Admin 提供运营界面 | storage 保存实例、准入、额度和操作账本；backend 保管凭据并登录供应商 |
| 用户账号托管 | storage 的 custody + 私有 backend | custody 保存同意、申请、归属及恢复状态；backend 执行加密保管、登录和凭据轮换 |
| 用户容量贡献 | storage-contribution / stuhelper-storage-contribution | 选择已托管实例，管理贡献条件，通过 storage 公开接口协调生效和退出 |
| BHpan adapter | storage 的 drivers/bhpan + stuhelper-storage-bhpan | 前者将通用存储端口映射到后者的供应商协议，backend 负责装配 |
| S3/COS 等 adapter | 后续协议实现与桥接 | 当前尚未实现，沿用通用存储端口 |
| 激励与账务 | 奖励规则后续独立实现，记账归 billing | 贡献榜、奖励计算与贡献到账务接入延期，不阻塞存储和文件能力 |

“平台存储账号”指平台持有的云盘或对象存储账号。Admin 的存储账号页面通过 backend 调用 storage 实例管理与托管能力。StuHelper 用户身份及个人资料分别归 identity 和 profiles。

平台实例目前通过 backend 的凭据管理命令和 storage 注册接口接入，再由 Admin 管理额度、暂停、排空与撤销。用户在线托管由 storage/custody 接入，初始实例暂停且贡献额度为零；storage-contribution 在用户另行同意贡献条件后协调使用。

backend 的 credentials 与 bhpancustody 保存和使用敏感凭据，公共 storage 只保存凭据引用及修订。media 不持有账号密码，storage-contribution 不处理登录，也不因用户提交账号就自动取得贡献授权。

上述划分区分逻辑文件、物理存储、账号接入和容量贡献。将来更换供应商时，业务文件引用使用稳定标识，只替换对应 adapter 和托管适配；是否进一步拆分账号托管仓库或进程，按实际复用及部署需要评估。

## 客户端与既有系统

AI、Store、支付网关与独立站点文档沿用各自仓库。平台业务账务维护支付提供方接口与账本规则。参见[私有账务模块与业务接入](wallet-and-points.md)。

已交付 Web 与 stuhelper-admin。微信小程序、Android、iOS 与 HarmonyOS 延期，技术路线与待确认事项见[原生多端设计](native-clients.md)。

客户端按模块组合界面并使用版本化 SDK，服务端执行业务规则。

运维仓库维护部署组合与恢复操作，模块运行时清单单独登记可启停模块。

## 依赖与可替换接口

公共模块只依赖公开的接口定义或 SDK。接口提供方维护 API、事件及兼容范围，使用方固定已验证版本。这里的公开接口表示明确可依赖的契约，不表示互联网匿名访问；运行时仍需身份、权限及范围检查。

模块声明必需依赖与可选能力。必需依赖缺失时该模块不能启用，可选能力缺失只关闭相应功能。动作使用到资格、交易或文件能力时，还要检查相应服务是否可用。例如：

- 不安装 community，课程评价的回复和投票由 reviews 提供，收藏由 favorites 提供。
- 不安装 billing，免费资料继续按访问规则工作，售卖、会员购买与充值入口关闭。
- verification 不可用，需要资格核验的操作返回暂不可用，不自动放宽为未认证也可执行。
- notifications 或 search 不可用，不撤销已经完成的业务写入，投递与索引恢复按事件规则处理。
- 关闭业务模块不影响独立 SSO，也不删除模块数据。

私有模块只向使用方返回动作所需的结论、范围、状态和稳定标识。认证材料、学校方法、数据库结构、支付载荷及生产配置不进入通用事件、公共 SDK、公开 CI 日志或 artifacts。

## 数据、版本与部署

每个模块独立拥有数据库结构、迁移与 Repository，不跨模块读写表，不共享内部 ORM 实体。公共模块可共用数据库实例，但使用独立 schema 与访问身份；私有模块同样使用受限访问身份，独立数据库按部署需要配置。任何组合查询都通过 API 或可重建查询记录完成。

事务内保存业务变更、相关处置记录和待发送事件。跨服务事件允许重复，接收方按事件 ID 去重并检查修订号。跨模块流程记录每一步结果和失败补偿，不假定网络调用具有单库事务的原子性。

模块分别发布版本，兼容修改不要求所有仓库同步升级。破坏接口兼容的修改提供迁移期并进行提供方、使用方契约测试。同一后端二进制的 Go 依赖由 go.mod/go.sum 固定。发行组合记录各组件版本、源码提交与制品摘要。运行配置、活动槽位与回退入口由 ops 维护。

## 文档与当前状态

私有模块的详细规格分别放在对应仓库，公共规格仅保留必要的使用与对接说明。业务规格和模块实施状态分别维护，源码与第三方来源具有独立记录。

[架构模块清单](https://github.com/StuHelper/stuhelper/blob/develop/architecture/modules.yaml)登记模块归属、依赖、能力、契约和场景测试映射。它包含同仓模块与已延期设计，工作区实际检出由 Mani 清单管理。

[框架工作记录](../development/framework-bootstrap.md)和[存储实施状态](../development/storage-module.md)维护源码实施与验证。发行源码组合和生产接续由发布记录及私有 ops 基线维护。
