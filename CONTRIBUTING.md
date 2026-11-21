# 贡献说明

日常开发从最新 `origin/develop` 建短期分支，通过 PR squash 合入 develop。若依赖尚未合并的工程改动，应先确认该依赖的分支、版本与合并顺序，保留已确认的工程规则。

本地按逻辑单元提交，在需要备份、协作或远端验证时批量推送。同一任务可以多次提交、推送，并持续更新同一个 PR。根仓在面向 develop、main 的 PR 及这两个分支的 push 上运行架构检查。公开应用联调按变更路径触发，具体范围见 [CI 规格](docs/spec/ci-runners.md)。

正式发布通过 develop → main PR，使用 merge commit。经负责人授权后创建不可移动的版本 tag。各组件独立编号，根仓的 [workspace.lock.json](workspace.lock.json) 记录联合发行版本、组件 tag 和源码提交。Ops 记录实际部署与验收结果。

文档采用 [project-docs-starter 五类架构](docs/README.md)，遵循[维护约定](docs/authoring.md)和[沟通与写作规范](AGENTS.md)。行为规则放 spec，实现机制放 design，实际进度与证据放 development，可重复操作放 guide，重要取舍放 adr。移动文件时同步修改链接与 MkDocs 导航。

首次安装依赖后运行 `make hooks`，启用暂存区检查。提交前的 hook 读取暂存快照，完整仓库检查用 `make check` 执行。操作见[检查指南](docs/guide/repository-checks.md)。新增业务实现后，为关键行为和失败场景增加测试，分别记录业务、移动端和迁移验收结果。

公开仓库的 Linux 检查和 GHCR 镜像发行使用 GitHub 托管 runner。私有 Linux 作业使用 `stuhelper-arc` 组，私有镜像通过站点 BuildKit 构建。Casdoor 直接使用官方镜像。

新增模块先修改架构清单，定义数据所有权、接口、事件、必需/可选依赖、关闭行为和迁移责任。不得让客户端直接拼接跨模块私有数据，或让模块直接操作另一个模块的表。

禁止在公开 Issue、PR、代码、日志或附件中包含生产身份、账号绑定、凭据、备份及真实测试账号数据。安全问题通过 GitHub 私密漏洞报告提交。

贡献采用 AGPL-3.0-only，并保留第三方许可证。
