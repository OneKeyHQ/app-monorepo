# OneKeyID and Keyless Unified Login Server APIs

本文件从 [plan.md](./plan.md) 拆出，集中列出本迁移涉及的新增、调整、下线和废弃服务器接口。迁移文档中的流程章节只保留接口名称和流程引用；接口输入、响应状态、幂等和安全要求以本文为准。

## 场景总览

本文件先按业务场景概览主要接口。最容易混淆的是 API-01、API-03、API-04 到 API-06：它们都可能处理 OAuth identity 和 legacy email OneKeyID，但业务 intent 不同；API-09 是显式合并流程里的独立发码接口，API-10 / API-11 是旧 Email + OTP 能力收口，API-12 到 API-14 是 Keyless auth share OTP legacy 删除。

| 场景 | 接口 | 入口 | 结果 |
| --- | --- | --- | --- |
| OAuth 登录 / upsert | 🆕 API-01 `POST /prime/v1/account/oauth/login` | 用户用 Google / Apple 登录。 | 登录已绑定 OAuth identity 的 OneKeyID；或按 verified email 自动绑定到 legacy email OneKeyID / active email claim owner；或创建新的 OAuth OneKeyID；必要时返回 `manual_merge_required`。 |
| 当前 OneKeyID profile 查询 | 🆕 API-02 `GET /prime/v1/account/profile` | 当前已有 OneKeyID session，客户端需要刷新 account / identities 聚合信息。 | 返回当前 session 对应的 active OneKeyID profile；response 只包含 `onekeyAccount`，字段结构复用共享 `IOneKeyIdAccount`。 |
| 当前 legacy email OneKeyID 升级到 OAuth 登录方式 | 🆕 API-03 `POST /prime/v1/account/identities/oauth/bind` | 当前设备已经持有 legacy email OneKeyID session，用户主动点击 `Upgrade with Google` / `Upgrade with Apple`；典型来源是升级前遗留登录态或兼容期内保留的 legacy session。 | 把新的 OAuth identity 绑定到该 legacy email OneKeyID，使该账号后续使用 OAuth 登录。这里没有第二个 OneKeyID account 参与，不做 account merge；如果 OAuth identity 已绑定到另一个 OneKeyID，必须返回错误。没有 legacy session 的用户不能走 API-03，应先 OAuth 登录，再通过 API-04 到 API-06 合并 legacy target。 |
| 显式确认 target 后绑定 / 合并 OAuth source | 🆕 API-04 到 API-06 `/merge/prepare` -> `/merge/verify-target` -> `/merge/confirm`，中间通过 🔄 API-09 `/general/emailOTP` 发 legacy Email OTP | 入口 1：API-01 返回 `manual_merge_required` 后继续走 `pending_oauth_bind`。入口 2：当前已登录 OAuth OneKeyID，用户主动 `Merge existing OneKeyID`，走 `merged_source`。 | API-04 只准备并返回 `otpPurposeToken`；API-09 负责发送 `MergeExistingOneKeyId` 场景 OTP；API-05 验证 target；API-06 执行。`pending_oauth_bind` 没有 source OneKeyID，只把已验证但未绑定的 OAuth identity 绑定到 legacy Email OTP 验证后的 target。`merged_source` 才是两个 OneKeyID account 合并：source OAuth OneKeyID 标记为 `merged` archive，并把 source active OAuth bindings retarget 到 target legacy email OneKeyID。 |
| ~合并历史 / source 详情只读查询~ | ⏸️ API-07 `/merge/history`、⏸️ API-08 `/merge/source/:sourceOneKeyId` | 后续可选能力，非 MVP 必需。 | MVP 阶段不开发客户端公开接口，也不做用户侧 `Merged accounts` / `Previous accounts` 页面；只要求服务端保留 merge relation、source archive 和审计日志，供客服 / 风控通过内部后台、SQL 或 admin tool 查询。 |
| 旧 Email + OTP 发码 / 确认收口 | ⛔ API-10 `GET /api/prime/send-email-verification-code`、⛔ API-11 `POST /api/prime/login` | 旧客户端发送并提交 Email OTP；新版本客户端不应把 Email + OTP 作为登录入口，也不应调用 API-11 建立登录态。 | 只服务已有 legacy email OneKeyID 的旧客户端登录 / 找回兼容；不再支持普通主登录入口和新 email 注册。API-10 对新 email 请求保持中性响应且不能创建账号；API-11 对 `isRegister = true` 或明确的新 email 创建请求返回 `legacy_register_disabled`，但 `isRegister = false` 未命中 legacy account 时仍必须防枚举。旧客户端遇到新 email 登录 / 注册诉求时，应提示升级 App 并改走 Google / Apple。 |
| Keyless auth share OTP legacy 删除 | 🗑️ API-12 `/user/getKeylessAuthShare`、🗑️ API-13 `/user/createKeylessAuthShare`、🗑️ API-14 `/user/resetKeylessAuthShare` | 已确认不属于 OneKeyID / Keyless 统一登录迁移的用户路径。 | 单纯删除，不迁移、不替换、不保留兼容入口；对应 wrapper 和 UI 入口同步删除。 |

标识说明：

- 🆕 新增接口。
- 🔄 修改旧接口。
- ⛔ 下线旧能力 / 新版本客户端禁用。
- ⏸️ 暂缓 / 非 MVP / 后续可选。
- 🗑️ 废弃 / 删除旧接口。

---------------------------------------------------------

## Shared Types

本段集中声明 OAuth account response 相关共享枚举与共享结构。后续接口复用这些类型；单个接口实际只返回其中的有效子集，见字段注释。

