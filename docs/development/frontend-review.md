---
type: development
status: Accepted
updated: 2026-11-21
---

# 前端审查处理

## 当前状态

下表记录 Web 审查缺陷的修复结果及回归位置。正式 Web 与 Admin 使用已生成的生产接口，Web 的审阅原型由 `VITE_DEMO=1` 单独启用。当前接口接入见[后端实施](backend-decisions.md)。

## 已修复的缺陷

| 编号 | 问题 | 回归测试 |
| --- | --- | --- |
| F01 | 切换语言丢失未保存评价 | `tests/demo/prototype.spec.mjs` |
| F02 | 认证路由切换保留错误流程 | `tests/e2e/page-state-regressions.spec.mjs` |
| F03、F14 | 课程列表不跟随地址，忽略教师条件 | `tests/demo/prototype.spec.mjs` |
| F04 | 同一教师评分来源不一致 | `src/demo/server.test.ts` |
| F05 | 游客可打开模拟通知 | `tests/demo/prototype.spec.mjs` |
| F06 | 无访问权入口误接投诉 | 代码移除入口，未单独加测试 |
| F07 | 超时不覆盖响应正文 | `src/shared/api/http.test.ts` |
| F08 | 重试成功后未应用结果 | `tests/e2e/page-state-regressions.spec.mjs` |
| F09 | 切换标签丢失草稿输入 | `tests/demo/prototype.spec.mjs` |
| F10 | 切换编辑对象后写入旧对象 | `tests/e2e/page-state-regressions.spec.mjs` |
| F11 | 切换标签丢失未决申请恢复入口 | `tests/e2e/custody.spec.mjs` |
| F12 | 退出登录不清理最近浏览 | `src/shared/session.test.ts` |
| F13 | 动态选项字段绑定错误 | `tests/e2e/page-state-regressions.spec.mjs` |
| F15 | 手机课程详情横向溢出 | `tests/demo/prototype.spec.mjs` |

## 学术页面的部署能力

Web 和 Admin 对已接入能力判断的可选入口有浏览器回归，覆盖菜单隐藏、直接访问和能力发现失败后的页面行为。服务端仍须对业务请求执行授权。

按 develop 路由检查，Web 课程列表和评价详情缺少相应的能力声明，Admin 审核队列未纳入路由能力映射。三处均需复验在空能力列表下是否满足 CAP-01；历史组合曾在这些入口发出模块请求。

## 已验证与待验证

管理端评课与目录浏览器用例使用可访问名称定位，覆盖键盘选择、Escape 关闭抽屉、八语言与 RTL。正式 Admin v0.1.11 的 `/admin/` 变体通过八语言桌面和移动端检查，覆盖深链接、刷新、学校权限范围和存储准入。

v0.1.31 的隔离组合已验证正式客户端的后端会话与管理权限。全量人工视觉复核、屏幕阅读器实机、大文件内存基准及生产真实账号流程待验收。组合记录见[框架实施](framework-bootstrap.md#统一业务组合验收)。
