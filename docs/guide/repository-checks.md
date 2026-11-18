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

当前不配置 pre-push。完整检查由显式命令和 CI 执行。修改依赖后先安装新锁文件，再提交。CI 设置 `LEFTHOOK=0`，直接运行检查入口。

## 工作区与应用测试

`scripts/architecture.mjs` 验证模块、依赖和规格；`scripts/workspace.mjs` 处理 Mani 约定、工具链、Go Workspace、契约来源与联调快照。通用检查器及其回归测试在工具仓库维护。

应用联调使用 platform 公开示例、Web 和 Admin。先构建三者，运行 `node scripts/workspace.mjs contracts`，再运行 `pnpm run test:e2e`。浏览器覆盖八种语言与桌面、移动视口，不包含文档站。

契约来源检查缺少声明提交时，按完整 SHA 从提供方 origin 补取 Git 对象，不切换分支或修改源码。客户端可以继续使用兼容的旧版契约。

普通 develop push 和面向 develop 的 PR 检出各仓 develop。PR 改动 workspace.lock.json 时使用候选提交。面向 main 的 PR 使用锁定组合。main push 和手动运行可按发行锁文件重放，手动输入完整 SHA 可覆盖单项。

发布候选须登记每个参测仓库的干净提交及版本 tag。含 storage 并发配额缺陷的提交不能用于新发行候选。CI summary 列出锁定组合及实际检出的源码。版本支持三段式及四段式日期 tag。

## 文档预览

本地安装 uv 后运行 `make docs`，命令使用 `uvx --with mkdocs-material --with mkdocs-mermaid-zoom mkdocs serve`。MkDocs 配置只服务开发预览，文档没有独立 uv 项目或锁文件。

CI 保留 Markdown、元信息、链接和导航检查，不安装 MkDocs、不构建或部署文档站。专业 Python 工具可使用自己的标准库或明确依赖，不因此为文档引入 Python 工作区。

公共组合工作流为场景检查显式传入 `--scope=platform,web,admin,catalog,reviews,moderation,storage,media,resources`，只检查该作业实际检出的提供方。省略 scope 时仍执行完整工作区场景检查，范围内缺失测试文件会失败。

客户端场景由 Web/Admin 的 module.json 登记。contracts 按 architecture/modules.yaml 中的客户端规格列表核对编号，并检查对应 TypeScript 单元测试和 Playwright 测试的文件与名称。中央规格只定义行为，不复制客户端测试。

按语言参数化的浏览器用例可以使用完整行为名称后接 `(${locale})` 的模板标题，module.json 登记稳定的行为名称。检查器只接受该明确后缀，其他动态模板仍须使用可核对的固定名称。
