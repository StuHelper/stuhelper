---
type: guide
status: Accepted
updated: 2026-11-21
---

# 工具链与依赖维护

## 版本来源

Go、PostgreSQL、Node.js、pnpm、Lefthook、actionlint、Playwright 与共享工程工具包版本维护在 `architecture/toolchains.yaml`。工作区命令同步各仓版本文件、Go 模块、包管理器声明、Playwright、工作流工具引用及 tooling 的 PostgreSQL 安装脚本。

CI 从版本文件读取 Go 与 Node.js。Mani 和 Git 是主机工具，开发者自行安装，CI 直接执行各仓检查命令。

## 常规依赖

各仓以 `.github/dependabot.yml` 声明 GitHub Actions、npm 和 Go 等更新范围。维护规则为每周向 develop 提交，次版本和补丁可归组，主版本单独评估。依赖更新按范围运行单仓和组合检查。

安全更新以 GitHub 的依赖图、Dependabot alerts 和 security updates 设置为准。处理 CVE 时先确认受影响的版本、调用路径和修复版本，再运行受影响阶段的检查。

## 工程工具发行

共享 CLI、action 与 reusable workflow 在 stuhelper-tooling 独立维护，以带注释的 `v<版本>` tag 分发。已发行 tag 不得重新指向其他提交。主架构仓库不再发行工具版本。

工具链升级先修改 `architecture/toolchains.yaml`，执行 `node scripts/workspace.mjs toolchains --write`，再更新受影响的 pnpm 锁文件。工具仓库独立测试通过后按授权创建新版本，消费者更新 Git 依赖、Actions 引用和锁文件。

PostgreSQL 主版本升级需要同时核对 tooling 安装脚本、ops 的 runner 预装包及各部署的数据库镜像。生产数据目录的主版本升级按独立迁移流程执行。

pnpm 锁文件固定实际解析提交。首次更新使用 `pnpm install --no-frozen-lockfile`，日常与 CI 使用 `--frozen-lockfile`。公开工具依赖使用 HTTPS 来源，生成锁文件时设置 `GIT_SSH_COMMAND=false` 可防止意外采用本机 SSH 授权。

各仓通过独立检查后，按变更范围执行契约与应用联调。配套 PR 记录实际测试提交和合并顺序，候选改变后重新验证。工具仓库不携带产品模块、术语或语言清单，产品规则由消费者提供。

共享依赖的覆盖写在消费者的 pnpm 配置中。

## Web 脚手架

新建 Vue 应用优先使用官方 `create-vue`。Web 使用 `@vue/tsconfig`、`@vue/eslint-config-typescript` 和 Node 24 配置，产品路由、接口和国际化代码由应用维护。

脚手架适合生成初始结构，升级时仍需要核对依赖的兼容范围。Web 使用 Vue Router 4 和 TypeScript 5.9，主版本升级单独验证。官方说明见 [Vue 快速上手](https://vuejs.org/guide/quick-start)和[工具链指南](https://vuejs.org/guide/scaling-up/tooling)。

## stuhelper-admin 框架升级

上游来源由 `vendor/vben.json` 的 tag、提交和许可证记录。升级时比较该基线、当前应用与新上游，保留 StuHelper 的接口、语言、依赖及工作流设置。重点核对本地国际化、RTL、工具链和框架接入的差异，更新来源记录后执行完整检查及八语言页面验证。

Vben 作为框架来源保留自己的标识和许可证，产品名称使用 stuhelper-admin。

## Admin 编译器兼容

Admin 的 `scripts/contracts` 使用 TypeScript 7 验证契约类型。`scripts/openapi` 单独使用 TypeScript 5.9 的 JavaScript API 生成类型。Vue SFC 与 lint 使用 pnpm catalog 中的 TypeScript 6。
