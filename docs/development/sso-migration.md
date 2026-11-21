---
type: development
status: Accepted
updated: 2026-11-21
---

# SSO 迁移进度与私有文档

## 当前运行

生产已使用官方 Casdoor 4.24.0、独立 PostgreSQL 和 Redis，已恢复旧身份数据并沿用公开 issuer。应用会话由 StuHelper 后端单独管理。

Casdoor 终态投递记录保留 6 个自然月，定时清理由 Ops 随下次发行交付。期限见[数据保留与删除](../spec/data-retention.md)。

## 已验证

迁移核对覆盖历史签名、已登录会话样本及启用续期的应用。StuHelper v0.1.31 上线后，公网 discovery、健康检查及应用匿名鉴权通过。范围与证据见[私有 SSO 迁移记录](https://github.com/StuHelper/stuhelper-ops/blob/develop/docs/development/sso-migration.md)和[私有生产基线](https://github.com/StuHelper/stuhelper-ops/blob/develop/docs/development/production-baseline.md)。

## 待验证与待确认

完整消费者真实账号矩阵、实际短信和跨主机接管仍待验收。备用节点的复制与接管尚未启用。复制提交方式及故障接管时的会话策略见[私有 SSO 迁移记录](https://github.com/StuHelper/stuhelper-ops/blob/develop/docs/development/sso-migration.md)。
