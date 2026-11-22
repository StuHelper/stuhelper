---
type: design
status: Accepted
updated: 2026-11-21
---

# 身份能力与私有认证边界

学生资格和独立实名由 verification 管理。登录由独立 Casdoor SSO 提供，StuHelper 会话由 backend 管理。公共业务模块通过获授权接口获取动作所需的资格结论。

认证流程、学校方法、身份归属和材料管理由私有 verification 仓库维护。学校认证和数据来源由私有 campus-adapters 接入。参见[私有认证设计](https://github.com/StuHelper/stuhelper-verification/blob/develop/docs/design/student-identity.md)。

业务对接提供必要的状态、范围、有效期与稳定标识。用户从个人中心发起认证、查看自己的资格或实名结果，认证变化由各业务按本模块规则处理。参见[公共对接说明](../spec/student-verification.md)。

模块与仓库归属见[多仓库设计](module-repositories.md)。