```ts
type IOneKeyIdOAuthFlowStatus =
  | 'success'
  | 'manual_merge_required';

type IOneKeyIdAccountStatus =
  | 'active'
  | 'merged';

type IOneKeyIdIdentityType =
  | 'legacy_email'
  | 'oauth';

type IOneKeyIdOAuthProvider =
  | 'google'
  | 'apple';

type IOneKeyIdOAuthEmailType =
  | 'real'
  | 'apple_private_relay'
  | 'missing_or_unverified';

// 服务端 response 中的 OAuth binding result 目前只返回 bound。
// pending / conflict 只允许作为客户端本地 IOneKeyIdOAuthBindingLocalInfo.bindingStatus
// 的缓存状态出现，不作为服务端 oauthIdentityBinding 响应状态返回。
type IOneKeyIdOAuthBindingStatus =
  | 'bound';

type IOneKeyIdOAuthBindReason =
  | 'existing_oauth_binding'
  | 'legacy_email_auto_bind'
  | 'email_claim_auto_bind'
  | 'new_oauth_account_created'
  | 'legacy_session_authorized_bind'
  | 'manual_merge_confirmed_bind'
  | 'merged_source_retarget';

type IOneKeyIdIdentity = {
  // 身份类型。
  // - legacy_email：旧 OneKeyID email 身份。
  // - oauth：Google / Apple OAuth 身份。
  identityType: IOneKeyIdIdentityType;

  // 仅 identityType = oauth 时返回。
  // 服务端为 OAuth identity 生成的稳定 ID。
  // 当前等于 Keyless 服务端根据 OAuth token / identity claims 生成的 hashId。
  // 用作本地 OAuthIdentityCredentialStorage 的唯一 key。
  // 它不是 keylessWalletId，也不是本地 wallet id。
  oauthIdentityId?: string;

  // 仅 identityType = oauth 时返回。
  // OAuth provider 类型，当前只允许 google / apple。
  oauthProvider?: IOneKeyIdOAuthProvider;

  // 仅 identityType = oauth 时返回。
  // OAuth 侧稳定 subject，例如 Google sub 或 Apple user id。
  // 只用于服务端 identity 去重和必要的诊断；客户端不应把它作为展示主标识。
  oauthSubject?: string;

  // 仅 identityType = oauth 时返回。
  // OAuth email 的可信类型，决定能否参与 legacy email 自动绑定和 email claim upsert。
  // - real：OAuth provider 返回了 verified email，且不是可识别的 Apple private relay。
  //   可以参与同 email legacy 自动绑定和 email claim 自动绑定；
  //   此状态下 oauthEmail 和 normalizedEmail 必须有值。
  // - apple_private_relay：oauthProvider = apple 且 verified email domain 命中服务端配置的 relay domain list。
  //   当前按独立账户处理，不自动合并到真实 legacy email；
  //   如果本地有 legacy OneKeyID auth token 信号，返回 manual_merge_required。
  // - missing_or_unverified：OAuth provider 没有返回 verified email，或 email 未验证。
  //   可以创建 OAuth-only OneKeyID，但不能创建 email claim，也不能参与同 email 自动绑定；
  //   只有此状态下 oauthEmail 和 normalizedEmail 才允许为空。
  oauthEmailType?: IOneKeyIdOAuthEmailType;

  // 仅 identityType = oauth 且 oauthEmailType = real / apple_private_relay 时返回。
  // 服务端校验客户端提交的 Supabase access token 后，
  // 从 Supabase Auth / provider identity claims 中解析出的已验证原始 email。
  // 该字段不是客户端单独上报的 email，也不是客户端本地缓存 email。
  // 只有 OAuth provider 明确证明 email 已验证时才返回。
  // Apple private relay 也可能是 verified email，但 oauthEmailType 会标记为 apple_private_relay。
  // oauthEmailType = real / apple_private_relay 时必须返回该字段；
  // oauthEmailType = missing_or_unverified 时必须不返回该字段。
  oauthEmail?: string;

  // 仅 identityType = legacy_email 时返回。
  // 旧 OneKeyID email 原始值。
  legacyEmail?: string;

  // legacy_email / oauth 都可以返回。
  // legacy_email 时表示旧 OneKeyID email 的规范化值；
  // oauth 时表示服务端基于 oauthEmail 生成的规范化 email。
  // 用于唯一索引、email claim 和同 email 自动绑定，例如大小写折叠、去除首尾空格等。
  // 它是服务端匹配 key，不是 UI 展示字段。
  // identityType = oauth 且 oauthEmailType = real / apple_private_relay 时必须返回该字段；
  // identityType = oauth 且 oauthEmailType = missing_or_unverified 时必须不返回该字段。
  normalizedEmail?: string;

  // legacy_email / oauth 都可以返回。
  // legacy_email 时表示旧 OneKeyID email 的脱敏展示值；
  // oauth 时表示服务端基于 oauthEmail 生成的脱敏展示 email，例如 n***@gmail.com。
  // 仅用于 UI 展示，不能用于账号匹配、绑定判断或身份 proof。
  // 当 email 缺失时可以不返回；客户端只能展示 oauthProvider / identity display，
  // 不能用本地缓存 email 补充身份 proof。
  displayEmail?: string;

  // 仅 identityType = oauth 且 oauthEmailType = apple_private_relay 时返回。
  // 命中的 Apple private relay domain。
  // 用于诊断和日志，不作为客户端分支判断的唯一依据。
  oauthRelayDomainMatched?: string;
};

type IOneKeyIdAccount = {
  // 当前登录成功后的 active OneKeyID。
  onekeyUserId: string;

  // OneKeyID account lifecycle status 的完整枚举。
  // success payload 中实际只能返回 active。
  // 如果服务端命中 merged，必须走业务错误分支，
  // onekeySession / onekeyAccount / oauthIdentityBinding 都不能作为普通成功态返回。
  // active：当前可作为登录主体的 OneKeyID。可签发普通 session，可接受写入。
  // merged：已废弃为登录主体的 source archive。
  // 命中时返回 account_merged_reauth_required / support_required，并触发对账修复。
  status: IOneKeyIdAccountStatus;

  // OneKeyID 账号级 normalized email，和 displayEmail 使用同一选择规则。
  // 1. 优先取 legacy_email identity 的 normalizedEmail；
  // 2. 如果没有 legacy_email，则按 OAuth identity 绑定时间从早到晚，
  //    取最早绑定且有 normalizedEmail 的 OAuth identity；
  // 3. 如果没有可用 email，则不返回。
  // 该字段是服务端匹配 key，不是身份 proof；客户端不能用它替代 identity proof。
  normalizedEmail?: string;

  // OneKeyID 账号级展示 email，必须是 masked email；没有可用 email 时不返回。
  // 服务端不再在 onekeyAccount 顶层返回 legacyEmail；
  // legacy email 可从 identities 中 identityType = legacy_email 的元素读取。
  // displayEmail 选择规则：
  // 1. 优先取 legacy_email identity 的 email；
  // 2. 如果没有 legacy_email，则按 OAuth identity 绑定时间从早到晚，
  //    取最早绑定且有 oauthEmail 的 OAuth identity；
  // 3. 服务端对选中的 email 做脱敏后返回，客户端不能用它做账号匹配 proof。
  displayEmail?: string;

  // 当前 OneKeyID 已绑定的 active identity 列表。
  // 它复用 IOneKeyIdIdentity：
  // - identityType = legacy_email 表示旧 OneKeyID email 身份；
  // - identityType = oauth 表示 Google / Apple OAuth 身份。
  // 这里不再返回单个 identity 的 status，避免和上面的 OneKeyID account lifecycle
  // status 混淆；能出现在该列表里的 identity 都是当前账号下可用的 active identity。
  // OAuth identity 当前请求的绑定结果看 oauthIdentityBinding.bindingStatus。
  identities: IOneKeyIdIdentity[];
};

type IOneKeyIdOAuthBindingResult = {
  // OAuth identity 绑定状态。
  // bound：当前 OAuth identity 已经有 active binding，或本次请求已经完成自动绑定 / 新建账号绑定。
  // 需要用户继续 manual merge 的场景通过 API-01 status = manual_merge_required 表达，
  // 冲突 / 异常场景通过 terminal error code 表达，不能把 pending / conflict
  // 混入含 boundOneKeyUserId 的服务端 binding result。
  bindingStatus: IOneKeyIdOAuthBindingStatus;

  // 本次 OAuth identity 最终绑定到的 OneKeyID。
  boundOneKeyUserId: string;

  // 绑定来源：
  // - existing_oauth_binding：OAuth identity 已经有 active binding，直接登录。
  // - legacy_email_auto_bind：OAuth verified email 命中 legacy OneKeyID，自动绑定。
  // - email_claim_auto_bind：当前未绑定 OAuth identity 的 verified normalizedEmail
  //   命中 active email claim owner，自动绑定到该 owner OneKeyID。
  //   典型场景是用户先用某个 Google / Apple OAuth identity 创建或绑定了 OneKeyID，
  //   服务端已为该 verified email 建立 email claim；之后另一个 OAuth identity
  //   返回相同 verified normalizedEmail，就通过 email claim 自动绑定到同一个 OneKeyID。
  //   这里不是客户端直接比较两个 OAuth 账号，而是服务端通过 normalizedEmail
  //   的唯一 email claim 做归属判断。legacy_email identity 直接命中时优先返回 legacy_email_auto_bind。
  // - new_oauth_account_created：没有命中任何 legacy / email claim，创建新的 OAuth OneKeyID。
  // - legacy_session_authorized_bind：API-03 中 legacyOneKeyIdAuthToken
  //   对应的 legacy email OneKeyID 与本次 OAuth credential 同时验证通过后绑定。
  // - manual_merge_confirmed_bind：API-06 中 pending_oauth_bind 路径，
  //   用户通过 legacy Email OTP 显式确认 target 后完成 OAuth identity 绑定。
  // - merged_source_retarget：API-06 中 merged_source 路径，
  //   OAuth identity 从 source OAuth OneKeyID retarget 到 target legacy email OneKeyID。
  bindReason: IOneKeyIdOAuthBindReason;
};

type IOneKeyIdSessionCredential = {
  // OneKeyID Supabase Auth access_token。
  // 客户端访问 OneKeyID / Prime 需要登录态的接口时，现有 ServiceBase
  // 会从 Supabase SDK session 中读取当前 access_token，并写入 X-Onekey-Request-Token。
  accessToken: string;

  // OneKeyID Supabase Auth refresh_token。
  // 客户端不要自行实现 refresh 逻辑；必须交给 Supabase SDK 保存、轮换和刷新。
  // refreshToken 是敏感凭证，不能写入日志或埋点。
  refreshToken: string;
};

// 显式账号合并流程的 source 类型完整枚举。
// 注意：这是合并流程里的 source type 枚举全集；
// API-01 返回 manualMerge 时，实际只允许 pending_oauth_bind。
// 不要把 sourceType 当作登录接口 status；登录接口的状态是 manual_merge_required。
type IOneKeyIdMergeSourceType =
  // pending OAuth 绑定。服务端还没有创建 OAuth source OneKeyID，
  // source 只是当前已验证 OAuth identity。
  // API-01 manualMerge.sourceType 只会返回该值。
  // 后续 API-04 到 API-06 继续使用该 source type；
  // API-06 成功后落库的 relationType 也使用同名值。
  | 'pending_oauth_bind'
  // 已存在 OAuth source OneKeyID。用户已经用 OAuth 创建并登录了新的 OneKeyID，
  // 后续从 Merge existing OneKeyID 入口主动合并到 legacy email OneKeyID。
  // 该值不会从 API-01 manualMerge.sourceType 返回；
  // 它只用于已登录 OAuth OneKeyID 发起的 API-04 到 API-06 source path，
  // API-06 成功后落库的 relationType 记录为 merged_source。
  | 'merged_source';

type IOneKeyIdMergeConfirmStatus =
  | 'merged'
  | 'processing'
  | 'failed'
  | 'support_required';

type IOneKeyIdMergeSourceProof = {
  // pending_oauth_bind 路径使用。
  // 来自 API-01 manualMerge.sourceOauthHandle。
  sourceOauthHandle?: string;

  // merged_source 路径使用。
  // 当前已登录 OAuth OneKeyID 的 OneKeyID session access token。
  // 不能传 legacy email target 的 OneKeyID token。
  sourceOneKeyIdAuthToken?: string;
};

type IOneKeyIdMergeSourcePreview = {
  sourceType: IOneKeyIdMergeSourceType;

  // 仅 sourceType = merged_source 时返回。
  // 表示将被合并并标记为 merged source 的 OAuth OneKeyID。
  sourceOneKeyUserId?: string;

  // 本次准备绑定 / 转移到 legacy email target 的 OAuth identity。
  // merged_source 路径下，该字段代表当前 source proof 对应的 OAuth identity；
  // API-06 账号级合并时，source OneKeyID 下其他 active OAuth bindings 也必须一起 retarget。
  // 字段结构与 IOneKeyIdIdentity 完全一致。
  oauthIdentity: IOneKeyIdIdentity;
};

type IOneKeyIdMergeExecution = {
  mergeRequestId: string;
  sourceType: IOneKeyIdMergeSourceType;

  // 仅 sourceType = merged_source 时返回。
  sourceOneKeyUserId?: string;

  targetOneKeyUserId: string;
  status: IOneKeyIdMergeConfirmStatus;

  // status = merged 时返回。
  mergedAt?: string;
};

type IOneKeyIdManualMerge = {
  // API-01 只会返回 sourceType = pending_oauth_bind。
  // merged_source 场景由已登录 OAuth OneKeyID 主动发起 API-04 到 API-06。
  sourceType: IOneKeyIdMergeSourceType;

  // 加密签名短期 token，客户端只当作 opaque string 保存和回传。
  // token 内容至少包含 oauthIdentityId、oauthProvider、oauthSubject、normalizedEmail?、iat、exp。
  // 建议有效期约 15 分钟。
  // 服务端不持久化 pending merge 状态；sourceOauthHandle 只服务
  // /merge/prepare 和 /merge/verify-target 的前置流程。
  // 最终 /merge/confirm 仍必须重新提交并校验当前 OAuth credential。
  sourceOauthHandle: string;

  // 需要手动合并的原因：
  // - oauth_email_mismatch：OAuth verified email 与本地 legacy OneKeyID auth token 对应账号不一致。
  // - apple_private_relay：Apple private relay 不能自动合并到真实 legacy email。
  // - missing_or_unverified_email：OAuth credential 没有可用于自动绑定的 verified email。
  // - local_legacy_session：客户端提交了 legacyOneKeyIdAuthToken，
  //   且服务端验证该 token 对应 active legacy OneKeyID；
  //   但不能仅凭该信号直接绑定，必须走显式 merge。
  reason:
    | 'oauth_email_mismatch'
    | 'apple_private_relay'
    | 'missing_or_unverified_email'
    | 'local_legacy_session';

  // sourceOauthHandle 的过期时间，ISO 8601 字符串。
  // 过期后客户端必须重新发起 OAuth 登录，拿新的 sourceOauthHandle。
  expiresAt: string;
};
```

