# StuHelper

StuHelper 是校园信息平台，采用 Go、Vue、stuhelper-admin 和按业务划分的独立仓库。Casdoor 使用官方发行版本，各业务通过 OIDC 和官方 API 接入。

生产运行 [StuHelper v0.1.31](https://github.com/StuHelper/stuhelper/releases/tag/v0.1.31)。本批采用 Backend v0.1.46、Web v0.1.22 和 stuhelper-admin v0.1.11。生产就绪、公开页面及匿名访问限制已核验。真实账号操作与短信投递仍待负责人验收。

platform 提供应用框架，backend 装配业务模块。Web 和 stuhelper-admin 提供八种界面语言。课程、评价、审核、学习资料和存储的源码归属见[模块仓库](docs/design/module-repositories.md)，实现与验证结果见[开发工作](docs/development/README.md)。

## 工程入口

| 入口 | 用途 |
| --- | --- |
| [文档导航](docs/README.md) | design、spec、development、guide、adr 五类文档 |
| [开发工作区](docs/guide/development-workspace.md) | Mani、独立仓库和任务工作树 |
| [检查指南](docs/guide/repository-checks.md) | 本地检查、联调和检查器说明 |
| [依赖维护](docs/guide/dependency-maintenance.md) | 工具链升级、Dependabot 和 Vben 更新 |
| [业务范围](docs/design/business-scope.md) | 当前实施与延期范围 |
| [术语](docs/spec/terminology.md) | 领域概念、API 名称与翻译约定 |

## 本地开发

在根仓运行以下命令安装锁定依赖并执行仓库检查。Git 和 Mani 使用主机安装的版本，Go、Node.js、pnpm、actionlint 等工具的版本见[工具链清单](architecture/toolchains.yaml)。

```bash
make setup
make check
```

开发多个模块时，用 `mani sync` 检出 [Mani 清单](mani.yaml)登记的仓库，再按[开发工作区](docs/guide/development-workspace.md)安装各仓依赖。主检出位于 `workspace/<仓库名>`，任务工作树位于 `workspace/worktrees/<任务>/<仓库名>`。

根仓检查架构、文档、工作区配置与 Actions。跨仓契约检查需要提供方与消费方源码，浏览器联调还需要构建应用并安装 Chromium。操作说明见[检查指南](docs/guide/repository-checks.md)，构建顺序见[公开应用联调工作流](.github/workflows/applications.yml)。

公开应用联调使用 platform 示例、Web 和 stuhelper-admin。正式后端按自身 Go 依赖构建。根仓的 [workspace.lock.json](workspace.lock.json) 固定发行组合的组件 tag 和源码提交，CI 的运行摘要记录实际检出的组合。

## 技术约定

- 模块拥有自己的接口和数据，通过公开接口协作。必需依赖用于判断模块基础可用性，可选依赖通过能力级规则影响具体操作。
- Casdoor 独立部署，应用通过 issuer、subject 标识用户并保存消费方绑定。社区评价与共享资料由各自模块维护。
- Web 和 stuhelper-admin 默认中文，提供八种界面语言。国际化检查覆盖消息键、插值、复数和区域格式，翻译质量由人工审阅，阿拉伯语使用 RTL 布局。
- 公开 Linux 检查和镜像发行使用 GitHub 托管 runner。私有 Linux 作业通过组织 runner group 接单。调度、依赖缓存和镜像验收见 [runner 规格](docs/spec/ci-runners.md)。
- 短期分支通过 PR squash 合入 develop。正式发行由 develop 向 main 合并，经负责人授权后创建版本 tag、镜像和生产晋级。

## 目录

```text
architecture/        模块、语言和工具链清单
docs/                五类工程文档
scripts/             架构与跨仓工作区检查
tests/e2e/           跨仓浏览器联调
mani.yaml            统一工作区配置
workspace.lock.json  发行组合的组件 tag 与源码提交
```

文档组织参考 [project-docs-starter](https://github.com/lihaotong0712/project-docs-starter/tree/1c4c6bb1bd401b803ea986b404932926cfc95eb0)。项目代码和文档使用 [AGPL-3.0-only](LICENSE)，第三方组件保留原许可证。沟通与写作遵循 [AGENTS.md](AGENTS.md)。
