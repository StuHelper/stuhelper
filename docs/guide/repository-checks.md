---
type: guide
status: Accepted
updated: 2026-11-19
---

# 仓库检查与文档预览

## 检查入口

先运行 `make setup` 安装 pnpm 锁文件中的依赖，再运行 `make check`。架构仓库检查自己的模块清单、规格归属、工具链、Markdown、导航和工作流。独立仓库各自执行测试与构建。

共享检查来自 [stuhelper-tooling](https://github.com/StuHelper/stuhelper-tooling)，通过明确版本 tag 安装。Go 正式检查使用 `GOWORK=off`。actionlint 由共享 setup action 安装并校验官方 checksum；本地使用相同版本，版本见工具链清单。

本地将声明版本的 actionlint 加入 PATH。已有 Go 工具链时，可在工作区安装一次供各仓使用：

```bash
mkdir -p .tools/bin
GOBIN="$PWD/.tools/bin" go install github.com/rhysd/actionlint/cmd/actionlint@v1.7.12
export PATH="$PWD/.tools/bin:$PATH"
make setup
make setup-contracts
make check
mani run check --tags code
node scripts/workspace.mjs toolchains
node scripts/workspace.mjs contracts
```

本地工具安装目录被 Git 忽略。单仓检查只读取已安装工具，缺失时明确失败，不在检查过程中安装依赖。

Mani 原生批量输出用于本地开发。CI 在各仓工作目录直接运行检查命令，以命令的非零退出码判断失败，不依赖 Mani 的批量汇总退出码。

## CI 依赖恢复与浏览器检查

公开 Linux 作业使用托管 Ubuntu。私有作业写 `runs-on: {group: stuhelper-arc}`。Go、Node、镜像和发行的共享工作流按仓库可见性选择入口，调用方引用 tooling 的版本 tag。

复查缓存时记录 run、attempt、实际 runner、依赖锁文件与工具版本。比较同一提交的冷、热运行，分别记录排队、恢复、安装与编译耗时。缓存压缩包大小、包管理器下载计数与网络传输字节分别记录。

纯文档提交仍执行基础检查。可独立跳过的浏览器 job 根据变更路径选择，首次 push、手动运行或无法确定范围时执行完整检查。

## 本地 hooks

每个仓库运行 `pnpm exec lefthook install`。旧克隆若设置了 `core.hooksPath=.githooks`，先核对该值并执行 `git config --local --unset core.hooksPath`，再安装 Lefthook。其他自定义 hook 路径按其用途处理。

pre-commit 检查暂存区快照，包括文件安全、脚本权限、语法和文档；前端增加暂存文件 ESLint。检查使用本地依赖，不联网安装、不修改工作树，也不重新暂存文件。部分暂存、关联 worktree、首次提交、失败和中断清理由工具仓库测试覆盖。

架构仓库对暂存的 `architecture/*`、`mani.yaml`、`scripts/*` 与 `workspace.lock.json` 变更建立临时 Git 索引快照，使用该快照的脚本执行 `node scripts/architecture.mjs`、`node scripts/workspace.mjs validate` 和脚本单元测试，在提交阶段拦截模块依赖与锁文件错误。

当前不配置 pre-push。完整检查由显式命令和 CI 执行。修改依赖后先安装新锁文件，再提交。CI 设置 `LEFTHOOK=0`，直接运行检查入口。

## 工作区与应用测试

`scripts/architecture.mjs` 验证模块、应用与运维清单的依赖和规格归属；`scripts/workspace.mjs` 以 `architecture/modules.yaml` 为数据源核对 Mani 公私标签、工具链、运行描述、全量客户端契约来源与联调快照。通用检查器及其回归测试在工具仓库维护。

公开应用联调先记录九个仓库的实际提交、检查契约并构建 platform、Web 和 Admin。浏览器阶段使用相同的提交，分成框架、学术、Web 资料和 Admin 资料四组独立运行。

浏览器覆盖八种语言的桌面和移动视口。学术 Web 用例逐页检查脚本异常、缺失翻译、文字方向和横向溢出。无语言偏好时默认中文，在两种视口各检查一次。

每份客户端 OpenAPI 快照须有同名来源记录，每份来源记录也须有对应快照。同一提供方有多份契约时逐份核对。客户端可以继续使用兼容的旧版契约。

缺少声明提交时，按完整 SHA 从提供方 origin 补取 Git 对象，保留当前检出。先运行 `make setup-contracts` 安装固定版本的 oasdiff 并核对归档 SHA-256。契约内容不同时使用本地二进制比较。补取 Git 对象和比较契约各限时 60 秒。

workspace.lock.json 声明 release 时，公开集成在 PR、push 和手动运行中均使用锁定的发布提交。每项记录 tag 与完整 SHA，CI summary 分别列出完整发布组合和实际检出测试的仓库。手动提供完整 SHA 可覆盖单项，实际组合会显示该差异。

没有 release 标记时，普通集成继续解析 develop，已登记的候选 PR 使用候选锁文件。发布锁文件通过核验远端注释 tag 后维护，不使用本地候选 snapshot --write 覆盖。

## 文档预览

本地安装 uv 后运行 `make docs`，命令固定 `mkdocs==1.6.1`、`mkdocs-material==9.8.1` 与 `mkdocs-mermaid-zoom==0.1.0` 并开启 `--strict` 严格校验。MkDocs 配置只服务开发预览，文档不维护独立 uv 项目。

CI 保留 Markdown、元信息、链接和导航检查，不安装 MkDocs、不构建或部署文档站。专业 Python 工具可使用自己的标准库或明确依赖，不因此为文档引入 Python 工作区。

公共组合工作流为场景检查显式传入 `--scope=platform,web,admin,catalog,reviews,moderation,storage,media,resources`，只检查该作业实际检出的提供方。省略 scope 时仍执行完整工作区场景检查，范围内缺失测试文件会失败。

客户端自身场景由 Web/Admin 的 module.json 登记。contracts 按 architecture/modules.yaml 中的客户端规格列表核对编号，并检查对应 TypeScript 单元测试和 Playwright 测试的文件与名称。客户端 module.json 与中央清单登记的跨仓场景分别核对，任一清单引用失效都会中止检查。

按语言参数化的浏览器用例可以使用完整行为名称后接 `(${locale})` 的模板标题，module.json 登记稳定的行为名称。检查器只接受该明确后缀，其他动态模板仍须使用可核对的固定名称。