---------------------------------------------------------

## API-01 🆕 `POST /prime/v1/account/oauth/login`

接口性质：**新增接口**。它不是对旧 `POST /prime/v1/user/login` 的原地修改；旧接口仍可在兼容期内服务旧 OneKeyID 登录态刷新。新统一登录路径必须调用本接口，让服务端在同一个 upsert 入口里完成 OAuth identity 校验、OneKeyID 登录 / 创建、legacy email 自动绑定，以及必要时返回 pending merge state。

### Request

```ts
type IOneKeyIdOAuthLoginRequest = {
  // Supabase access token，和 Keyless backend share 相关接口保持同样的单 token 入参风格。
  // 读代码入口：先看现有 Keyless 接口如何把 Supabase access token 作为 POST body token 传给 Prime。
  // - packages/kit-bg/src/services/ServiceKeylessWallet/ServiceKeylessWallet.ts
  //   - apiGetKeylessBackendShare(params: { token: string }) 是最直接参考；
  //     它请求 POST /prime/v1/keyless-wallet/getKeylessBackendShare，body 只有 { token }。
  //   - apiResetKeylessBackendShare(params: { token: string })
  //     请求 POST /prime/v1/keyless-wallet/resetKeylessBackendShare，body 只有 { token }。
  //   - apiUploadKeylessBackendShare(params: { token: string, ... })
  //     请求 POST /prime/v1/keyless-wallet/createKeylessBackendShare，body 里复用同一个 token。
  // - 对应现有服务端路径：
  //   - POST /prime/v1/keyless-wallet/getKeylessBackendShare
  //   - POST /prime/v1/keyless-wallet/resetKeylessBackendShare
  //   - POST /prime/v1/keyless-wallet/createKeylessBackendShare
  // token 本身包含 provider identity 信息，服务端必须从 token 校验并解析 oauthProvider、
  // OAuth subject、verified email、email verified 状态，再生成稳定 oauthIdentityId = hashId。
  // 客户端不再单独传 oauthProvider、idToken、authorizationCode 或 refreshToken。
  token: string;

  // 可选：客户端本地旧 OneKeyID Supabase session 中当前有效的 accessToken。
  // 旧 OneKeyID 登录态本身是 accessToken + refreshToken，由 Supabase SDK 管理刷新；
  // 本接口只提交当前 accessToken 作为 legacy 账号信号，不提交 refreshToken。
  // 读代码入口：先看现有 OneKeyID 登录态如何把当前 accessToken 传给 Prime。
  // - packages/kit-bg/src/services/ServicePrime/ServicePrime.tsx
  //   - apiLogin({ accessToken }) 调用旧 POST /prime/v1/user/login。
  //   - 旧接口 body 为空，通过 header X-Onekey-Request-Token: accessToken 传递登录 token。
  //   - apiLogin 成功后 simpleDb.prime.saveAuthToken(accessToken) 保存该 token。
  //   - simpleDb.prime.getAuthToken() 读取当前 OneKeyID auth token
  // - packages/kit-bg/src/services/ServiceOneKeyID/ServiceOneKeyID.ts
  //   - loginWithAccessToken({ accessToken }) -> servicePrime.apiLogin({ accessToken })
  // - packages/kit-bg/src/services/ServiceBase.ts
  //   - getOneKeyIdClient() 会从 simpleDb.prime.getAuthToken() 读取 token，
  //     并写入 header X-Onekey-Request-Token。
  // 新字段命名为 legacyOneKeyIdAuthToken，是为了和上面的 Keyless Supabase token 区分；
  // 它的值是旧 OneKeyID Supabase session 当前 accessToken，不是完整 session pair。
  // 服务端必须自行校验 token 的签名、过期时间、撤销状态和账号状态，
  // 并从 token / session 中提取 onekeyUserId、legacy email、账号是否 active 等上下文。
  // 客户端不能上报 hasLocalLegacyOneKeyIdSession、hasLocalLegacyLoginCredential
  // 或 currentOneKeyUserId 这类可伪造字段。
  // 该 token 只作为防止账户分叉的信号，不是直接绑定 proof：
  // 当 OAuth identity 无法通过同 email 自动绑定，但服务端验证到本地确实有 legacy
  // OneKeyID 登录态时，应返回 manual_merge_required，而不是直接创建新的 OneKeyID。
  // 即使该 token 验证通过，服务端也不能直接把 OAuth identity 绑定到该 legacy
  // OneKeyID；最终显式合并仍必须经过 /merge/prepare、/merge/verify-target、
  // /merge/confirm，并要求当前 OAuth credential + legacy Email OTP。
  // 如果用户意图是“当前已登录 legacy email OneKeyID，主动升级到 Google / Apple OAuth 登录方式”，
  // 必须调用 API-03；不能通过本登录接口传两个 token 来表达主动升级。
  // 如果该 token 缺失、过期、被撤销或无法校验，服务端不能把它当作 legacy 账号信号。
  legacyOneKeyIdAuthToken?: string;
};
```

### Response

服务端响应仍包在项目通用 `IApiClientResponse<T>` 内；下面只描述 `data` 字段。

```ts
type IOneKeyIdOAuthLoginResponse = {
  // 本接口固定返回同一个 response shape。
  // 这里的 status 是 2xx 成功响应内的 workflow status，不是错误码。
  // 需要给客户端继续处理的数据必须放在 response data 里；项目通用 error path
  // 只按 code / message 处理，不依赖 extra data。因此 manual_merge_required 不能放到 terminal error。
  // 字段枚举使用上面的通用 workflow status 全集。
  // API-01 实际返回 success / manual_merge_required。
  // status = success 时，onekeySession、onekeyAccount、oauthIdentityBinding 必须有值，manualMerge 必须不返回。
  // status = manual_merge_required 时，manualMerge 必须有值，
  // onekeySession、onekeyAccount、oauthIdentityBinding 必须不返回。
  // success：本次 OAuth 登录已经得到 active OneKeyID session。
  // manual_merge_required：本次 OAuth credential 合法，服务端已经产出继续合并所需的 sourceOauthHandle。
  status: IOneKeyIdOAuthFlowStatus;

  // 本次提交的 OAuth token 解析出的 identity 摘要。
  // 这里实际返回 IOneKeyIdIdentity 中 identityType = oauth 的 variant。
  // 无论 status 是 success 还是 manual_merge_required 都必须返回。
  // 客户端用 oauthIdentityId 写入 / 读取 OAuthIdentityCredentialStorage。
  oauthIdentity: IOneKeyIdIdentity;

  // 新 OneKeyID Supabase Auth session。
  // 仅 status = success 时有值；manual_merge_required 时必须不返回。
  // 兼容说明：旧 OneKeyID 登录态也是 Supabase session pair，
  // refresh 由 Supabase SDK 管理；现有 Prime 接口调用时只取当前 accessToken
  // 放到 X-Onekey-Request-Token。
  // 新统一登录接口也必须返回由 OneKeyID Supabase Auth 签发的 session pair，
  // 不要由 Prime 自己签发一套独立 JWT，也不要简化成单个 authToken 字段。
  // 客户端收到后调用：
  // getSupabaseClient().client.auth.setSession({
  //   access_token: onekeySession.accessToken,
  //   refresh_token: onekeySession.refreshToken,
  // });
  // 后续 accessToken 刷新继续交给 Supabase SDK 的 autoRefreshToken / refreshSession 能力。
  onekeySession?: IOneKeyIdSessionCredential;

  // 当前登录成功后的 active OneKeyID。
  // 仅 status = success 时有值；manual_merge_required 时必须不返回。
  onekeyAccount?: IOneKeyIdAccount;

  // OAuth identity 的绑定结果。
  // 仅 status = success 时有值；manual_merge_required 时必须不返回。
  // API-01 success payload 中 bindingStatus 实际只返回 bound；
  // bindReason 实际不返回 legacy_session_authorized_bind。
  oauthIdentityBinding?: IOneKeyIdOAuthBindingResult;

  // 手动合并上下文。
  // 仅 status = manual_merge_required 时有值；success 时必须不返回。
  // 对本登录接口而言，进入 manual_merge_required 的前提是：
  // - 当前 OAuth token 合法；
  // - 当前 OAuth identity 尚未绑定 active OneKeyID；
  // - 不能通过 real verified email 静默绑定到 legacy email 或 active email claim；
  // - 客户端提交了 legacyOneKeyIdAuthToken，且服务端验证它对应一个 active legacy OneKeyID。
  // 如果没有提交 legacyOneKeyIdAuthToken，或 token 过期 / 被撤销 / 无法校验，
  // 本接口不能返回 manual_merge_required：要么继续创建 / 登录 OAuth OneKeyID，
  // 要么返回 oauth_credential_invalid / support_required 等终止类错误。
  // 另外，用户已经登录 OAuth 新 OneKeyID 后主动从 Merge existing OneKeyID 入口合并旧账号，
  // 是另一条显式合并路径，不由本字段触发。
  manualMerge?: IOneKeyIdManualMerge;
};

type IOneKeyIdOAuthLoginErrorCode =
  // 终止类错误码：本次 /account/oauth/login 不能继续产出可用 session，
  // 也不能产出可继续执行的 manualMerge 前置态。
  // 客户端不能按 IOneKeyIdOAuthLoginResponse 解析 data。
  // OAuth binding 指向的 OneKeyID 已是 merged，说明 binding retarget 不完整。
  // 服务端拒绝签发普通 session，并触发对账修复。
  // 客户端处理：
  // - 不要继续使用本地旧 OneKeyID session，也不要把 source 透明切到 target。
  // - 清理本地 OneKeyID Supabase session / primePersistAtom。
  // - 报错并回到登录界面，让用户手动重新发起 Google / Apple 登录。
  // - 客户端不能自动重试或自动重新调用本接口，避免服务端持续返回同一错误时进入循环。
  | 'account_merged_reauth_required'
  // 历史数据存在无法自动判定的问题，例如同一个 legacy email 命中多个 active OneKeyID，
  // 或 email claim 迁移不完整。
  // 本方案暂不引入单独的账号锁定状态。登录、OAuth 自动绑定、manual merge、Email OTP
  // 等在线业务流程遇到需要人工处理的异常时，统一返回 support_required。
  // 客户端处理：
  // - 不创建新的 OneKeyID，不进入普通登录态，也不自动选择某个 target。
  // - 展示客服 / 风控处理入口；用户处理完成后再重新发起 OAuth 登录。
  | 'support_required'
  // OAuth token 无效、过期、oauthProvider 不匹配或无法验证。
  // 客户端处理：
  // - 清理本次 OAuth 登录过程中产生的临时 credential / OneKeyID session 状态。
  // - 报错并回到登录界面，让用户手动重新发起 Google / Apple 登录。
  // - 客户端不能自动使用当前 token 重试本接口。
  | 'oauth_credential_invalid';
```

