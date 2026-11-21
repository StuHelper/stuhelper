---
type: adr
status: Accepted
updated: 2026-11-21
---

# 0005：使用 Mani 管理开发工作区

## 背景与设计条件

StuHelper 的模块分别维护代码、接口、版本和 GitHub PR。工作区需要统一检出和批量执行各仓操作。生产使用由 ops 管理的明确制品组合。

## 决策与确认依据

使用主机安装的 Mani 统一检出和任务，各仓库独立维护，ops 固定部署组合。仓库保留独立构建和检查入口。

`mani.yaml` 登记 25 个配套仓库及检出路径。Casdoor 使用官方发行原件，部署配置随 ops 维护。仓库访问权限由 GitHub 管理。

## 备选与取舍

Google Repo 提供完整的 revision manifest 和同步流程，适合需要统一维护整套源码版本的项目。West 也能维护多仓库清单，但其 Python 实现和 YAML 配置不足以构成本项目的选型优势。

Mani 更贴近当前日常操作，但 `mani sync` 主要克隆缺失仓库，不负责把已有工作树切换到声明版本。源码更新显式使用 Git。发布组合和兼容验证需要继续由依赖文件、接口测试与 ops 版本记录负责。

## 后果与验证

Mani 配置保留现有 remotes、工作树和 gitignore。开发者直接运行 Mani 命令，CI 在各仓执行实际检查入口。

`mani sync` 初始化工作区。`fetch` 任务只更新远端引用，保留当前分支与文件。候选源码组合、契约来源、独立构建和端到端检查共同验证工作区，操作见[开发工作区](../guide/development-workspace.md)。

## 关联

- [模块仓库边界](../design/module-repositories.md)
- [框架实现设计](../design/framework-runtime.md)
- [Mani 官方配置](https://manicli.com/config/)
