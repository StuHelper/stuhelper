---
type: development
status: InReview
updated: 2026-11-21
---

# StuHelper 开发路线

## 当前交付

工程基础、模块启停、能力发现及 Web 与 Admin 已随正式组合交付。生产运行 StuHelper v0.1.31。组件和源码提交见[正式工作区锁](https://github.com/StuHelper/stuhelper/blob/v0.1.31/workspace.lock.json)。

| 范围 | 当前交付与验收 |
| --- | --- |
| 工程与模块 | 仓库边界、版本、契约和组件依赖已有可检查的登记。各仓独立检查，正式组合固定版本并通过应用集成 |
| 账号与社区 | 独立 SSO、认证、课程、评课、资料、收藏与通知已接入生产。真实账号的认证、会话及写入流程由负责人在生产核验 |
| 后台与附加业务 | 生产启用审核、存储准入、后台信息查询、仅账务和 QQ 管理与互联。开放平台、群服务及机器人保持关闭 |
| 身份数据与恢复 | v0.1.31 完成身份与认证结构迁移，并在隔离 PostgreSQL 恢复生产加密备份。身份数据的保留、映射和回退遵循 [SSO 兼容规格](../spec/sso-compatibility.md) |

组件实现、隔离组合与生产验收见[框架实施](framework-bootstrap.md)、[后端实施](backend-decisions.md)及[私有 Ops 生产基线](https://github.com/StuHelper/stuhelper-ops/blob/0fc321f665bbbbd3199450ee9dedaf98c349895d/docs/development/production-baseline.md)。

## 后续与待确认

- 生产账号的核验项目由 Ops 维护，包含真实学生认证、QQ 互联、手机号短信、会话范围和资料审核下载。后台及客户端的后续实现记录在相应主题。
- SLO、可接受数据丢失时间、恢复时间和容量目标仍待业务规模及基准证据。异地恢复与目标环境压力基准分别验收。
- 微信小程序、Android、iOS、HarmonyOS 与独立社交功能继续延期。签名、商店账号与 HarmonyOS 工具链在恢复对应客户端开发时验证。
- 会员、价格、奖励和真实支付继续按账务规格及运营配置安排。业务边界见[业务规则与延期事项](business-decisions.md)。