终止类错误通过业务错误码返回，不作为 `IOneKeyIdOAuthLoginResponse.status` 返回：

- 具体错误码含义见上面的 `IOneKeyIdOAuthLoginErrorCode` 注释。
- `manual_merge_required` 不属于这里的终止类错误；它是 2xx workflow status，因为客户端需要从 response data 读取 `manualMerge.sourceOauthHandle` / `reason` / `expiresAt` 后继续合并流程，不能依赖 error path 的 extra data。

### Examples

API-01 示例已拆分到 [api-01-oauth-login-examples.md](./api-01-oauth-login-examples.md)。

---------------------------------------------------------

## API-02 🆕 `GET /prime/v1/account/profile`

接口性质：**新增接口**。用于读取当前 OneKeyID session 对应的 profile 聚合信息

### Request

```ts
type IOneKeyIdProfileRequestHeaders = {
  // 当前 OneKeyID Supabase session 的 access_token。
  // 和现有 Prime 登录态接口保持一致，通过 header 传递当前 accessToken。
  // 读代码入口：
  // - packages/kit-bg/src/services/ServiceBase.ts
  //   - getOneKeyIdClient() 会从 simpleDb.prime.getAuthToken() 读取 token，
  //     并写入 header X-Onekey-Request-Token。
  // - packages/kit-bg/src/services/ServicePrime/ServicePrime.tsx
  //   - apiLogin({ accessToken }) 成功后 simpleDb.prime.saveAuthToken(accessToken)。
  // 这里不能传 refreshToken，也不能传 Google / Apple OAuth token。
  // accessToken 缺失、过期、被撤销或无法校验时返回 401。
  'X-Onekey-Request-Token': string;
};

// Request body: none
```

### Response

服务端响应仍包在项目通用 `IApiClientResponse<T>` 内；下面只描述 `data` 字段。

```ts
type IOneKeyIdProfileResponse = {
  // 当前 session 对应的 active OneKeyID。
  // 字段结构与共享类型 `IOneKeyIdAccount` 完全一致；
  // 这里不重复展开字段说明。
  // 如果 session 指向 merged source，不能返回 profile；
  // 必须返回 account_merged_reauth_required / 401，让客户端清理本地 session 并重新登录。
  onekeyAccount: IOneKeyIdAccount;
};
```

---------------------------------------------------------

## API-03 🆕 `POST /prime/v1/account/identities/oauth/bind`

接口性质：**新增接口**。用于当前已经登录的 legacy email OneKeyID 用户，在 Account Security / Login methods 之类的主动入口里，把当前 legacy email OneKeyID 升级到 Google / Apple OAuth 登录方式。

这个接口**完成的是升级到 OAuth 登录方式，不是绑定 legacy email，也不是合并两个 OneKeyID account**。target legacy email OneKeyID 必须由 request body 里的 `legacyOneKeyIdAuthToken` 明确指定。服务端必须同时校验两份 proof：request body 里的 OAuth token 和 legacy email OneKeyID token；两者都合法时，才允许把 OAuth identity 绑定到该 legacy email OneKeyID。

它解决的问题是：老 Email + OTP 用户主动把当前 legacy email OneKeyID 升级到 Google / Apple OAuth 登录方式，避免后续继续依赖 legacy Email + OTP。target legacy email OneKeyID 一律来自 request body 里的 `legacyOneKeyIdAuthToken`，不能从 `X-Onekey-Request-Token` 或其他隐式登录态推断。

新版本客户端不提供 legacy Email + OTP 登录入口，因此没有当前 legacy email OneKeyID session 的用户不能直接走 API-03。此类用户应先通过 Google / Apple 调用 API-01 登录 / 创建 OAuth OneKeyID，再通过 API-04 到 API-06 用 legacy Email OTP 显式确认 target legacy email OneKeyID 并完成合并。

它不参与普通登录流程，也不是 API-01 `manual_merge_required` 的后续接口。API-01 已经负责登录时的 OAuth identity 校验、自动绑定、创建 OneKeyID 和 pending merge 判断；API-03 只处理“用户已经有一个明确的当前 legacy email OneKeyID token，现在要把这个 legacy email OneKeyID 升级到 OAuth 登录方式”的主动升级场景。

### 与 API-01 的边界

API-01 和 API-03 都会校验 OAuth token，也都可能接收 `legacyOneKeyIdAuthToken`，因此服务端内部可以复用同一套 OAuth credential 校验、OAuth identity 解析、OAuth binding 查询 / 写入、email claim 冲突检查和 OneKeyID account 状态校验能力。

但它们不应合并成一个公开接口。两个接口的 request body 看起来相近，业务 intent 不同；如果合并，服务端必须根据同样的两个 token 猜测用户是在“登录 / 创建 / upsert OneKeyID”，还是在“把指定 legacy email OneKeyID 升级到 OAuth 登录方式”，容易造成错误绑定或错误登录。

| 场景 / 规则 | API-01 `POST /account/oauth/login` | API-03 `POST /account/identities/oauth/bind` |
| --- | --- | --- |
| 接口 intent | OAuth 登录 / 创建 / upsert OneKeyID。 | 已登录 legacy email OneKeyID 后，主动升级到 Google / Apple OAuth 登录方式。 |
| `legacyOneKeyIdAuthToken` 语义 | 可选防分叉信号；不是直接绑定 proof。 | 必填 target proof；明确指定要绑定到哪个 legacy email OneKeyID。 |
| 是否可以创建新 OneKeyID | 可以。没有可自动绑定目标且没有可验证 legacy token 时，可以创建 OAuth OneKeyID。 | 不可以。只能绑定到 `legacyOneKeyIdAuthToken` 对应的 active legacy email OneKeyID。 |
| OAuth identity 已绑定 OneKeyID A | 正常登录 OneKeyID A；如果 A 已 merged，则返回 `account_merged_reauth_required` / `support_required`。 | 如果 target 不是 A，必须返回 `oauth_identity_bound_to_another_account`；不能登录 A，也不能直接转移 binding。 |
| 跨 email / Apple private relay / missing verified email，且提交了合法 legacy token | 返回 `manual_merge_required`，进入 API-04 到 API-06 的显式合并流程；不能直接绑定。 | 两个 token 都验证通过且没有 binding / email claim 冲突时，可以直接绑定到该 legacy email OneKeyID；不要求 legacy Email OTP。 |
| response session | `success` 时返回新的 `onekeySession`，客户端进入 OneKeyID 登录态。 | 不返回新的 `onekeySession`；客户端已经持有 target legacy email OneKeyID session，本接口只返回绑定后的 `onekeyAccount` 和 `oauthIdentityBinding`。 |
| legacy Email OTP | 本接口不接收 OTP；需要显式合并时，后续 API-04 到 API-06 使用 legacy Email OTP。 | 不需要 legacy Email OTP；`legacyOneKeyIdAuthToken` 已经是当前 target proof。 |

典型使用场景：

- 主场景：当前已登录的是 legacy email OneKeyID，用户主动点击 `Upgrade with Google` / `Upgrade with Apple`，把这个 legacy email OneKeyID 升级到 OAuth 登录方式。
- 迁移场景：当前已登录的是 legacy email OneKeyID，用户在 Keyless create / restore / upgrade 前，需要先把当前 Google / Apple OAuth identity 归属到这个 legacy email OneKeyID。
- 幂等场景：当前 OAuth identity 已经绑定到 `legacyOneKeyIdAuthToken` 对应的 legacy email OneKeyID，服务端幂等返回成功。

不是本接口处理的场景：

- 不创建、绑定或恢复 legacy email identity；legacy email 只作为老账号已有的 proof。
- 不给 OAuth-only OneKeyID 提供显式入口去添加另一个 Google / Apple OAuth provider；即使另一个 provider 返回相同 verified email，也不走 API-03。
- 不处理未登录用户的 Google / Apple 普通登录；该场景走 API-01。
- 不处理 OAuth 新账号合并到 legacy 账号的显式合并流程；该场景走 API-04 到 API-06，最终由 API-06 `/merge/confirm` 改写 OAuth binding。
- 不处理“某个 OAuth identity 已经绑定到 OneKeyID A，现在要转移到 legacy email OneKeyID B”的场景。API-03 必须返回 `oauth_identity_bound_to_another_account`，不能直接转移；该场景属于显式账号合并，最终由 API-06 执行 binding retarget。

