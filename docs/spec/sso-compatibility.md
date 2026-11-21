---
type: spec
status: Accepted
updated: 2026-11-22
---

# SSO 接入与应用会话

应用继续通过标准 OIDC 与官方 API 接入身份服务。按 issuer、subject 标识账号并保存消费方绑定，不以业务账号注销替代共享 SSO 账号删除。

注册、登录与找回由独立 SSO 提供。本应用当前设备和全部设备退出撤销本应用会话，其他应用按自身规则管理。原生公有客户端不保存 client secret。

身份服务使用官方发行原件。迁移保持原 issuer、subject 和消费方绑定，保留签名验证所需密钥。数据核对与消费者兼容规则见[私有接入规格](https://github.com/StuHelper/stuhelper-ops/blob/develop/docs/spec/sso-compatibility.md)，已完成的运行验收见[迁移记录](../development/sso-migration.md)。

## 主站协议与隐私政策

用户首次登录主站或已同意的条款变更时，须主动同意当前《用户服务协议》和《隐私政策》，才能使用需要登录的业务功能。主站分别提供全文入口与初始未勾选的确认框，由 StuHelper 服务端核对并留证。资料共享、云盘托管等专项授权分别取得同意并留证。

《用户服务协议》以 `terms` 发布，《隐私政策》以 `privacy` 发布，分别保留版本、原文 SHA-256 摘要与公开 URL。管理后台按文档标识独立发布，Ops 发行配置采用已批准原文对应的两份元数据。合订版仅供过渡展示。

发行时核对线上原文与配置的摘要，并归档已发布版本及原文。切换期间，前后端与可回退槽位须遵循同一版本要求。

登录后通过 `GET /api/v1/auth/consent` 读取总 `required`。`documents.terms` 与 `documents.privacy` 分别提供 `version`、`digest`、`url`、`required` 及当前凭证。

以 `POST /api/v1/auth/consent` 单独提交每份待确认文件的 `document_id`、`accepted: true`、`version` 和 `digest`。写入校验当前会话、来源和 CSRF 令牌。

服务端按账号与文件独立记录标识、版本、摘要、服务器确认时间、来源和请求标识。首次对该文件留证的来源为 `registration`，该文件以后更新时为 `version_update`。同一账号并发或重复提交同一文件版本与摘要，返回原凭证。[凭证保存期限](data-retention.md)

任一当前文件待同意时，登录后的业务请求返回 `403 consent_required`。提交的文件版本或摘要已变化时返回 `409 consent_version_changed`。客户端刷新条款状态，重新确认变更的文件。仍匹配当前版本和摘要的同意继续有效。

同意接口遇到未登录、格式错误或存储故障时分别返回 `401`、`400` 或 `503`。

登录、会话检查、退出和办理注销在待同意期间保持可用。待同意的会话返回 `consent_required: true`、CSRF 令牌和到期时间。匿名访问公开内容沿用原有权限规则。用户拒绝当前条款时可退出或申请注销。

撤回涉及特定可选处理的同意时，停止相应处理，可通过对应设置或条款载明的渠道申请办理。撤回前的处理、既有授权及依法留存按对应条款执行。

Casdoor 4.24.0 的注册 `Agreement` 固定默认勾选。沿用该版本时可在应用配置隐藏该项，由主站取得主动同意。官方 4.28.0 起可将该项规则设为 `Agreement - False`，注册时初始不勾选。两种方式都由主站独立留证。[4.24.0 注册源码](https://github.com/casdoor/casdoor/blob/v4.24.0/web/src/pages/auth/SignupPage.tsx) · [官方变更](https://github.com/casdoor/casdoor/commit/1e3cfea33f9519ac913d14b6af092a6b95b6612b)

## 本地会话与定期复核

普通请求使用本地数据库会话和已确认用户事实，并滑动续期本地会话，不调用 Casdoor。业务授权、学校范围与业务账号状态仍逐次检查。refresh token、ID token 和用户事实在服务端加密保存，浏览器仅持有不透明会话 Cookie。

距上次确认达到复核间隔后，下一次请求刷新 token 并读取一次用户信息。同一会话通过数据库租约合并复核，其他请求在宽限期内继续使用当前会话。租约跨进程生效，刷新结果不能恢复已被撤销的会话。

复核间隔默认 30 分钟，允许 5–240 分钟。故障宽限期默认 30 分钟，允许 0–240 分钟；零表示不允许过期事实继续授权。只有平台管理员可修改，保存校验 expected_version，并在同一事务记录操作者、旧值、新值。

宽限期从上次确认时间加复核间隔开始计算，失败不延长宽限。刷新明确被拒、账号封禁或删除、组织不匹配时删除会话并返回 401。临时故障每 30 秒最多重试一次，宽限结束返回 unavailable。会话绝对有效期到达后返回 401。

参数变更作用于下一次复核判断。应用通过有容量上限的缓存复用 `client_credentials` token，用于读取用户事实和调用已定义的账号管理接口。

## 事件撤销与退出

`POST /api/v1/auth/casdoor-events` 验证共享密钥后处理成功的用户修改和删除事件，撤销目标 subject 在事件时间截点及此前确认的会话。事件中的 `user` 是操作者，目标取自 `object` 的稳定 ID，缺少 ID 时使用已保存的组织内账号名。

接收端忽略其他组织的事件。目标没有事件时点内的有效本地会话或进行中的登录时，成功忽略，且不写入事件、撤销标记、审计或用户资料。登录事实读取和事件处理使用同一 subject 事务锁，日志仅记录固定事件类型与处理结果。

Casdoor 4.24.0 的官方 webhook 按组织配置，投递覆盖组织内的各应用。队列每 30 秒轮询一次。撤销在接收端处理成功后生效，排队、故障和重试增加送达时间。启用组织级投递须经负责人确认。

Casdoor 终态投递记录的起算点、保留期和清理边界见[数据保留与删除](data-retention.md)。

Webhook 未覆盖、投递失败或尚未启用时，由下一次到期请求复核。持续活跃且上游可用时，变化最长在复核间隔内确认；闲置会话在下次请求触发。故障时适用有限宽限期，不承诺故障期间仍按复核间隔发现变化。

会话确认时间取登录或复核开始时间。登录与同一用户的事件处理在十秒登录期限内串行。事件时间精确到秒时，撤销截点取该秒末尾，并以接收时间为上限。事件时间比接收时间晚超过五秒时拒绝，上游与接收端应保持时钟同步。

Casdoor 4.24.0 在记录入库前复制记录并排队投递，投递内容中的 `id` 恒为 0。接收端以 Casdoor 生成的唯一记录名 `name` 作为事件键，与事件时间一起判断重复与乱序。旧事件不撤销截点之后确认的会话。

管理员可按稳定 subject 强制下线，并记录操作者和目标。退出请求先提交本地会话撤销。重复提交已撤销的会话返回 401，既有撤销时间与审计不重复写入。

退出请求的处理期限为 900 毫秒。当前设备和全部设备退出均最多使用当前会话的 ID token hint 向 Casdoor 发起一次请求。槽位忙时跳过，上游请求限时 250 毫秒，且不触发线路探测。只有该请求收到 Casdoor 成功确认时，upstream_ended 才为 true。

旧会话未保存 refresh token 与本地用户事实，升级后要求重新登录。数据库迁移保留旧记录与业务数据，回退只切换程序和配置，不恢复数据库或覆盖切换后的写入。

## 上游线路与客户端

线路按[平台架构](../design/platform-architecture.md#上游线路选择)执行。公开 issuer 与浏览器跳转保持不变，启动按成本选择已配置候选，运行中只在连续传输失败时向后切换，没有周期探测或自动切回。

普通上游调用保留两秒槽位等待、五秒 HTTP 超时和脱敏诊断。日志只含阶段、错误类别、耗时、状态码和 request_id。管理参数不改变业务权限、学校资格、审计或持久数据的归属。

Web 与 Admin 各自共享一次会话检查。401 清除本地登录展示并提供重新登录入口；临时故障保留输入并使用 1、2、4 秒退避，最多等待 8 秒。业务写请求不自动重放。

## 本人手机号

`GET /api/v1/auth/phone` 按当前 StuHelper 会话的身份读取 SSO 手机号，返回绑定状态和 `masked_phone`。未绑定时 `masked_phone` 为 `null`。上游读取失败时返回服务错误，界面可就地重试。

本人接口识别符合 `1[3-9][0-9]{9}` 的大陆手机号，接受可选的 `+86` 前缀。返回前三位、四个星号和末四位，例如 `138****8000`。若号码格式无法识别，或上游提供的国家码有值但无法确认为 `CN`，已绑定号码只显示 `****`。绑定和换绑首次成功及同键重试成功时使用同一脱敏规则。

绑定、更换和解绑只操作当前 session Cookie 对应的 issuer、subject。发码、更换和解绑校验 Origin 与 CSRF。需要近期认证时返回 428 `recent_authentication_required` 和重新验证入口。

重新验证发起 Casdoor OIDC 请求，设置 `prompt=login` 与 `max_age=0`。回调校验原会话、签名、issuer、subject、audience、nonce 和 `auth_time`。认证时间须在流程启动后，默认 10 分钟内有效，可配置。

发码接受中国大陆手机号，可带 `+86`。Casdoor `send-verification-code` 使用 `reset` 模式和 `countryCode=CN`。挑战绑定当前会话、号码和原绑定，5 分钟有效，最多提交 5 次。向同一号码再次发码会使旧挑战失效。

各后端实例共用数据库限额。默认同一号码间隔 60 秒、每小时最多 5 次，每账号每小时 10 次，全局每小时 100 次，均可配置。发码尝试占用额度，超限返回 429、`Retry-After` 和 `retry_after_seconds`。

发码与更换前调用 Casdoor 按组织查重，其他账号已占用时返回 `phone_taken`。更换调用 `reset-email-or-phone` 由 Casdoor 验码写入。解绑要求还有可确认的其他登录方式，并禁用短信 MFA。解绑只清空 `phone` 和 `country_code`。

更换和解绑要求 `Idempotency-Key`。相同键和输入复用结果，改动输入返回冲突。写入响应丢失时，用当前读回状态确认结果。同键重试只读回；尚未确认时返回 `phone_write_unconfirmed`，10 分钟内阻止同账号发起另一笔写入。

Casdoor 4.24.0 的原生写入缺少条件更新，手机号索引也不唯一。两个账号并发可能绑定同一号码，Casdoor 自助页与 StuHelper 可能相互覆盖。上游按名称受理更换，后台并发改名和名称重用也受同一限制。负责人接受这些风险。

StuHelper 审计记录账号、操作和结果，不保存号码或验证码。负责人接受 Casdoor 4.24.0 的原生审计记录和 webhook 可能携带完整号码与验证码。StuHelper webhook 只提取目标标识，忽略发码、更换及多余字段。

当前绑定以查看接口读回为准。其他业务入口继续使用会话复核后的 `phone_bound`；绑定状态随既有会话复核规则刷新。

依据：[Casdoor 发码与换绑](https://github.com/casdoor/casdoor/blob/v4.24.0/controllers/verification.go)、[字段更新](https://github.com/casdoor/casdoor/blob/v4.24.0/controllers/user.go)、[Casdoor 审计](https://github.com/casdoor/casdoor/blob/v4.24.0/object/record.go)。

## Casdoor 4.24.0 的 QQ 自助绑定

账号页展示用户注册应用的 provider。未记录注册应用时，Casdoor 查组织默认应用。组织账户项 `3rd-party logins` 可见且读写规则为 Self 后，页面显示该应用允许展示的第三方登录。解绑还检查该应用对应 provider 的 `canUnlink`。

Casdoor 的原生按钮调用 `Provider.getAuthUrl`，传入 `method=link`。QQ 授权地址使用 Casdoor 的 `/callback`，state 是查询字符串的 Base64，包含应用、provider、method、Casdoor 站内返回路径及标签页专用 nonce。

Casdoor 回调先消费同标签页 sessionStorage 中的 nonce，再携带 Casdoor Cookie 向 `/api/login` 提交授权码。服务端检查请求来源和当前 Casdoor 会话，在应用组织内查找 OpenID，并拒绝已被关联的身份。成功后跳到原站内页面，失败时回调页显示错误。

没有 Casdoor 会话时，绑定分支在交换 QQ 授权码后返回用户不存在错误。公开 API 的错误消息可能包含账号信息。StuHelper 的页面只显示固定结果码。Casdoor 的 QQ 驱动未请求 UnionID，StuHelper 采用[QQ 互联绑定](qq-binding.md)获取完整身份。

依据：[授权地址](https://github.com/casdoor/casdoor/blob/v4.24.0/web/src/auth/Provider.ts#L399-L458)、[state 和 nonce](https://github.com/casdoor/casdoor/blob/v4.24.0/web/src/auth/Util.ts#L202-L247)、[浏览器回调](https://github.com/casdoor/casdoor/blob/v4.24.0/web/public/AuthCallbackHandler.js#L353-L474)、[服务端绑定](https://github.com/casdoor/casdoor/blob/v4.24.0/controllers/auth.go#L1372-L1424)、[QQ 驱动](https://github.com/casdoor/casdoor/blob/v4.24.0/idp/qq.go)。

## 应用会话验收

| 场景 | 预期结果 |
| --- | --- |
| SSO-01 | 登录回调只消费一次，写入校验 CSRF 与学校范围，普通请求不调用 Casdoor |
| SSO-02 | refresh 拒绝立即删除会话；暂时故障在宽限内成功，宽限结束返回 unavailable |
| SSO-03 | 重启保留有效会话，运行身份不能 DDL 或读取其他模块数据 |
| SSO-04 | 25 个到期并发请求只发生一次 refresh；1000 并发记录调用数与 p95 |
| SSO-05 | 线路按成本选择，失败被动切换，非幂等请求不重放，不安全配置被拒 |
| SSO-06 | webhook 拒绝伪造来源，封禁和删除撤销全部会话，重复与乱序事件不重复生效 |
| SSO-07 | 管理配置校验权限、范围、版本和审计；强制下线与退出不能被在途刷新恢复 |
| SSO-PHONE-01 | 本人查询时，大陆 11 位号码及带 `+86` 的同一号码返回相同掩码，其他已绑定号码返回 `****`，未绑定时返回 `null`，上游故障时可重试 |
| SSO-PHONE-02 | 近期认证要求同一会话和同一账号，拒绝缺失或过期的签名认证时间及回调重放 |
| SSO-PHONE-03 | 号码间隔、号码小时、账号小时和全局小时限额生效，超限返回剩余等待时间 |
| SSO-PHONE-04 | 两次查重均可拒绝被占用的号码，错误或过期验证码不写入，正确验证码写入并读回，首次成功与同键重试返回相同掩码 |
| SSO-PHONE-05 | 解绑保护最后一个登录方式和短信 MFA。上游响应丢失后通过读回核对，复用幂等键 |
| SSO-PHONE-06 | 同账号在途写入期间拒绝其他键，原键只读回，最终只有一次上游写入 |
| SSO-CONSENT-01 | 未同意时登录可完成，主站查询返回两份当前文件，需要登录的业务功能返回 `consent_required` |
| SSO-CONSENT-02 | 每份文件独立留证。同一账号并发确认同一文件版本和摘要只写入一次，重试返回该份凭证原确认时间和请求标识 |
| SSO-CONSENT-03 | 文件版本或摘要变化时，该项需要重新确认，过期请求返回 `consent_version_changed`。另一项的有效同意继续生效，旧凭证仍可查 |
| SSO-CONSENT-04 | 拒绝同意时可退出和申请注销，访问受限业务功能仍须当前同意 |

## 客户端故障恢复验收

Web 与 Admin 的 module.json 登记实际测试函数，中央规格统一定义以下行为。

| 场景 | 预期结果 |
| --- | --- |
| SESSION-AVAILABILITY-01 | 25 次会话检查共享一次请求，临时失败后按 1、2、4 秒退避，等待上限 8 秒，成功后恢复 |
| SESSION-AVAILABILITY-02 | 重试组件保留已输入内容和已挂载表单，服务恢复后继续操作，明确身份拒绝后清空会话 |
| SESSION-MANAGEMENT-01 | 八语言设置界面校验输入、保留冲突和故障时的编辑，强制下线需明确目标与确认，键盘及 RTL 可用 |

## 本地会话期限

本地会话连续 30 日无有效认证活动后失效，自建立起最长 90 日。部署可配置更短期限。有效请求滑动更新空闲期限，绝对起点和上游复核时间各自计算。浏览器不展示固定登录截止时间。

复核继续使用 refresh token，默认间隔和故障宽限各 30 分钟。上游拒绝、已处理的封禁或删除事件、主动退出均撤销本地会话，续期不能恢复已撤销记录。临时故障按既有宽限处理。

生产的 webhook 启用范围、`refreshExpireInHours` 与变更核对见[私有生产基线](https://github.com/StuHelper/stuhelper-ops/blob/develop/docs/development/production-baseline.md)。回退保留切换后的会话与业务写入，配置恢复与程序切换分别记录。
