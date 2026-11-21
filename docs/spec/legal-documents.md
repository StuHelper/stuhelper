---
type: spec
status: Accepted
updated: 2026-11-22
---

# 法律文件与版本

## 职责与数据

legal 管理法律文件、全局变量、发布快照和操作审计。文件同时服务主站、SSO 和业务模块，因此由私有 backend 宿主装配独立模块。legal 使用独立的 PostgreSQL schema、迁移身份和运行身份。identity、resources 和其他消费者通过服务接口读取版本引用，各自保存同意记录。

同时启用 legal 和 identity 时，主站同意流程自动从 legal 读取 `terms` 与 `privacy` 的当前生效版本。任一当前版本缺失、读取失败或个人同意未完成时，其他需要同意的业务接口拒绝该请求。

法律文件以 `slug` 标识，以 `slug` 和 `version` 唯一定位版本。每个版本保存标题、Markdown 正文、生效日期、修订号和状态。发布版还保存发布时间、发布人、变量快照、渲染得到的 HTML 和 SHA-256 摘要。

初始导入读取法律文件体系 3.0 运营审阅稿。主体、地址、备案号、联系邮箱和供应商等可重复使用的内容写为变量。未确认的运营值留空。所有文件从草稿开始，生效日期由运营确认。

| 标识 | 文件 |
| --- | --- |
| `terms`、`privacy` | 主站用户服务协议与隐私政策 |
| `sso-terms`、`sso-privacy` | SSO 账号注册条款与隐私政策 |
| `content-rules`、`upload-license` | 内容管理规范与资料及用户内容上传授权协议 |
| `minors`、`transactions-refunds` | 未成年人保护及交易、权益与退款规则 |
| `cloud-storage`、`developer-terms` | 云盘托管与存储贡献协议、开放平台开发者协议 |
| `cookies-third-parties`、`infringement` | Cookie 与第三方清单、侵权投诉与反通知指引 |

## 编辑与发布

- 标题和 Markdown 可以引用 `{{variable_key}}`。变量键使用英文小写、数字和下划线，以字母开头。全局变量有说明、当前值、修订号和修改审计。保留键 `document_version` 与 `effective_date` 来自每个版本的元数据。
- 草稿可新增、编辑、预览和删除。版本号在创建时确定，生效日期允许留空保存。发布要求有效生效日期、已定义且非空的引用变量，并检查 Markdown。服务端拒绝原始 HTML 与不安全的链接。变量作为普通文本插入，邮箱链接使用允许的 `mailto:` 写法。
- 发布在同一事务保存使用到的变量值、完整 HTML、摘要和审计。摘要为 HTML 精确 UTF-8 字节的 SHA-256 小写十六进制值。变量改动后，管理员从 `changed_variables` 查看受影响版本。更新对外内容时，创建新的版本并发布。
- 按北京时间日期选择已生效的已发布版本，依次按生效日、发布时间和版本号倒序。归档后重新按该规则选择当前版本。已发布和已归档版本保留原文与摘要，可按固定地址查阅。历史列表也包含尚未生效的已发布版本。

## 公开与管理接口

匿名公开入口位于 `/api/v1/legal/documents/{slug}`。当前和固定版本均返回 `slug`、`title`、`version`、`effective_date`、`published_at`、`digest` 与 `html`。历史列表返回同组元数据及分页。已发布的 HTML 入口使用同一份渲染内容。

| 请求 | 路径后缀 |
| --- | --- |
| 读取当前生效版本 | 当前入口 |
| 枚举公开历史 | `/versions` |
| 读取固定版本 | `/versions/{version}` |
| 获取可直接显示的 HTML | 当前或固定版本入口追加 `/html` |

管理入口位于 `/api/v1/admin/legal`。服务端核验当前会话和请求人的平台管理员资格。表中的管理操作免个人同意检查，管理员可以先维护草稿并发布首版。预览与变更需要 CSRF 令牌，持久变更另需幂等键。管理读取、预览和变更均记录审计。

更新、删除、发布和归档在 `If-Match` 中传入带双引号的修订号。

| 路径 | 可用操作 |
| --- | --- |
| `/documents` | 列举各文件版本及变量变更提示 |
| `/documents/{slug}/versions` | 列举指定文件的版本，创建草稿 |
| `/documents/{slug}/versions/{version}` | 读取版本，更新或删除草稿 |
| 单版本路径追加 `/preview`、`/publish`、`/archive` | 预览、发布、归档 |
| `/variables`、`/variables/{key}` | 列举、新建、读取、更新与删除全局变量 |