绑定规则：

- `legacyOneKeyIdAuthToken` 对应的 target OneKeyID 必须是 legacy email OneKeyID，且必须有 `legacy_email` identity。`legacyOneKeyIdAuthToken` 已经是 target proof；本接口不再要求 legacy Email OTP。
- 同 email 绑定、跨 email 绑定、Apple private relay、无 verified email OAuth identity 都使用同一套 proof：`legacyOneKeyIdAuthToken` + OAuth token。
- `legacyOneKeyIdAuthToken` 对应的 target OneKeyID 不是 legacy email OneKeyID（例如 OAuth-only 账号）时，本接口不提供绑定能力。客户端不应该展示入口；服务端如果收到请求，返回终止类错误 `oauth_bind_requires_legacy_email`。
- 如果当前 OAuth identity 已经绑定到另一个 active OneKeyID，本接口不能转移 binding，必须返回 `oauth_identity_bound_to_another_account`，提示客户端走显式账号合并或支持流程。
- 如果当前 OAuth verified email 的 active email claim owner 不是 `legacyOneKeyIdAuthToken` 对应的 legacy email OneKeyID，本接口不能覆盖该 claim，必须返回 `oauth_email_claim_conflict`，提示客户端走显式账号合并或支持流程。

本接口不写入本地 Keyless wallet 关系，也不建立 OneKeyID 到 `keylessWalletId` 的服务端归属关系。

### Request

字段集合与 API-01 request 相同，都是通过 POST body 提交 `token` 和 `legacyOneKeyIdAuthToken`。差异是：API-01 的 `legacyOneKeyIdAuthToken` 是可选防分叉信号；API-03 的 `legacyOneKeyIdAuthToken` 是必填 target proof，用来明确指定要绑定到哪个 legacy email OneKeyID。

```ts
type IOneKeyIdOAuthBindRequest = {
  // 当前要绑定的 OAuth Supabase access token。
  // 字段含义与 API-01 `IOneKeyIdOAuthLoginRequest.token` 完全一致；
  // 这里不重复展开 OAuth token 校验说明。
  token: string;

  // 当前已登录 legacy email OneKeyID Supabase session 的 accessToken。
  // 字段名与 API-01 `IOneKeyIdOAuthLoginRequest.legacyOneKeyIdAuthToken` 保持一致，
  // 用来和上面的 OAuth token 明确区分。
  // 但 API-01 中该字段是可选防分叉信号；API-03 中该字段是必填 target proof。
  // 服务端必须校验 token 签名、过期时间、撤销状态和账号状态，
  // 并确认它对应 active 且拥有 legacy_email identity 的 legacy email OneKeyID。
  // 如果 token 缺失、过期、被撤销或无法校验，返回 401 / onekey_session_invalid。
  // 如果 token 对应 merged source，返回 account_merged_reauth_required / 401。
  // 这里不能传 refreshToken，也不能通过 X-Onekey-Request-Token 指定 target。
  legacyOneKeyIdAuthToken: string;

  // 不需要提交 legacy Email OTP confirmation。
  // legacyOneKeyIdAuthToken 已经作为 target proof。
};
```

### Response

服务端响应仍包在项目通用 `IApiClientResponse<T>` 内；下面只描述 `data` 字段。

```ts
type IOneKeyIdOAuthBindResponse = {
  // 本接口固定返回同一个 response shape。
  // 这里的 status 是 2xx 成功响应内的 workflow status，不是错误码。
  // 字段枚举使用上方共享 workflow status 全集。
  // API-03 的 2xx response 实际只返回 success；
  // manual_merge_required 是 API-01 使用的 workflow status，本接口不返回。
  // status = success 时，oauthIdentityBinding 必须有值。
  // success：当前 OAuth identity 已经绑定到 legacyOneKeyIdAuthToken 对应的 legacy email OneKeyID。
  status: Extract<IOneKeyIdOAuthFlowStatus, 'success'>;

  // 本次提交的 OAuth token 解析出的 identity 摘要。
  // 这里实际返回 IOneKeyIdIdentity 中 identityType = oauth 的 variant。
  // status = success 时必须返回。
  // 字段结构与共享类型 `IOneKeyIdIdentity` 完全一致；
  // 这里不重复展开字段说明。
  oauthIdentity: IOneKeyIdIdentity;

  // legacyOneKeyIdAuthToken 对应的 active legacy email OneKeyID。
  // 字段结构与共享类型 `IOneKeyIdAccount` 完全一致；
  // 这里不重复展开字段说明。
  // 2xx response 中始终返回，因为本接口必须提交合法的 legacyOneKeyIdAuthToken。
  // identities 必须包含本次绑定成功的 OAuth identity。
  onekeyAccount: IOneKeyIdAccount;

  // OAuth identity 的绑定结果。
  // 字段结构与共享类型 `IOneKeyIdOAuthBindingResult` 完全一致；
  // 这里不重复展开字段说明。
  // status = success 时必须有值。
  // API-03 success payload 中 bindingStatus 实际只返回 bound；
  // bindReason 实际只返回 existing_oauth_binding / legacy_email_auto_bind /
  // email_claim_auto_bind / legacy_session_authorized_bind。
  oauthIdentityBinding: IOneKeyIdOAuthBindingResult;
};

type IOneKeyIdOAuthBindErrorCode =
  // legacyOneKeyIdAuthToken 缺失、过期、撤销或无法校验。
  // 客户端处理：清理本地 legacy email OneKeyID session / primePersistAtom，回到登录界面。
  | 'onekey_session_invalid'
  // legacyOneKeyIdAuthToken 对应的 legacy email OneKeyID 已是 merged source。
  // 客户端处理同 API-01：清理本地 session，报错并回到登录界面，让用户手动重新登录。
  | 'account_merged_reauth_required'
  // OAuth token 无效、过期、oauthProvider 不匹配或无法验证。
  // 客户端处理：清理本次 OAuth 临时 credential，报错并让用户手动重新发起 OAuth。
  | 'oauth_credential_invalid'
  // 当前 OAuth identity 已绑定到另一个 active OneKeyID。
  // API-03 不能把它强行绑定或转移到 legacyOneKeyIdAuthToken 对应的 legacy email OneKeyID。
  // 如果用户要把 OAuth identity 从 OneKeyID A 转移到 legacy email OneKeyID B，
  // 必须走 API-04 / API-05 / API-06 的显式账号合并流程，最终由 API-06 改写 binding。
  | 'oauth_identity_bound_to_another_account'
  // 当前 OAuth verified email 的 active email claim owner 不是 legacyOneKeyIdAuthToken 对应的 legacy email OneKeyID。
  // 服务端不能覆盖该 claim；客户端应进入显式账号合并或客服流程。
  | 'oauth_email_claim_conflict'
  // legacyOneKeyIdAuthToken 对应的 target OneKeyID 不是 legacy email OneKeyID，
  // 或没有 legacy_email identity。
  // API-03 只服务 legacy email OneKeyID 升级到 OAuth 登录方式；
  // OAuth-only OneKeyID 不提供显式入口绑定另一个 OAuth provider。
  | 'oauth_bind_requires_legacy_email'
  // 历史数据存在无法自动判定的问题，例如 OAuth binding / email claim 唯一性异常。
  // 客户端展示客服 / 风控处理入口。
  | 'support_required';
```

终止类错误通过业务错误码返回，不作为 `IOneKeyIdOAuthBindResponse.status` 返回：

- 具体错误码含义见上面的 `IOneKeyIdOAuthBindErrorCode` 注释。
- API-03 没有 legacy Email OTP 中间态；`legacyOneKeyIdAuthToken` 和 OAuth token 同时验证通过后直接绑定，不能绑定时返回上面的终止类错误。

### Examples

API-03 示例已拆分到 [api-03-oauth-bind-examples.md](./api-03-oauth-bind-examples.md)。

---------------------------------------------------------

## 显式账号合并流程入口：API-04 到 API-06

API-04 / API-05 / API-06 是同一个显式账号合并流程的三个阶段：prepare -> verify target -> confirm。该流程有两个入口场景：

严格来说，只有 `merged_source` 路径是两个 OneKeyID account 的显式合并：source 是当前已登录 OAuth OneKeyID，target 是用户通过 legacy Email OTP 验证的 legacy email OneKeyID。`pending_oauth_bind` 路径还没有 source OneKeyID，它只是把 API-01 已验证但尚未绑定的 OAuth identity，在 target legacy email OneKeyID 完成 OTP 验证后绑定到该 target；为了复用 target 验证、确认页和幂等执行能力，也走 API-04 到 API-06。

| 入口场景 | source proof | sourceType / relationType | API-06 行为 |
| --- | --- | --- | --- |
| API-01 返回 `manual_merge_required` 后继续合并 | API-01 返回的 `manualMerge.sourceOauthHandle`，并在最终 confirm 时重新提交当前 OAuth credential | `pending_oauth_bind` | 不创建 source OneKeyID；重新校验 confirm 时提交的 OAuth credential，并确认它与确认页绑定的 canonical source 一致后，直接绑定到 target legacy email OneKeyID。 |
| 用户已登录 OAuth OneKeyID 后，从低曝光入口主动 `Merge existing OneKeyID` | 当前 OAuth OneKeyID session，并在最终 confirm 时重新提交当前 OAuth credential | `merged_source` | 把当前 OAuth OneKeyID 标记为 `merged` source archive，并把 source active OAuth bindings retarget 到 target legacy email OneKeyID。 |

两条入口都会要求用户通过 legacy Email OTP 验证 target legacy email OneKeyID。API-04 / API-05 阶段不持久化 pending merge 状态；真正执行只发生在 API-06，并且 API-06 必须重新校验 source proof，避免用户在确认前切换 OAuth credential、session 过期或 source 状态变化。

