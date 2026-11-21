---
type: guide
status: Accepted
updated: 2026-11-21
---

# SSO 候选工具的位置

在私有 stuhelper-ops 仓库根目录运行 `services/casdoor/resolve_candidate.py`。工具需要 Python 3.11+、已认证的 GitHub CLI，以及到 GitHub API 和 Docker Hub 的连接。精确版本查询和故障处理见[候选解析指南](https://github.com/StuHelper/stuhelper-ops/blob/develop/docs/guide/sso-candidate.md)。

工具核对稳定 v4 的 GitHub release、源码提交与官方镜像清单。候选记录使用明确版本 tag，并单独保存镜像及各平台 digest 作为核验依据。运行状态以[迁移记录](../development/sso-migration.md)为准。
