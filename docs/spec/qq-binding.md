---
type: spec
status: Accepted
updated: 2026-11-21
---

# QQ 三项独立绑定

qq-binding 独立管理 OneBot 的真实 QQ 号、QQ 互联的 openid 与 unionid、官方机器人的用户 openid。三项分别验证，界面分项显示，不建立相同 QQ 的推断。开放平台整体状态要求三项全部完成，群服务按目标群机器人通道与群配置逐项检查绑定事实。

## 归属与验证

每个账号每项最多一个身份，每个身份只属于一个账号。OneBot 以真实 QQ 号确定身份，官方机器人 openid 以机器人为命名空间，QQ 互联标识以应用为命名空间。归属冲突提示账号找回或人工核查，不覆盖已有绑定。

登录用户在网页生成对应机器人的验证码，5 分钟有效、一次使用。用户通过对应机器人私聊提交，Koishi 从适配器会话取得平台身份并上报，群聊消息不处理。网页与机器人均提示“只发送你自己生成的验证码”。验证码错误不披露归属账号。发码响应包含可复制的私聊口令及当前通道可用的目标机器人。

生成按账号每分钟最多 5 次。提交按机器人每分钟最多 100 次、按机器人用户每分钟最多 10 次。机器人使用绑定到平台与机器人 ID 的服务凭据，凭据只从私有文件读取；未知平台或不匹配凭据拒绝访问。

## QQ 互联

StuHelper 账号与安全页通过 QQ 互联 OAuth 绑定身份。生产使用 Casdoor QQ provider 的同一个互联应用。已登录用户发起授权，state 绑定当前 StuHelper 会话，五分钟有效且一次消费。绑定过程不需要 Casdoor 浏览器会话。

后端换取 access token 后请求 `me?unionid=1&fmt=json`，验证应用标识、OpenID 与 UnionID。模块保存两项标识及应用命名空间，在同一事务写入绑定、审计及 outbox。应用内的 OpenID 与 UnionID 分别受唯一约束。

QQ 返回 100048 时报告 UnionID 权限未开通，响应缺少 UnionID 时报告标识缺失。两种情况均在发起 Casdoor 更新前拒绝。回调地址被 QQ 拒绝时报告配置错误。若 QQ 在自己的网页上阻止继续授权，用户会在 QQ 页面看到错误。

后端按会话的 Casdoor issuer 和稳定用户 ID 定位账号。写入前核对当前账号及组织内的 QQ 归属，已关联相同 OpenID 可继续补全。已占用或当前账号持有另一个 OpenID 时拒绝覆盖。Casdoor 官方 API 只更新 `qq` 字段并读回验证。

QQ 互联 access token 仅用于本次读取。绑定不读取昵称和头像。外部请求设置超时、限制响应大小并拒绝重定向。业务日志只记录固定状态码。Web 读取回调参数后立即清除地址栏查询参数。

本地事务序列化 StuHelper 的绑定写入，并在 Casdoor 核对失败时回滚。同一个 OpenID 已写入 Casdoor 而本地提交结果未知时，重新授权会核对现有归属并补齐本地记录。Casdoor 4.24.0 的管理 API 未提供跨入口原子归属检查。

三个页面入口分别使用 `qq-binding.connect`、`qq-binding.onebot`、`qq-binding.official`。生产仅启用 `qq-binding.connect` 和账号状态读取 `qq-binding.manage`。未启用的机器人请求返回固定能力关闭状态。

用户从 StuHelper 账号页绑定和解除 QQ 互联。`POST /api/v1/qq-binding/bindings/connect/unlink` 使用本人状态中的 connect.revision，只有 Casdoor 登录绑定时也可解除。

解绑提交前通过 Casdoor API 清空当前用户的 `qq` 登录字段并读回。两侧 OpenID 不一致时返回冲突。Casdoor 不可用或未确认清除时，本地绑定、审计、outbox 和幂等回包回滚。同键同请求可重试，已提交时返回原结果。

仅剩 QQ 登录时返回 409 `qq_binding_last_sign_in_method`。保留方式按生产应用启用的登录方法与 Casdoor 用户字段判断。生产当前的备用方式是已设置的密码。成功返回 `connect_login=unbound`。

QQ 互联身份与 Casdoor QQ 登录分别返回状态。QQ 侧主动撤销通知尚未接入。

## 状态、管理与注销

