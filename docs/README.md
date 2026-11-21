---
type: index
status: Accepted
updated: 2026-11-21
---

# StuHelper 文档

StuHelper 采用独立的官方 Casdoor SSO，以及按业务模块划分的多仓库。查看[业务范围](design/business-scope.md)了解校园业务、身份和账务规则。当前客户端包括 Web 和 stuhelper-admin。

当前生产版本为 [StuHelper v0.1.31](https://github.com/StuHelper/stuhelper/releases/tag/v0.1.31)。各模块的实现、隔离验收和待验证事项见[开发工作](development/README.md)。生产部署记录和真实账号验收由私有 Ops 仓库维护。

本项目按 [project-docs-starter](https://github.com/lihaotong0712/project-docs-starter/tree/1c4c6bb1bd401b803ea986b404932926cfc95eb0) 的五类文档架构组织资料。写作规则见[文档维护约定](authoring.md)。

| 分类 | 阅读目的 | 入口 |
| --- | --- | --- |
| design | 理解目标、概念、架构和实现机制 | [项目设计](design/README.md) |
| spec | 查询预期行为、边界与验收场景 | [功能与模块规格](spec/README.md) |
| development | 查看调研依据、工作计划、进度和实际验证 | [开发工作](development/README.md) |
| guide | 执行已有工具、检查或维护任务 | [操作指南](guide/README.md) |
| adr | 说明架构选择及取舍 | [决策记录](adr/README.md) |

查找代码归属时，从[模块与仓库](design/module-repositories.md)进入。查询行为时看对应规格，查询已实现和已验证的范围时看对应开发记录。`Accepted` 表示文档所述规则已确认。