该流程不是 API-03 的后续。API-03 是“当前已登录 legacy email OneKeyID，主动升级到 OAuth 登录方式”，没有第二个 OneKeyID account 参与，也不会把任何 OneKeyID 标记为 `merged`；API-04 到 API-06 是“需要用户用 legacy Email OTP 显式确认 target，再把 OAuth source 绑定 / 合并到该 target”。

在 `merged_source` 路径下，source OneKeyID 不应成为 orphan account。服务端必须把 source 标记为 `merged`，写入 merge relation / archive，retarget source 下 active OAuth bindings，并 revoke source 旧 session；后续这些 source OAuth identities 登录时直接命中 retarget 后的 binding，返回 target legacy email OneKeyID。在 `pending_oauth_bind` 路径下，本来就没有 source OneKeyID，因此也不存在 orphan source account。

---------------------------------------------------------

## API-04 🆕 `POST /prime/v1/account/merge/prepare`

接口性质：**新增接口**。用于显式账号合并前的预检查和 OTP purpose 签发。它只确认本次 source proof 形式合法、target legacy email 格式合法，并按 source + target 做节流和防枚举控制；它不发送 OTP，也不创建 merge request。

### Request

```ts
type IOneKeyIdMergePrepareRequest = IOneKeyIdMergeSourceProof & {
  // 用户输入的 target legacy email。
  // 这是用户希望绑定 / 合并到的 legacy email OneKeyID。
  // 服务端必须规范化后写入 otpPurposeToken，但在 OTP 验证前不能返回 target 是否存在。
  targetLegacyEmail: string;
};
```

`sourceOauthHandle` 和 `sourceOneKeyIdAuthToken` 必须二选一：

- `sourceOauthHandle`：用于 API-01 返回 `manual_merge_required` 后的 `pending_oauth_bind` 路径。它不是 OneKeyID session token，只是服务端签名的短期 source proof。
- `sourceOneKeyIdAuthToken`：用于当前已登录 OAuth OneKeyID 主动合并 legacy email target 的 `merged_source` 路径。它必须是当前 OAuth source OneKeyID 的 access token，不能传 target legacy email OneKeyID token。

### Response

服务端响应仍包在项目通用 `IApiClientResponse<T>` 内；下面只描述 `data` 字段。

```ts
type IOneKeyIdMergePrepareResponse = {
  // 固定为 MergeExistingOneKeyId。
  // 客户端后续调用 API-09 发码时必须原样传入 scene。
  otpScene: 'MergeExistingOneKeyId';

  // 服务端签名的短期 OTP purpose token。
  // 只用于 API-09 发 legacy Email OTP 和 API-05 校验 OTP 业务目的。
  // 客户端只当作 opaque string 保存和回传，不能解析。
  otpPurposeToken: string;

  // 对用户输入 targetLegacyEmail 做脱敏后的展示值。
  // 该字段不能证明 target legacy email OneKeyID 存在。
  targetLegacyDisplayEmail: string;

  // otpPurposeToken 过期时间，ISO 8601 字符串。
  // 过期后客户端必须重新调用 API-04。
  expiresAt: string;
};

type IOneKeyIdMergePrepareErrorCode =
  // sourceOauthHandle 缺失 / 过期 / 验签失败，或 sourceOneKeyIdAuthToken 缺失 / 过期 / 撤销 / 不是 active OAuth OneKeyID。
  | 'merge_source_invalid'
  // targetLegacyEmail 格式非法或无法规范化。
  | 'merge_target_email_invalid'
  // 按 source、target email、设备、IP 等维度触发合并预检查限频。
  | 'merge_prepare_rate_limited'
  // 同一个 canonical source 已经有未完成的合并执行。
  | 'source_merge_in_progress'
  // 历史数据存在无法自动判定的问题，需要客服 / 风控介入。
  | 'support_required';
```

### 业务规则

- API-04 不发送 OTP。客户端拿到 `otpPurposeToken` 后，调用 API-09 `POST /prime/v1/general/emailOTP`，传 `scene = 'MergeExistingOneKeyId'` 和 `otpPurposeToken` 发送 legacy Email OTP，并保存 API-09 返回的 `uuid`。
- API-04 不持久化 pending merge request。服务端只签发短期 `otpPurposeToken`，避免用户反复输入 target email 时产生无意义的执行记录。
- 在 legacy Email OTP 完成前，API-04 不能返回 target 是否存在、target `onekeyUserId`、target account 摘要或 OAuth identity 摘要，避免账号枚举。
- 如果 source 是 `sourceOneKeyIdAuthToken`，服务端只能确认它是 active OAuth OneKeyID source；不能把它当成 target legacy email OneKeyID proof。

---------------------------------------------------------

## API-05 🆕 `POST /prime/v1/account/merge/verify-target`

接口性质：**新增接口**。用于用户输入 legacy Email OTP 后确认 target legacy email OneKeyID，并生成短期 final confirm proof。API-05 仍不执行绑定 / 合并，也不持久化 pending merge request。

### Request

API-05 的 source proof 和 `targetLegacyEmail` 与 API-04 一致；在此基础上增加 API-09 返回的 OTP `uuid` 和用户输入的 OTP code。

```ts
type IOneKeyIdMergeVerifyTargetRequest = IOneKeyIdMergeSourceProof & {
  // 与 API-04 请求中的 targetLegacyEmail 必须一致。
  targetLegacyEmail: string;

  // API-04 返回的 otpPurposeToken。
  otpPurposeToken: string;

  // API-09 发送 MergeExistingOneKeyId OTP 后返回的 uuid。
  otpUuid: string;

  // 用户输入的 legacy Email OTP。
  otpCode: string;
};
```

### Response

```ts
type IOneKeyIdMergeVerifyTargetResponse = {
  // 本次准备绑定 / 合并的 source 摘要。
  // 字段结构与共享类型 IOneKeyIdMergeSourcePreview 完全一致；
  // 这里不重复展开字段说明。
  source: IOneKeyIdMergeSourcePreview;

  // 用户通过 legacy Email OTP 验证后的 target legacy email OneKeyID。
  // 字段结构与共享类型 IOneKeyIdAccount 完全一致；
  // 这里不重复展开字段说明。
  // identities 必须包含 target legacy_email identity。
  targetOneKeyAccount: IOneKeyIdAccount;

  // 本次 confirm 执行期幂等 key。
  // 它不是 secret，也不是授权凭证；不能作为用户恢复登录路径。
  mergeRequestId: string;

  // 加密签名的短期 final confirm proof。
  // 内容至少包含 mergeRequestId、targetOneKeyUserId、target legacy email / normalized email、
  // sourceType、canonical source、iat、exp。
  // 客户端只当作 opaque string 保存和回传。
  finalConfirmHandle: string;

  // finalConfirmHandle 过期时间，ISO 8601 字符串。
  // 过期后如果 API-06 还没有创建 execution record，客户端必须重新调用 API-05。
  expiresAt: string;
};

type IOneKeyIdMergeVerifyTargetErrorCode =
  // source proof 无效，含 sourceOauthHandle 过期 / 验签失败，或 sourceOneKeyIdAuthToken 无效。
  | 'merge_source_invalid'
  // OTP uuid / code 不匹配。
  | 'merge_otp_invalid'
  // OTP 或 otpPurposeToken 已过期。
  | 'merge_otp_expired'
  // OTP 已验证，但 target 不满足 legacy email OneKeyID 合并 target 条件。
  | 'merge_target_invalid'
  // 同一个 canonical source 已经有未完成的合并执行。
  | 'source_merge_in_progress'
  // 历史数据存在无法自动判定的问题，需要客服 / 风控介入。
  | 'support_required';
```

### 业务规则

- API-05 必须重新校验 source proof，不能只相信 API-04 的 `otpPurposeToken`。
- OTP 通过后，服务端可以返回 target legacy email OneKeyID 摘要和当前 source identity 摘要，用于客户端确认页展示。
- `verify-target` 阶段返回的 source 摘要用于确认页展示，并且必须和 API-06 的 canonical source 保持一致。API-06 需要重新校验当前 OAuth credential，但不能把用户在确认页后切换出的另一个 OAuth identity 合并到已确认 target；如果 confirm token 解析出的 identity 与 `finalConfirmHandle` / source proof 中的 canonical source 不一致，返回 `oauth_credential_mismatch`，客户端必须重新走 API-05。
- 如果是 `pending_oauth_bind`，确认页必须明确：还没有 source OneKeyID，不会迁移 source OneKeyID 数据；API-06 成功后只会把与确认页 canonical source 一致的 OAuth identity 绑定到 target legacy email OneKeyID。
- 任何基于 `mergeRequestId` 的执行期状态返回，都必须先校验 source proof、target session，或客服 / 风控 scoped auth；校验失败统一返回 404 / not found，不暴露 record 是否存在或状态。

---------------------------------------------------------

## API-06 🆕 `POST /prime/v1/account/merge/confirm`

接口性质：**新增接口**。用于用户在确认页点击确认后的最终绑定 / 合并执行。API-06 是 API-04 到 API-06 流程中唯一会写入 merge execution record、修改 OAuth binding、签发 target OneKeyID session 的接口。

### Request

```ts
type IOneKeyIdMergeConfirmRequest = IOneKeyIdMergeSourceProof & {
  // API-05 返回的 mergeRequestId。
  // 用作本次执行期幂等 key。
  mergeRequestId: string;

  // API-05 返回的 finalConfirmHandle。
  finalConfirmHandle: string;

  // 当前 OAuth credential 的 Supabase access token。
  // 命名与 API-01 保持一致。
  // 服务端必须重新校验 token，并确认解析出的 OAuth identity 与 finalConfirmHandle
  // 和 source proof 中绑定的 canonical source 一致。
  token: string;
};
```

`sourceOauthHandle` 和 `sourceOneKeyIdAuthToken` 仍然必须二选一：