逐项解绑立即使整体状态未完成，其余两项独立保存；补齐三项后恢复整体完成状态。入群准入按目标群所要求的绑定项读取当前事实，开放平台查询继续以整体完成为准；来源不可用时返回暂不可用，不伪造未绑定状态。

管理员可按账号查看绑定状态。账号发生归属冲突时，服务端返回有效核查单号；获授权管理员可据此核查占用槽位和修订，并记录原因和审计后解除指定项。接收身份的账号须自行验证。业务账号注销删除三项绑定并关闭后续写入；未知安装历史或已安装模块不可用时等待。

绑定、解绑和注销与审计、outbox 同事务保存。outbox 记录单调事件 ID，供群服务重新读取当前状态、安排提醒与宽限期。群服务的提醒与移出执行不属于绑定模块。

未使用验证码摘要到期清理，已使用摘要保留 24 小时用于幂等重试，幂等响应保留 24 小时，限流记录保留 1 天，审计及已投递事件保留 12 个月。未确认投递事件保留。后台每轮每类最多清理 100 条，操作限时 5 秒。

## 开放平台与客户端

qq_binding_status 只返回三项是否全部完成。qq_binding_details 返回整体状态，完成时提供 OneBot 的 QQ 号，未完成时不提供号码。两个范围分别申请、审批和同意。第三方不能读取 openid 或 unionid。

Web 展示三项状态及已开启项的操作入口。本人接口返回 `connect`、`onebot`、`official` 的绑定事实、修订及可用的绑定时间。OneBot 号码脱敏后保留末两位。既有绑定可继续显示，操作入口遵循系统能力状态。未绑定项初始为 `bound:false`、`revision:0`。

Admin 按账号查询并处理冲突。Web 和 Admin 按 `contracts/qq-binding.openapi.json` 生成客户端，处理过期、冲突、限流、依赖故障和重新授权。

## 验收场景

| 场景 | 预期结果 |
| --- | --- |
| QQB-01 | 三项独立完成才满足整体条件；验证码单次、过期拒绝、唯一归属、解绑和注销原子执行，事件失败回滚 |
| QQB-02 | 确认与取消校验会话和 state 并支持幂等重试。同一授权码最多交换一次。缺少 UnionID 或 Casdoor 同步失败时不保存绑定；解绑覆盖仅有 Casdoor 绑定、读回失败重试、最后登录方式拒绝与幂等重放 |
| QQB-03 | 机器人凭据与平台校验、匿名及越权拒绝，响应不泄露验证码归属或其他项身份 |
| QQB-04 | backend 装配真实绑定来源，缺项即未完成，来源故障返回 503，注销删除三项 |
| QQB-05 | Koishi 只处理配置机器人的私聊验证码，使用适配器身份，重试使用同一幂等键，八语言回复包含本人验证码提醒 |

## Web 授权与结果

`POST /api/v1/qq-binding/connect/start` 要求登录 Cookie、同源 CSRF 令牌和 Idempotency-Key，请求体为 `{}`。浏览器将当前标签页导航到响应的 `url`。同一幂等键返回原结果，新键作废本项上一条未使用的 state。

QQ 将浏览器带回已登记的 `https://stuhelper.com/me/qq/callback`。页面收到单个 `state` 与 `code` 时向 `/api/v1/qq-binding/connect/confirm` 提交 `{state, code}`。

收到 `state` 与 QQ 错误时向 `/api/v1/qq-binding/connect/cancel` 提交 `{state}`。缺少或重复参数以及同时带有 `code` 和 `error` 的回调按无效处理。

两个 POST 均要求原登录会话、同源 CSRF 校验与幂等键。确认在交换授权码前持久化操作，并在 24 小时内阻止相同授权码用于其他 state。同键同请求读取原结果。收到 202 时用原请求和幂等键重试，收到重新授权错误时返回账号页发起新授权。

生产确认成功返回 `connect.bound=true` 和 `connect_login=linked`。取消使 state 失效。页面只显示本地化结果，并提供返回 `/me/account` 的链接。

取消成功后，`access_denied` 显示用户拒绝，`100010` 或 `redirect_uri_mismatch` 显示回调配置错误，`100048` 显示 UnionID 权限错误，其他 QQ 错误提示重新授权。

`GET /api/v1/qq-binding/me` 的 `connect_login` 表示 Casdoor QQ 登录状态。`reauthorize` 表示已有 Casdoor 绑定，需完成一次 QQ 授权以补齐 UnionID。`out_of_sync` 表示两侧状态有差异，使用相同 QQ 重新授权可恢复 Casdoor 登录绑定。
