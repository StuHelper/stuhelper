---
type: adr
status: Accepted
updated: 2026-11-21
---

# 0001：独立运行官方 Casdoor 镜像

## 背景与设计条件

独立身份服务保留现有 SSO 数据及各业务系统的账号绑定。主站停止或升级时，Casdoor 继续提供登录和身份接口。

## 决策与确认依据

采用未经修改的官方 `casbin/casdoor` Docker 镜像，使用明确的官方版本 tag 拉取和运行，digest 另存为核验记录。SSO 使用独立配置、数据存储和维护入口；业务系统通过 OIDC 与官方 API 接入。品牌与登录策略使用官方配置能力。

2026-10-24，项目负责人确认以明确 tag 配置日常运行版本，便于定位制品和清理本地镜像。备选版本及回退版本都记录 digest，用于核验拉取的官方镜像内容。

## 备选与取舍

官方镜像能固定运行制品和基础环境。直接运行 release 二进制需要自行维护运行环境，维护源码 fork 还会引入补丁和构建成本。

## 后果与验证

Casdoor 运维使用官方原件。私有 ops 已提供版本候选解析、现役部署和单服务回退操作。跨站复制与身份服务接管按 SSO 迁移记录单独验收。

数据与身份验收以 [SSO 规格](../spec/sso-compatibility.md)为准；机制见[独立 SSO 设计](../design/independent-sso.md)，实际进度见[迁移工作记录](../development/sso-migration.md)。