- `pending_oauth_bind`：提交 `sourceOauthHandle + token`。API-06 不创建 source OneKeyID，只把与 `sourceOauthHandle` / `finalConfirmHandle` canonical source 一致的 OAuth identity 绑定到 target legacy email OneKeyID。
- `merged_source`：提交 `sourceOneKeyIdAuthToken + token`。API-06 必须确认 `sourceOneKeyIdAuthToken` 对应当前 active OAuth OneKeyID，且 `token` 解析出的 OAuth identity 属于该 source，并与 `finalConfirmHandle` canonical source 一致；随后把 source OneKeyID 标记为 `merged`，并把 source 下 active OAuth bindings retarget 到 target legacy email OneKeyID。

### Response

```ts
type IOneKeyIdMergeConfirmResponse = {
  // merged：绑定 / 合并已经完成，返回 target legacy email OneKeyID session。
  // processing：同一个 mergeRequestId 已进入执行中，客户端短时间后可展示重试 / 稍后刷新。
  // failed：执行失败且已落库失败记录，客户端不要自动重试。
  // support_required：服务端无法自动判定，需要客服 / 风控介入。
  status: IOneKeyIdMergeConfirmStatus;

  // 本次执行的 source 类型。
  sourceType: IOneKeyIdMergeSourceType;

  // 执行记录摘要。
  // 字段结构与共享类型 IOneKeyIdMergeExecution 完全一致；
  // 这里不重复展开字段说明。
  mergeExecution: IOneKeyIdMergeExecution;

  // status = merged 时返回。
  // 这是 target legacy email OneKeyID 的新 session。
  onekeySession?: IOneKeyIdSessionCredential;

  // status = merged 时返回。
  // 字段结构与共享类型 IOneKeyIdAccount 完全一致；
  // identities 必须包含 target legacy_email identity、本次绑定 / retarget 成功的 OAuth identity；
  // merged_source 路径下，还必须包含从 source retarget 到 target 的其他 active OAuth identities。
  onekeyAccount?: IOneKeyIdAccount;

  // status = merged 时返回。
  // 本次 confirm 时提交的 OAuth token 解析出的 identity 摘要。
  oauthIdentity?: IOneKeyIdIdentity;

  // status = merged 时返回。
  // 描述本次 confirm 时提交的 OAuth identity 绑定结果。
  // API-06 success payload 中 bindingStatus 实际只返回 bound；
  // bindReason 实际只返回 manual_merge_confirmed_bind / merged_source_retarget。
  oauthIdentityBinding?: IOneKeyIdOAuthBindingResult;

  // status = processing 时可返回。
  retryAfterSeconds?: number;

  // status = failed / support_required 时可返回。
  supportMessage?: string;
};

type IOneKeyIdMergeConfirmErrorCode =
  // mergeRequestId 不存在，或请求方没有权限感知该 execution record。
  // 为避免枚举，source proof 校验失败也可以统一返回该错误或 404 / not found。
  | 'merge_request_not_found'
  // finalConfirmHandle 已过期，且还没有 execution record。
  | 'merge_confirm_expired'
  // source proof 无效，或 sourceOneKeyIdAuthToken 不是 active OAuth OneKeyID。
  | 'merge_source_invalid'
  // OAuth token 无效、过期、被撤销，或与 source proof 不匹配。
  | 'oauth_credential_invalid'
  // OAuth token 本身有效，但解析出的 identity 与 API-05 确认页绑定的 canonical source 不一致。
  // 客户端必须丢弃当前 confirm 上下文，重新走 API-05，不能继续用旧确认页结果合并新 identity。
  | 'oauth_credential_mismatch'
  // 同一个 canonical source 已经有未完成的合并执行。
  | 'source_merge_in_progress'
  // sourceOneKeyIdAuthToken 对应的 OAuth OneKeyID 已是 merged source。
  | 'account_merged_reauth_required'
  // 历史数据存在无法自动判定的问题，需要客服 / 风控介入。
  | 'support_required';
```

### 业务规则

- API-06 必须重新校验 `finalConfirmHandle`、source proof 和当前 OAuth `token`。`finalConfirmHandle` 必须绑定 API-05 确认页展示的 sourceType 与 canonical source；如果用户在 API-05 后切换 OAuth credential，服务端必须返回 `oauth_credential_mismatch`，不能把新的 OAuth identity 合并到用户已经确认的 target。
- 服务端按 `mergeRequestId` 幂等执行。若 execution record 已存在，授权通过后按 record 当前状态返回，不要求 `finalConfirmHandle` 仍未过期；若 record 不存在，必须验签并确认 `finalConfirmHandle` 未过期，才能创建 execution record。
- 除了 `mergeRequestId` 唯一约束，API-06 还必须按 canonical source 建立 source-level execution lock。canonical source key 为 `oauthProvider + oauthSubject`（`pending_oauth_bind`）或 `sourceOneKeyUserId`（`merged_source`）。同一 source 已有未完成 `processing` relation 时，返回 `source_merge_in_progress`，不能创建第二条执行记录。
- 如果执行失败或需要客服介入，必须在主合并事务外或独立审计事务中把 execution record 更新为 `failed` / `support_required`，保留结构化失败记录。不能只依赖接口日志。
- 同一个 `mergeRequestId` 的短期重试：授权通过后，若状态已是 `merged`，直接返回 target OneKeyID；若状态是未超时的 `processing`，返回 `processing` 和 `retryAfterSeconds`；若状态是 `failed` 或 `support_required`，返回对应状态和处理指引，不重复执行。
- 如果客户端没有收到 confirm 响应，或后续遇到 source session 失效 / `account_merged_reauth_required`，客户端不要依赖 `mergeRequestId` 找回登录态。必须清理本地 OneKeyID token / `primePersistAtom`，回到登录界面，让用户手动重新发起 Google / Apple 登录。用户手动登录后，如果合并已完成，服务端根据 OAuth binding 当前归属直接签发 target session。
- 如果 `finalConfirmHandle` 已过期且还没有 execution record，不能开始新的合并执行；服务端返回 `merge_confirm_expired`，客户端必须重新走 API-05 获取新的 `mergeRequestId` 和 `finalConfirmHandle`。
- 如果 `processing` 已超时，服务端必须先做状态对账：OAuth binding 是否已指向 target、source `status`、target merge relation、identity retarget 子表。确认已经完成则更新为 `merged` 并返回成功；确认尚未执行才允许重新锁定并继续执行；无法判断时更新为 `support_required`。
- `merged_source` 路径下，source OneKeyID 不迁移业务数据到 target。合并成功后，source OneKeyID 标记为 `merged` archive，source 下 active OAuth bindings retarget 到 target，source session 被撤销；后续这些 OAuth identities 登录时直接命中 retarget 后的 target legacy email OneKeyID。API-06 response 中的 `oauthIdentityBinding` 只描述本次 confirm 时提交的 OAuth identity；其他被 retarget 的 OAuth identities 通过 `onekeyAccount.identities` 体现。
- `pending_oauth_bind` 路径下，不创建 source OneKeyID。确认后直接把 confirm 时提交的 OAuth identity 绑定到 target legacy email OneKeyID；如果该 OAuth identity 有 verified email，还要在同一事务内为该 OAuth email 创建或迁移 active email claim 到 target。

### Examples

API-04 到 API-06 示例已拆分到 [api-04-05-06-09-onekeyid-merge-examples.md](./api-04-05-06-09-onekeyid-merge-examples.md)。

---------------------------------------------------------

## API-07 ⏸️ `GET /prime/v1/account/merge/history`

接口优先级：**后续可选，非 MVP 必需**。主登录、OAuth 绑定和显式合并流程不依赖本接口；MVP 阶段不需要开发客户端公开接口，也不需要用户侧入口。用户需要查询 merged source 历史时，先由客服 / 风控通过内部后台、SQL 或 admin tool 查询服务端审计记录和 merge relation。

- 返回当前 OneKeyID 下的已合并 source 账号列表。
- 后续如果产品需要自助查看，可用于低曝光的只读查看入口，例如 Account Security / Advanced / Merged accounts。
- 没有用户入口时，不影响 API-01 / API-03 / API-04 到 API-06 的主流程。

---------------------------------------------------------

## API-08 ⏸️ `GET /prime/v1/account/merge/source/:sourceOneKeyId`

接口优先级：**后续可选，非 MVP 必需**。它只服务已合并 source 的只读详情查询；MVP 阶段不需要开发客户端公开接口。只要求服务端保留 source archive、merge relation 和审计日志，供客服 / 风控通过内部后台、SQL 或 admin tool 查询。

- 只读查看某个已合并 source 账号的摘要和 OAuth identity 处理状态。
- 返回 source oauthProvider / masked email、合并时间、OAuth identity 归属状态。
- 必须校验当前 session 的 OneKeyID 是该 source 的 target OneKeyID，或当前请求持有客服 / 风控 scoped auth；否则返回 404 / not found，不暴露 source 是否存在、是否 merged、target 是谁或任何 masked identity 信息。
- 对 source id 查询必须做限频和审计日志，避免把 merged source 只读接口变成账号枚举入口。

---------------------------------------------------------

## API-09 🔄 `POST /prime/v1/general/emailOTP`

接口性质：**修改旧接口**。复用现有独立发码接口，给 API-04 到 API-06 的显式合并流程新增 `MergeExistingOneKeyId` scene，并为该 scene 扩展 `otpPurposeToken` 参数。旧 scene 的请求 / 响应语义必须保持兼容。

当前客户端 wrapper 参考与改造要求：

- [ServicePrime.sendEmailOTP](/Users/admin/workspace/app-monorepo/.worktrees/prague13/packages/kit-bg/src/services/ServicePrime/ServicePrime.tsx:914)：当前 request body 只有 `{ scene }`。
- [EPrimeEmailOTPScene](/Users/admin/workspace/app-monorepo/.worktrees/prague13/packages/shared/src/consts/primeConsts.ts:32)：当前已有 `UpdateReabteWithdrawAddress`、`DeleteAccount` 两个 scene。
- 当前 response data 是 `{ resendAt: number; uuid: string }`。
- wrapper 需要从 `sendEmailOTP(scene)` 改成 `sendEmailOTP(params: { scene; otpPurposeToken? })` 或等价结构，确保 `scene = MergeExistingOneKeyId` 时可以把 API-04 返回的 `otpPurposeToken` 放入 request body。
- 当前 wrapper 使用 `getOneKeyIdClient`；该 client 只在本地存在 OneKeyID auth token 时附加 `X-Onekey-Request-Token`。`MergeExistingOneKeyId` 的 `pending_oauth_bind` 路径没有 OneKeyID session，因此客户端 wrapper 不能强制要求本地 OneKeyID auth token，服务端也不能强制依赖 header auth；本 scene 必须以有效 `otpPurposeToken` 作为业务 proof。旧 scene 仍按现有鉴权语义保持兼容。

