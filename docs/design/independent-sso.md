---
type: design
status: Accepted
updated: 2026-11-21
---

# 独立 SSO 与应用边界

SSO 使用官方 Casdoor 发行原件，独立部署并维护 PostgreSQL、Redis、入口和更新流程。AI、Store 和 StuHelper 分别通过 OIDC 接入。主站业务模块的关闭或升级独立于 SSO。

各消费方按 issuer 和 subject 保存既有账号绑定，身份合并不能依据邮箱、手机号或显示名推断。应用通过 OIDC 和官方 API 使用身份能力，数据访问由 Casdoor 管理。

主备设计要求接管时沿用原 issuer、账号、签名密钥与应用配置，并在备用节点取得写入权之前隔离旧主。当前运行及演练范围见[迁移记录](../development/sso-migration.md)。

完整配置与恢复设计见[私有 SSO 设计](https://github.com/StuHelper/stuhelper-ops/blob/develop/docs/design/independent-sso.md)。公有客户端的认证方式见[原生端设计](native-clients.md)。
