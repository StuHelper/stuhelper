---
type: adr
status: Accepted
updated: 2026-11-21
---

# 0003：采用 project-docs-starter 文档架构

## 背景与设计条件

按主题查找目标行为、实现机制和验证证据，需要稳定的内容分类和维护入口。

## 决策与确认依据

采用项目负责人于 2026-10-23 指定的 [project-docs-starter](https://github.com/lihaotong0712/project-docs-starter/tree/1c4c6bb1bd401b803ea986b404932926cfc95eb0) 架构，基线 commit 为 `1c4c6bb1bd401b803ea986b404932926cfc95eb0`。

文档分为 design、spec、development、guide 和 adr。各类提供入口和模板，使用 `type/status/updated` 元信息。完整规则维护在所属主题，其他页面通过链接引用。

## 适配与取舍

本地通过 uvx 运行固定版本的 MkDocs Material。根仓脚本与共享 tooling 在 CI 检查格式、元信息、链接和导航。

根 README、AGENTS 和 CONTRIBUTING 提供工程入口。主题正文按所属类别维护。

## 后果与验证

文档确认状态、实际实施和验证结果分别维护。格式与导航规则见[维护约定](../authoring.md)，检查入口见[检查指南](../guide/repository-checks.md)。