### Request

```ts
type IOneKeyIdEmailOtpRequest = {
  // 现有 scene 继续保持兼容，当前包括：
  // - UpdateReabteWithdrawAddress
  // - DeleteAccount
  // 本迁移新增 MergeExistingOneKeyId，用于 API-04 到 API-06 显式合并流程里的 target legacy Email OTP。
  scene: EPrimeEmailOTPScene | 'MergeExistingOneKeyId';

  // 仅 scene = MergeExistingOneKeyId 时必填。
  // 来自 API-04 IOneKeyIdMergePrepareResponse.otpPurposeToken。
  // 服务端必须验签，并从 token 内解析 target legacy email；
  // 本接口不额外接收 email 字段，避免客户端伪造或造成 target 语义不一致。
  // 服务端还必须校验 token 内的 scene、过期时间和节流上下文。
  otpPurposeToken?: string;
};
```

### Response

```ts
type IOneKeyIdEmailOtpResponse = {
  // 当前客户端 wrapper 已按 number 声明返回。
  // 具体语义由现有服务端保持不变，通常用于重发冷却 / resend 提示。
  resendAt: number;

  // 本次 Email OTP 发送记录的 uuid。
  // 客户端后续调用 API-05 时，把它作为 otpUuid 提交。
  uuid: string;
};

type IOneKeyIdEmailOtpErrorCode =
  // scene = MergeExistingOneKeyId 但缺少 otpPurposeToken。
  | 'otp_purpose_token_required'
  // otpPurposeToken 无效、过期，或 scene 不匹配。
  | 'otp_purpose_token_invalid'
  // 发码频率限制。必须保持防枚举语义，不能泄露 target legacy email 是否存在。
  | 'email_otp_rate_limited'
  // scene 不存在或不允许当前调用方使用。
  | 'email_otp_scene_invalid';
```

### 业务规则

- API-09 只发送 OTP，不判断最终业务是否允许合并、登录或注册；业务确认仍由 API-05 或各 scene 对应的业务确认接口完成。
- `MergeExistingOneKeyId` 场景必须要求 `otpPurposeToken`，由 API-04 签发。发码接口验签后按 token 内的 target legacy email 发码或返回中性结果，不能通过错误码、文案或时序泄露 target 是否存在。
- 现有代码已经把发送 Email OTP 做成独立接口：客户端先调用该接口拿到 `uuid`，再在业务确认接口提交 `uuid + code`。本迁移继续沿用这个模型，不能让 API-04 `/merge/prepare` 或 API-05 `/merge/verify-target` 承担发码副作用。
- 旧客户端兼容：已有 scene 的请求 / 响应语义必须保持不变；`otpPurposeToken` 只在 `scene = MergeExistingOneKeyId` 时必填，不能让旧 scene 因缺少该字段失败。

### Examples

API-09 的 `MergeExistingOneKeyId` 示例与 API-04 到 API-06 示例放在同一个业务场景文档：[api-04-05-06-09-onekeyid-merge-examples.md](./api-04-05-06-09-onekeyid-merge-examples.md)。

---------------------------------------------------------

## API-10 ⛔ `GET /api/prime/send-email-verification-code`

- 当前旧 Email + OTP 登录 / 注册流程使用的发码接口。
- 当前客户端 wrapper 参考 [ServicePrime.apiSendEmailVerificationCode](/Users/admin/workspace/app-monorepo/.worktrees/prague13/packages/kit-bg/src/services/ServicePrime/ServicePrime.tsx:573)：GET query params 为 `{ email: string; verifyUUID: string }`，当前声明的 server response data 为 `{ success: boolean }`。
- 迁移后只允许用于旧客户端对已有 legacy email OneKeyID 的登录 / 找回兼容。
- 新版本客户端不应该把 Email + OTP 作为登录入口，也不应该依赖本接口发码；新统一登录主入口只能走 Google / Apple OAuth 登录和 API-01。
- 不作为普通主登录入口的发码接口，不支持探测或创建新 email 账户。
- 必须保持防枚举：无论 email 是否存在，前端展示中性文案；服务端错误码、发送节流和响应时间不能暴露账号是否存在。
- 旧客户端兼容：已有 active legacy email OneKeyID 的发码 / 找回路径继续可用，保证老用户在兼容期内仍能登录或查看 legacy 账号。
- 新 email 注册收口：旧客户端如果继续尝试走 Email + OTP 注册新 OneKeyID，本接口不能暴露“注册已关闭”或“email 不存在”；可以返回中性结果，但最终 API-11 必须拒绝创建账号，并提示升级 App 后使用 Google / Apple。
- 该接口不能被新统一登录主路径调用。

---------------------------------------------------------

## API-11 ⛔ `POST /api/prime/login`

- 当前旧 Email + OTP 登录 / 注册流程使用的确认接口。
- 当前客户端 wrapper 参考 [ServicePrime.apiPrimeLogin](/Users/admin/workspace/app-monorepo/.worktrees/prague13/packages/kit-bg/src/services/ServicePrime/ServicePrime.tsx:601)：POST body 为 `{ email: string; password: string; emailCode: string; verifyUUID: string; isRegister: boolean }`，当前声明的 server response data 为 `{ success: boolean }`。
- 本接口只作为旧客户端兼容接口保留；新版本客户端不应该调用本接口建立登录态，也不应该展示 Email + OTP 普通登录入口。
- `isRegister = false` 的 legacy email 登录 / 找回能力只保留给旧客户端上的已有 active legacy email OneKeyID。
- `isRegister = true` 或明确的新 email 注册 / 创建 OneKeyID 请求一律拒绝并返回 `legacy_register_disabled`。
- 下线注册能力不依赖客户端版本 gating；登录 / 找回能力在 Phase 5 之前继续兼容老客户端。
- 不作为普通主登录入口，不创建新 email 账户。
- 旧客户端影响：旧版本客户端仍可让已有 legacy email 用户完成登录 / 找回；但旧版本客户端的新 email 注册能力会被服务端有意关闭。这是产品策略变化，不是协议兼容事故。
- 旧客户端遇到新 email 登录 / 注册诉求时，应提示升级 App，并引导用户使用新版 Google / Apple OAuth 登录。
- `isRegister = false` 也不能隐式创建新 email OneKeyID；如果 email 未命中已有 active legacy email OneKeyID，必须按防枚举策略返回中性失败 / 业务错误，不能创建账号，也不能返回 `legacy_register_disabled` 这类会暴露“该 email 不是 legacy account”的错误码。
- API-11 当前客户端只声明 `{ success: boolean }`；该旧登录确认结果只服务旧客户端兼容期内的 legacy 登录 / 找回。新统一登录完成态应由 API-01 或 API-03 / API-04 到 API-06 后的 OAuth 归属结果建立。

---------------------------------------------------------

## API-12 🗑️ `POST /prime/v1/user/getKeylessAuthShare`

- 状态：废弃删除。
- 该 Keyless auth share OTP legacy API 已确认不属于用户迁移路径。
- 本次直接删除，不迁移、不替换、不保留兼容入口。

---------------------------------------------------------

## API-13 🗑️ `POST /prime/v1/user/createKeylessAuthShare`

- 状态：废弃删除。
- 该 Keyless auth share OTP legacy API 已确认不属于用户迁移路径。
- 本次直接删除，不迁移、不替换、不保留兼容入口。

---------------------------------------------------------

## API-14 🗑️ `POST /prime/v1/user/resetKeylessAuthShare`

- 状态：废弃删除。
- 该 Keyless auth share OTP legacy API 已确认不属于用户迁移路径。
- 本次直接删除，不迁移、不替换、不保留兼容入口。

---------------------------------------------------------

Keyless auth share OTP wrapper 和 UI 入口同步删除：

- 状态：废弃删除。
- `getAuthPackFromServerWithOTP` 和 `uploadAuthPackToServerWithOTP` 一并删除。
- 实现时如果还有残留编译引用，可以在同一删除批次中把 wrapper 改成 no-op / stub 再移除入口；不需要设计用户迁移或服务端兼容。
- 该删除不影响 OneKeyID 登录、legacy email 找回 / 合并、OAuth + PIN 的 Keyless 创建 / 恢复流程，不纳入旧版本客户端兼容周期。
- 评审边界：上述 Keyless auth share OTP legacy 代码已经确认没有用户迁移路径，不再作为 Keyless 创建 / 恢复的可靠性风险点重复报告。只有发现这些 API、wrapper 或 UI 仍可从新统一登录、OAuth + PIN Keyless 创建 / 恢复、Cloud Sync 设置等有效用户路径触发时，才按可达 bug 处理。

Keyless create / restore / verify 现有接口集合也需要协议调整，但当前方案未在本文定义具体新增 URL。实现落地时必须把实际 URL 逐个补充为二级标题，并满足以下要求：

- OneKeyID OAuth 登录、OAuth binding profile、Keyless create / restore / verify 相关接口都必须返回同一个 `oauthIdentityId = hashId`。
- 客户端必须使用 `oauthIdentityId` 写入 / 读取 `OAuthIdentityCredentialStorage`。
- 这些接口不能返回或引入 OneKeyID 到 `keylessWalletId` 的服务端归属关系；`keylessWalletId`、`socialUserIdHash` 和 Keyless wallet metadata 只属于 Keyless wallet 能力、恢复流程或诊断信息。
