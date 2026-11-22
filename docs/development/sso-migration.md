---
type: development
status: Accepted
updated: 2026-11-22
---

# SSO 迁移进度与私有文档

## 当前运行

生产已使用官方 Casdoor 4.24.0、独立 PostgreSQL 和 Redis，已恢复旧身份数据并沿用公开 issuer。应用会话由 StuHelper 后端单独管理。

生产入口使用负责人通过独立服务器上的 Certimate 自动续签并部署的 TLS 证书。证书巡检与续签由外部运维负责。

Casdoor 终态投递记录保留 6 个自然月。生产定时清理尚未启用，计划随下次 Ops 发行上线。期限见[数据保留与删除](../spec/data-retention.md)。

Ops develop 已提供定时清理。经批准的本地数据库维护例外限于指定 Webhook 的终态投递记录，按到期时间分批处理。常规 Casdoor 操作仍使用官方 API。安装、权限和保留例外见[私有 Ops 指南](https://github.com/StuHelper/stuhelper-ops/blob/develop/docs/guide/sso-failover.md#casdoor-webhook_event-终态记录维护)。

## 已验证

迁移核对覆盖历史签名、已登录会话样本及启用续期的应用。StuHelper v0.1.31 上线后，公网 discovery、健康检查及应用匿名鉴权通过。范围与证据见[私有 SSO 迁移记录](https://github.com/StuHelper/stuhelper-ops/blob/develop/docs/development/sso-migration.md)和[私有生产基线](https://github.com/StuHelper/stuhelper-ops/blob/develop/docs/development/production-baseline.md)。

## 待验证

完整消费者真实账号矩阵和实际短信仍待验收。

## 延后

SSO 日常备份的异地留存与恢复、备用服务器接管延后。实施范围见[私有 SSO 迁移记录](https://github.com/StuHelper/stuhelper-ops/blob/develop/docs/development/sso-migration.md)。

## 当前不实施

SSO 备用库的同步或异步提交策略，以及切换备用 SSO 后的会话恢复。