接口返回稳定的错误码和字段校验信息。原请求重试沿用同一个幂等键、请求体与修订号。编辑冲突时重新读取服务端版本，由操作者决定如何合并。精确字段以 OpenAPI 为准。[法律文件 OpenAPI](https://github.com/StuHelper/stuhelper-backend/blob/develop/contracts/legal.openapi.json)

## Web、SSO 与 Admin

- Web 提供可匿名访问的 `/legal/{slug}`，直接渲染服务端 HTML，并显示版本、生效日和历史入口。历史详情以固定版本为地址。当前版本不存在时显示暂未发布，服务不可用时允许重试。现有 `/terms.html` 继续作为主站协议入口。
- 注册与主站同意使用各自的文件。SSO 弹窗用 GET 读取 `sso-terms` 的 HTML，隐私政策链接指向 `sso-privacy`。跨域读取只允许配置的 SSO 来源，响应提供单一 `Access-Control-Allow-Origin`，无需登录或跨域凭据。正式切换前核对注册页面实际加载的版本与正文。
- 主站同意通过 `GET /api/v1/auth/consent` 读取 `terms`、`privacy` 的固定版本引用。每次 POST 提交一份文件的 `document_id`、`version`、`digest` 和主动确认。全局 `required` 为 false 时恢复进入业务。
- Resources 原创授权从 `GET /api/v1/resources/capabilities` 的 `terms` 读取 `upload-license` 的标识、固定链接、版本和摘要，按实际展示的版本勾选。上传请求将标识、版本、摘要和主动确认写入 `origin.consent`。
- 主站收到 `409 consent_version_changed` 后重读同意状态。原创提交收到 `400 resources_invalid_input` 时刷新上传能力并比较条款版本及摘要。两处都清除已变化项目的勾选，由用户重新确认。历史回执按所引用的固定版本查阅。
- Admin 展示文档版本列表、Markdown 编辑器、可插入变量、独立变量设置、预览与发布确认。显示草稿、已发布及已归档状态和生效日。历史版本只读，提供基于历史版本创建新草稿的操作。对 `changed_variables` 提示涉及的版本与变量，保存后刷新提示。
- 首次发布前和会话待同意时，Admin 使用 `GET /api/v1/admin/legal/documents` 获取文档列表并确认管理授权。待同意时，会话响应保留 `authenticated`、`consent_required`、`csrf_token` 等必要信息。法律文件管理入口依据管理接口的成功响应开放，按响应处理未登录、无权限和服务不可用。
- 预览使用服务端同一渲染器，可发送未保存的草稿字段。Admin 保留失败时的输入，按错误明细定位变量或正文，修订冲突时显示最新版本。清单使用后端分页。各界面覆盖八语言、键盘操作和窄屏。

Web 与 Admin 从同一 backend 提交复制 `contracts/legal.openapi.json` 和 `sdk/legal/legal.gen.ts`。在 `contracts/legal.source.json` 中记录提供方仓库、完整提交、契约版本、文件映射和 SHA-256。页面使用该快照的生成类型。

切换前按旧版实际发布字节存档，核对旧摘要并登记可访问的历史地址。旧回执继续引用当时的版本与摘要。运维指南说明主站兼容地址、SSO 与跨域规则的切换步骤。[法律文件接入指南](https://github.com/StuHelper/stuhelper-ops/blob/develop/docs/guide/legal-documents.md)

## 验收场景

| 编号 | 预期结果 |
| --- | --- |
| LEGAL-01 | 发布后修改或删除全局变量，管理端提示受影响版本，公开快照和 SHA-256 保持一致。 |
| LEGAL-02 | 草稿仅管理端可读。将来生效的版本可在公开历史查阅。生效日切换当前版本，归档后仍可读固定版本。 |
| LEGAL-03 | 普通用户的管理操作被拒绝。待同意的管理员可发布首版，管理权限、CSRF 与审计仍有效。合法并发变更只产生预期写入，同键异载荷或旧修订被拒绝。 |
| LEGAL-04 | legal 运行身份可执行必要读写，无法修改 schema 或越权访问其他模块。 |
| LEGAL-05 | 预览和发布均检查未定义变量、空值、原始 HTML 和危险链接。失败的发布没有公开快照。 |
| LEGAL-06 | 同意记录引用展示的版本和摘要。主站协议或隐私政策缺少当前版本时需同意的业务不可用。原创授权版本变化后，重新同意才能提交。 |
| LEGAL-07 | 3.0 导入只创建草稿和初始变量。重跑保留后台现有版本和变量。 |
| LEGAL-08 | 兼容 HTML 与 JSON 正文的字节一致。SSO 来源可读取相应 HTML，其他来源不获跨域授权。 |
