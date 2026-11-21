---
type: guide
status: Accepted
updated: 2026-11-21
---

# 后端交易与收款资料配置

## 适用范围

本指南适用于装配 billing 与 resources 的后端。生产 v0.1.31 使用仅账务模式，保留余额、账务流水和规则入口。资料购买、会员和收款资料按启用相应能力的隔离环境验收。实际部署以私有 ops 基线为准。

行为规则见[资料共享](../spec/resource-sharing.md)、[账户与交易](../spec/wallet-and-points.md)和[动作资格](../spec/action-eligibility.md)。实际实现与验收进展见[后端实施状态](../development/backend-decisions.md)。

## 账务配置与加密密钥

STUHELPER_BILLING_CONFIG 指向私有 JSON 配置。refund_payee_key_file 为必填项，指向绝对路径的普通文件，权限必须精确为 0600，拒绝符号链接。文件在获准的私有环境保存 32 字节随机密钥的 Base64 文本，启动时校验长度。

WalletService 与 Repository 使用同一个 AES-256-GCM 密钥实例，账号查询使用同一 Repository。密钥不得进入源码、日志或客户端。缺失、长度无效或文件权限不符时，启动拒绝启用账务能力。

```json
{
  "environment": "production",
  "database_dsn_file": "/run/stuhelper-secrets/billing-dsn",
  "connections": 8,
  "payment_mode": "disabled",
  "refund_payee_key_file": "/run/stuhelper-secrets/refund-payee-key"
}
```

`disabled` 启用仅账务模式，隐藏交易写入入口，渠道和商品选项返回空列表。`simulator` 仅允许在 development 中显式启用。

## 交易事件与数据库身份

`STUHELPER_RELAY_CONFIG` 的 `database_dsn_file` 为 relay 自身身份。启用相应事件源时，`billing_dsn_file` 和 `resources_dsn_file` 分别指向模块运行身份的 0600 DSN 文件。启动时单独验证 LISTEN 连接的权限。

迁移由独立身份执行，运行身份禁止 DDL 和其他模块 schema 访问。候选库使用提供方最终结构，权限不足时启动检查拒绝继续。

| 身份 | 交易所需权限 |
| --- | --- |
| billing | commerce_outbox SELECT/INSERT/UPDATE 与序列 USAGE；commerce_inbox SELECT/INSERT；commerce_revisions SELECT/INSERT/UPDATE；refund_payees SELECT/INSERT/UPDATE/DELETE |
| resources | coverage、purchases、memberships SELECT/INSERT/UPDATE；inbox 仅 SELECT/INSERT；outbox SELECT/INSERT/UPDATE 与序列 USAGE |

两个 outbox 共用统一 relay。提交后唤醒，启动、重连与每 60 秒补读。读取前排除退避主题，按主题保序，每批最多 100 条。失败从 5 秒退避到最多 1 小时，持续 24 小时进入人工队列。

## 检查与恢复

确认资料订单从 paid 推进到 fulfilled，交付拒绝时退回原账户。会员事件按修订更新，下载按当前有效期判断。管理交易需 billing.manage，查看收款资料还需 billing.refund-payee-read，覆盖写入需全站 resources.coverage.manage。

结果未知时先查询原订单。运维使用 `event-retry --config <私有 relay 配置> --summary` 检查积压。使用 `--source billing` 或 `--source resources` 列出人工队列，核对事件后传入 `--id` 重投原事件，沿用原请求和幂等键。

管理端人工重试页面与接口仍待接入。权限与操作要求见[管理规格](../spec/admin-operations.md#跨模块人工事件重试)。

退款收款资料清理与支付核查由单个 worker 串行执行，每 5 秒最多清理 100 条，整轮最多 20 秒，SQL 最多 5 秒。停机先取消并等待任务退出，再关闭连接。

收款资料从上次保存起至少保留三年。到期后仅清理已终结且未设置 `legal_hold` 的退款资料。正式财务保留期限待负责人确认。
