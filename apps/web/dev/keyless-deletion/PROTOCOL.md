# OneKey Keyless 服务端恢复分片删除 · Prime Web 契约

线上协议以 [Web 客户端 API 接入指南](https://onekeygroup.slack.com/docs/T01A1KSU7BQ/F0CKZQU49QQ) 为准。产品背景见 [OK-67257](https://onekeyhq.atlassian.net/browse/OK-67257)。示例使用合成数据。时间为 UTC ISO 8601 字符串，限流与查询间隔以秒计。

申请人发邮件至 `legal@onekey.so`，客服核实并发专属 Web 链接。30 天是收到申请后的处理时限。普通 App 没有公开入口。成功范围仅为 `onekey_server_share`。保留 Juicebox 分片、云同步、OneKey ID 和用户设备上的本地钱包。没有可用的本地钱包或其他恢复材料时，原账号和 PIN 无法再恢复旧钱包。重建使用新的助记词和地址，原地址上的资产不会迁移。

## HTTP

所有接口均为 JSON POST，前缀 `/prime/v1/keyless-deletion`。客服链接以 `#invitationToken=…` 传递不透明邀请。页面只显示邀请允许的 Google 或 Apple 登录。业务服务器按邀请记录和已验证的 OAuth 身份校验绑定。

正式网页和测试网页使用项目配置中对应的官方 Prime。回环开发网页使用 App 原有的开发环境设置选择官方 Prime。邀请和语言选项不能改变目标。调用遵守浏览器 CORS。OAuth 使用与 OneKey ID 相同的 `auth.onekey.so` 及配套公开项目配置。PKCE 会话仅在页面内存中持有。只有 `/otp/send`、`/delete` 和 `/result` 提交 `provider` 和这次会话的 `supabaseAccessToken`。切换语言不重新认证、发码或提交。刷新或更换邀请会清理原验证状态。

成功必须是 HTTP 200、数字 `code: 0`、字符串 `message` 和符合各接口定义的 `data`。以下成功示例展示 `data` 内部。实际响应形如 `{"code":0,"message":"success","data":{"status":"not_submitted"}}`。裸对象、字符串 `code`、非 JSON、错误 HTTP 状态或字段不合法都会被拒绝。删除才使用 `Idempotency-Key`。

### 1. POST /link-info

读取邀请信息。邮件链接的 GET 和该只读请求不会消费邀请、发送验证码或删除分片。失效、撤销或未知邀请通常返回统一的 `INVITATION_UNAVAILABLE`。返回内容不含邮箱、用户 ID 或钱包代际。已使用的有效邀请返回 `used`，页面要求登录后才查询既有结果。邀请过期时本接口仍返回 `INVITATION_UNAVAILABLE`，结果查询独立判断。

请求

```json
{ "invitationToken": "example-invitation" }
```

响应 200 的 `data`

```json
{
  "status": "ready",
  "allowedProvider": "google",
  "expiresAt": "2026-11-18T10:15:00.000Z",
  "serverTime": "2026-11-18T10:00:00.000Z",
  "confirmationVersion": "keyless-server-share-deletion/v1",
  "deletionScope": ["onekey_server_share"],
  "retainedScope": ["juicebox_share", "cloud_sync", "onekey_id"],
  "warningCodes": ["recovery_lost", "new_wallet_separate"],
  "recreationPolicy": "allowed_new_wallet"
}
```

`status` 只能为 `ready` 或 `used`。`allowedProvider` 只能为 `google` 或 `apple`。`recreationPolicy` 为 `allowed_new_wallet`、`blocked` 或 `pending_decision`。前两种分别展示新建钱包使用不同助记词和地址、或当前禁止重建的提示。`pending_decision` 暂停删除流程并提示联系支持。客户端应识别对应风险说明，再让用户明确确认。 本期警告集合恰好为 `recovery_lost` 与 `new_wallet_separate`。确认和保留范围均按集合校验，顺序无关，缺失、重复或未知值均阻断。页面逐项显示并收集两条警告的确认。未知警告暂停提交。确认版本在验证后原样回传。App Web 登录后仍调用业务接口核对身份。

### 2. POST /otp/send

由 OneKey 业务服务发放删除专用 OTP。Supabase OAuth access token 仅用于核验身份。删除发码和校验均不调用 Supabase 邮箱登录的 `/auth/v1/otp` 或 `/auth/v1/verify`。

重新校验邀请可用性、Supabase OAuth 凭证及绑定身份。从可信已验证的身份邮箱映射中选收件人。challenge 绑定邀请、provider、稳定 subject、钱包代际、删除用途 `keyless_server_share_deletion` 与实际收件邮箱。邮箱无法确定时停止。重发使用新 challenge，并使先前验证码失效。

请求

```json
{
  "invitationToken": "example-invitation",
  "provider": "google",
  "supabaseAccessToken": "fixture:google:account-a"
}
```

响应 200 的 `data`

```json
{
  "challengeId": "fixture-otp-a",
  "maskedEmail": "d•••@example.invalid",
  "expiresAt": "2026-11-18T10:05:00.000Z",
  "resendAfterSeconds": 60,
  "serverTime": "2026-11-18T10:00:00.000Z"
}
```

响应只包含服务端掩码后的收件邮箱。客户端用单调时钟加上 `resendAfterSeconds` 或 `retryAfterSeconds` 计算等待时间。服务端独立检查有效期和限频。

生产按 8 位字符串接收验证码，客户端保留前导零。发码响应丢失时，等待冷却再重发，只使用下一次成功响应提供的 challenge。HTTP 429 使用顶层 `retryAfterSec` 或 `Retry-After`。没有有效退避值时客户端使用 60 秒。

### 3. POST /delete

带 `Idempotency-Key` 请求头。一次提交中重新检查邀请可用性与身份，验证 challenge、当前邮箱、验证码、文案版本、全部警告勾选和明确确认。目标钱包及代际来自邀请的服务器记录。独立检查实际当前代际及重建前置条件。仅在所有校验完成后执行针对绑定代际的 OneKey 分片删除。没有预先验证 OTP 的客户端步骤。 客户端提交非空的验证码字符串，按用户输入原样发送。验证码格式、长度和有效性由业务服务按本次 challenge 校验。

请求头 `Idempotency-Key: 1af5d492-44fb-4557-b91e-f56b1f7b4210`

```json
{
  "invitationToken": "example-invitation",
  "provider": "google",
  "supabaseAccessToken": "fixture:google:account-a",
  "challengeId": "fixture-otp-a",
  "code": "246810",
  "confirmationVersion": "keyless-server-share-deletion/v1",
  "acknowledgements": ["recovery_lost", "new_wallet_separate"]
}
```

响应 200 的 `data`

```json
{
  "status": "completed",
  "resultId": "fixture-result-a",
  "completedAt": "2026-11-18T10:00:10.000Z",
  "deletedScope": ["onekey_server_share"],
  "retainedScope": ["juicebox_share", "cloud_sync", "onekey_id"],
  "supportReference": "OKD-example"
}
```

只有持久确认本目标代际的 OneKey 服务端分片删除后才返回 `completed`。状态仍在处理或需人工核对时，使用业务错误 `OPERATION_IN_PROGRESS` 或 `MANUAL_REVIEW_REQUIRED`，客户端通过 `/result` 继续查看。

### 4. POST /result

核对邀请关联和仍有效的 Supabase access token，验证 provider 与稳定身份匹配，再读取原结果。请求体与 `/otp/send` 相同。已消费 OTP 不影响查询。同一身份重新登录取得的有效凭证可用于恢复。

已消费或自然过期的邀请仅可读取已经存在的 `processing`、`manual_review_required` 或 `completed`。自然过期但没有原记录时返回 `INVITATION_UNAVAILABLE`。这是原结果恢复的保守边界。`not_submitted` 只适用于有效、未撤销邀请，且服务端确认没有受理记录时。读取服务故障应返回 `SERVICE_UNAVAILABLE`。

被安全撤销或无效的邀请一律返回 `INVITATION_UNAVAILABLE`。异身份或过期、无效的 OAuth 凭证依统一错误拒绝。过期邀请的只读例外不适用于 `/link-info`、`/otp/send` 或 `/delete`。查询不会重新发送或消费 OTP、重开删除权限、写入新请求或改变钱包。被撤销时须联系支持。生产只读恢复凭据的发放流程仍待实现。

```json
{ "status": "not_submitted" }
```

```json
{
  "status": "processing",
  "resultId": "fixture-result-a",
  "retryAfterSeconds": 2,
  "supportReference": "OKD-example"
}
```

```json
{
  "status": "manual_review_required",
  "resultId": "fixture-result-a",
  "supportReference": "OKD-example"
}
```

`completed` 的响应与 `/delete` 的成功响应相同。各结果中的同一个 `resultId` 与 `supportReference` 代表同一次提交。所有标识都必须非空，秒数必须有限且非负。`not_submitted` 只返回 status。处理中必须有 resultId、supportReference、retryAfterSeconds。人工核查必须有 resultId、supportReference。两者均不带完成时间或范围。完成必须有 resultId、supportReference、completedAt、deletedScope、retainedScope。

## Prime 错误包装

```json
{
  "code": 90906,
  "message": "请稍后重试。",
  "messageId": "error__service_prime_keyless_deletion_rate_limited",
  "retryAfterSec": 60
}
```

Prime 业务错误可以通过 HTTP 200 返回。错误语义由数字 `code` 决定。`messageId` 用于文案标识。失败 `data` 可以省略。`90913` 的非空参考编号来自 `data.supportReference`，页面显示「参考编号」。通用 Toast 优先展示经过过滤的 `translatedMessage`，其次是 `message`，并遵守 `disableAutoToast`。请求排查编号、凭据和异常栈不出现在界面。

| 数字码            | 客户端动作                                                                    |
| ----------------- | ----------------------------------------------------------------------------- |
| 90900             | 停止发码和删除。提交结果未知时保留原申请并查询。查询也失效时请原客服核实。    |
| 90901、90902      | 用原绑定身份重新认证。                                                        |
| 90903             | 返回登录，提示换回原钱包绑定的账号。                                          |
| 90904、90905      | 修正验证码或重新发码。                                                        |
| 90906 或 HTTP 429 | 遵循 `retryAfterSec` 或 HTTP `Retry-After` 的退避。                           |
| 90907             | 返回逐项风险确认。                                                            |
| 90908             | 先查询原结果。明确 `not_submitted` 后重拉确认说明，由用户重新确认后创建新键。 |
| 90909、90910      | 停止当前删除，显示服务提示。                                                  |
| 90911、90912      | 查询原申请，保留原幂等键与已知状态。                                          |
| 90913             | 保留人工核查状态和参考编号，停止重复提交。                                    |
| 90914             | 发码阶段提示稍后重试。提交后查询原结果。                                      |
| 90915、90001      | 请求需要检查。提交后保留原操作并查结果，界面保留可展示的服务提示。            |

未知错误、网关 5xx 和畸形响应不构成成功依据。

## 截止时间与恢复

- 客户端业务请求最多等待 8 秒。截止时间包含传输和读取响应体。取消或截止只结束客户端等待。服务端可能已经受理，迟到响应不能覆盖当前邀请或较新状态。
- 发码超时、断网或回包无效时，客户端进入发送结果待确认，清除前一个 challenge、输入和勾选。发码接口可能已受理，重发仍受服务端限流，旧响应不会覆盖新的 challenge。发码成功响应只证明该请求返回了 challenge，真实邮件送达需单独核验。
- `/result` 返回 429 时，客户端保留现有结果或未知状态。查询和再次登录入口按单调时钟使用错误退避。已受理且处理中时使用结果中的 `data.retryAfterSeconds`。刷新会丢弃页面计时，服务端仍应执行相同限流。
- 删除请求超时、断网、503 或响应无效时，先查询原 `/result`。仅明确返回 `not_submitted` 才出现同键重试。查询失败时保留原请求，继续查询。处理中、人工核查或已完成均不能重提。幂等冲突也只查原结果。
- `AUTH_EXPIRED` 或 `AUTH_INVALID` 时可用原绑定身份重新登录，先恢复结果。同一页面运行期间，原操作及原幂等键在内存中保留。重新打开已受理邀请时用同一身份查询记录。页面完整刷新会丢弃内存中的 OTP、凭证及未受理的表单上下文。
- 若已知人工核查、处理中或已完成，后续查询失败保留原状态与已知参考号。后续查询返回不同操作 ID、不同客服编号或 `not_submitted` 时，视为异常响应。
- 确认版本变更后先确认原申请未受理，再获取最新且支持的版本。新确认页面清空原输入和勾选，并展示更新说明。重新确认后使用新键。若状态依旧不明或版本不受支持，保持查询状态。

## 绑定、幂等与并发

- 邀请是唯一操作目标。A 链接和 B 的 OAuth 加 B 的 OTP 会失败。相同邮箱的不同 provider 或不同 subject 也会失败。A 的 OAuth 搭配 B 的 challenge 会失败。发码后撤销、过期、邮箱变更均需在最终提交重新检查。
- 后端需验证 Supabase issuer、audience、令牌有效期和可信 provider 信息。用稳定 provider subject 和已验证邮箱映射授权。客户端参数及显示邮箱只供检查或展示。OAuth 选账号提示不等于重新输入账号密码。
- 首次受理前验证所有 OTP 绑定信息。若服务端确定未受理，可用同键和新的有效 challenge/OTP 提交相同确认。已受理同键重试仍检查有效邀请及绑定身份，按邀请、目标代际、确认版本、规范化警告集合和明确确认匹配，然后返回原结果。OAuth 凭证、OTP 与 challenge 不参与已受理语义比较。同键异语义返回 `IDEMPOTENCY_CONFLICT`。Jira 要求每个邀请及目标只能执行一次，另发新键但语义相同的具体返回约定仍待后端确认。邀请自然过期后只能按 `/result` 规则读取原结果。
- 生产需要把目标代际校验、操作记录、OTP 消费和分片删除做成原子或可恢复的状态变更。需证明在途创建、迁移、Reset PIN 及旧客户端请求无法写回或删除错误代际，并确认重建和旧记录处理策略。
