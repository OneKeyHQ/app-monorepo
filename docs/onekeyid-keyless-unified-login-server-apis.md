# OneKeyID and Keyless Unified Login Server APIs

本文件从 [onekeyid-keyless-unified-login-migration.md](./onekeyid-keyless-unified-login-migration.md) 拆出，集中列出本迁移涉及的新增、调整、下线和废弃服务器接口。迁移文档中的流程章节只保留接口名称和流程引用；接口输入、响应状态、幂等和安全要求以本文为准。

标识说明：

- 🆕 新增接口。
- 🔄 修改旧接口。
- ⛔ 下线旧能力。
- 🗑️ 废弃 / 删除旧接口。

---------------------------------------------------------

## API-01 🆕 `POST /prime/v1/account/oauth/login`

接口性质：**新增接口**。它不是对旧 `POST /prime/v1/user/login` 的原地修改；旧接口仍可在兼容期内服务旧 OneKeyID 登录态刷新。新统一登录路径必须调用本接口，让服务端在同一个 upsert 入口里完成 OAuth identity 校验、OneKeyID 登录 / 创建、legacy email 自动绑定，以及必要时返回 pending merge state。

### Request

```ts
type IAccountOAuthLoginRequest = {
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
  // token 本身包含 provider identity 信息，服务端必须从 token 校验并解析 provider、
  // provider subject、verified email、email verified 状态，再生成稳定 oauthIdentityId = hashId。
  // 客户端不再单独传 provider、idToken、authorizationCode 或 refreshToken。
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
  // 如果该 token 缺失、过期、被撤销或无法校验，服务端不能把它当作 legacy 账号信号。
  legacyOneKeyIdAuthToken?: string;
};
```

### Response

服务端响应仍包在项目通用 `IApiClientResponse<T>` 内；下面只描述 `data` 字段。

```ts
type IAccountOAuthLoginResponse = {
  // 本接口固定返回同一个 response shape。
  // 这里的 status 是 2xx 成功响应内的 workflow status，不是错误码。
  // 需要给客户端继续处理的数据必须放在 response data 里；项目通用 error path
  // 只按 code / message 处理，不依赖 extra data。因此 manual_merge_required 不能放到 terminal error。
  // status = success 时，onekeySession、onekeyAccount、oauthIdentityBinding 必须有值，manualMerge 必须为 null。
  // status = manual_merge_required 时，manualMerge 必须有值，
  // onekeySession、onekeyAccount、oauthIdentityBinding 必须为 null。
  status:
    // 本次 OAuth 登录已经得到 active OneKeyID session。
    // 客户端可以写入 primePersistAtom，设置 isLoggedInOnServer = true，
    // 并把 OAuth credential 按 oauthIdentityId 写入 OAuthIdentityCredentialStorage。
    | 'success'
    // 本次 OAuth credential 合法，服务端已经产出继续合并所需的 sourceOauthHandle。
    // 这不是终止类错误，而是需要用户显式合并的下一步业务流程。
    // 客户端必须进入 pending merge state，不得写普通 OneKeyID 登录态，
    // 也不得设置 isLoggedInOnServer = true；后续继续调用 /merge/prepare、
    // /merge/verify-target、/merge/confirm。
    | 'manual_merge_required';

  // 本次提交的 OAuth token 解析出的 identity 摘要。
  // 无论 status 是 success 还是 manual_merge_required 都必须返回。
  // 客户端用 oauthIdentityId 写入 / 读取 OAuthIdentityCredentialStorage。
  oauthIdentity: {
    // 服务端为 OAuth identity 生成的稳定 ID。
    // 当前等于 Keyless 服务端根据 OAuth token / identity claims 生成的 hashId。
    // 用作本地 OAuthIdentityCredentialStorage 的唯一 key。
    // 它不是 keylessWalletId，也不是本地 wallet id。
    oauthIdentityId: string;

    // OAuth provider 类型，当前只允许 google / apple。
    provider:
      // Google OAuth identity。
      | 'google'
      // Apple OAuth identity。
      | 'apple';

    // provider 侧稳定 subject，例如 Google sub 或 Apple user id。
    // 只用于服务端 identity 去重和必要的诊断；客户端不应把它作为展示主标识。
    providerSubject?: string;

    // OAuth email 的可信类型，决定能否参与 legacy email 自动绑定和 email claim upsert。
    providerEmailType:
      // OAuth provider 返回了 verified email，且不是可识别的 Apple private relay。
      // 可以参与同 email legacy 自动绑定和 email claim 自动绑定。
      // 此状态下 providerVerifiedEmail 和 normalizedEmail 必须有值。
      | 'real'
      // provider = apple 且 verified email domain 命中服务端配置的 relay domain list，
      // 例如 privaterelay.appleid.com。
      // 当前按独立账户处理，不自动合并到真实 legacy email；
      // 如果本地有 legacy OneKeyID auth token 信号，返回 manual_merge_required。
      // 此状态下 providerVerifiedEmail 和 normalizedEmail 必须有值，但它们是 Apple relay email。
      | 'apple_private_relay'
      // provider 没有返回 verified email，或 email 未验证。
      // 可以创建 OAuth-only OneKeyID，但不能创建 email claim，也不能参与同 email 自动绑定；
      // 如果本地有 legacy OneKeyID auth token 信号，返回 manual_merge_required。
      // 只有此状态下 providerVerifiedEmail 和 normalizedEmail 才允许为空。
      | 'missing_or_unverified';

    // 服务端校验客户端提交的 Supabase access token 后，
    // 从 Supabase Auth / provider identity claims 中解析出的已验证原始 email。
    // 该字段不是客户端单独上报的 email，也不是客户端本地缓存 email。
    // 只有 provider 明确证明 email 已验证时才返回。
    // Apple private relay 也可能是 verified email，但 providerEmailType 会标记为 apple_private_relay。
    // providerEmailType = real / apple_private_relay 时必须返回该字段；
    // providerEmailType = missing_or_unverified 时必须不返回该字段。
    providerVerifiedEmail?: string;

    // 服务端基于 providerVerifiedEmail 生成的规范化 email。
    // 用于唯一索引、email claim 和同 email 自动绑定，例如大小写折叠、去除首尾空格等。
    // 它是服务端匹配 key，不是 UI 展示字段。
    // providerEmailType = real / apple_private_relay 时必须返回该字段；
    // providerEmailType = missing_or_unverified 时必须不返回该字段。
    normalizedEmail?: string;

    // 服务端基于 providerVerifiedEmail 生成的脱敏展示 email，例如 n***@gmail.com。
    // 仅用于 UI 展示，不能用于账号匹配、绑定判断或身份 proof。
    // 当 email 缺失时可以为 null；客户端只能展示 provider / identity display，
    // 不能用本地缓存 email 补充身份 proof。
    displayEmail?: string | null;

    // 命中的 Apple private relay domain，仅在 providerEmailType = apple_private_relay 时返回。
    // 用于诊断和日志，不作为客户端分支判断的唯一依据。
    relayDomainMatched?: string;
  };

  // 新 OneKeyID Supabase Auth session。
  // 仅 status = success 时有值；manual_merge_required 时必须为 null。
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
  onekeySession: {
    // OneKeyID Supabase Auth access_token。
    // 客户端访问 OneKeyID / Prime 需要登录态的接口时，现有 ServiceBase
    // 会从 Supabase SDK session 中读取当前 access_token，并写入 X-Onekey-Request-Token。
    accessToken: string;

    // OneKeyID Supabase Auth refresh_token。
    // 客户端不要自行实现 refresh 逻辑；必须交给 Supabase SDK 保存、轮换和刷新。
    // refreshToken 是敏感凭证，不能写入日志或埋点。
    refreshToken: string;
  } | null;

  // 当前登录成功后的 active OneKeyID。
  // 仅 status = success 时有值；manual_merge_required 时必须为 null。
  onekeyAccount: {
    // 当前登录成功后的 active OneKeyID。
    onekeyUserId: string;

    // OneKeyID account lifecycle status 的完整枚举。
    // 本接口只有 status = success 时才返回 onekeyAccount；
    // success payload 中实际只能返回 active。
    // 如果服务端命中 merged，必须走业务错误分支，
    // onekeySession / onekeyAccount / oauthIdentityBinding 都不能作为普通成功态返回。
    status:
      // 当前可作为登录主体的 OneKeyID。可签发普通 session，可接受写入。
      | 'active'
      // 已废弃为登录主体的 source archive。
      // 命中时返回 account_merged_reauth_required / support_required，并触发对账修复。
      | 'merged';

    // OneKeyID 账号级展示 email，必须是 masked email 或 null。
    // 服务端不再在 onekeyAccount 顶层返回 legacyEmail；
    // legacy email 可从 identities 中 identityType = legacy_email 的元素读取。
    // displayEmail 选择规则：
    // 1. 优先取 legacy_email identity 的 email；
    // 2. 如果没有 legacy_email，则按 OAuth identity 绑定时间从早到晚，
    //    取最早绑定且有 providerVerifiedEmail 的 OAuth identity；
    // 3. 服务端对选中的 email 做脱敏后返回，客户端不能用它做账号匹配 proof。
    displayEmail?: string | null;

    // 当前 OneKeyID 已绑定的 active identity 列表。
    // 它不是和顶层 oauthIdentity 完全相同的类型：
    // - identityType = legacy_email 表示旧 OneKeyID email 身份；
    // - identityType = oauth 表示 Google / Apple OAuth 身份。
    // 这里不再返回单个 identity 的 status，避免和上面的 OneKeyID account lifecycle
    // status 混淆；能出现在该列表里的 identity 都是当前账号下可用的 active identity。
    // OAuth identity 当前请求的绑定结果看 oauthIdentityBinding.bindingStatus。
    // 其中 identityType = oauth 的元素字段语义必须和顶层 oauthIdentity 保持一致；
    // 如果列表中包含本次提交的 OAuth identity，它的 oauthIdentityId / provider /
    // providerSubject / providerEmailType / providerVerifiedEmail / normalizedEmail /
    // displayEmail / relayDomainMatched 必须与顶层 oauthIdentity 对应字段一致。
    identities: Array<{
      // 身份类型。
      // - legacy_email：旧 OneKeyID email 身份。
      // - oauth：Google / Apple OAuth 身份。
      identityType: 'legacy_email' | 'oauth';

      // 仅 identityType = oauth 时返回。
      // 字段语义同顶层 oauthIdentity.oauthIdentityId。
      oauthIdentityId?: string;

      // 仅 identityType = oauth 时返回。
      // 字段语义同顶层 oauthIdentity.provider。
      provider?: 'google' | 'apple';

      // 仅 identityType = oauth 时返回。
      // 字段语义同顶层 oauthIdentity.providerSubject。
      providerSubject?: string;

      // 仅 identityType = oauth 时返回。
      // 字段语义同顶层 oauthIdentity.providerEmailType。
      providerEmailType?:
        | 'real'
        | 'apple_private_relay'
        | 'missing_or_unverified';

      // 仅 identityType = oauth 且 providerEmailType = real / apple_private_relay 时返回。
      // 字段语义同顶层 oauthIdentity.providerVerifiedEmail。
      providerVerifiedEmail?: string;

      // legacy_email / oauth 都可以返回。
      // legacy_email 时表示旧 OneKeyID email 的规范化值；
      // oauth 时字段语义同顶层 oauthIdentity.normalizedEmail。
      normalizedEmail?: string;

      // legacy_email / oauth 都可以返回。
      // legacy_email 时表示旧 OneKeyID email 的脱敏展示值；
      // oauth 时字段语义同顶层 oauthIdentity.displayEmail。
      displayEmail?: string | null;

      // 仅 identityType = oauth 且 providerEmailType = apple_private_relay 时返回。
      // 字段语义同顶层 oauthIdentity.relayDomainMatched。
      relayDomainMatched?: string;
    }>;
  } | null;

  // OAuth identity 的绑定结果。
  // 仅 status = success 时有值；manual_merge_required 时必须为 null。
  oauthIdentityBinding: {
    // OAuth identity 绑定状态完整枚举。
    // 注意：这是通用枚举全集；本登录接口的 oauthIdentityBinding 仅 status = success 时返回，
    // 所以本字段在本接口实际只能返回 bound。
    // status = manual_merge_required 时 oauthIdentityBinding 必须为 null，
    // 不能用 pending 表达；冲突 / 异常也应走 support_required 等错误或业务状态。
    bindingStatus:
      // 已绑定。当前 OAuth identity 已经有 active binding，
      // 或本次请求已经完成自动绑定 / 新建账号绑定。
      // POST /prime/v1/account/oauth/login 的 success payload 只允许返回该值。
      | 'bound'
      // 待处理。表示当前 OAuth identity 还没有完成绑定，
      // 需要用户继续 manual merge / manual OAuth bind 等流程。
      // 本登录接口不在 oauthIdentityBinding.bindingStatus 中返回该值；
      // 对应场景使用顶层 status = manual_merge_required，并把 oauthIdentityBinding 置为 null。
      // 客户端本地缓存 IOAuthIdentityBindingLocalInfo 可以用该值表示中间态。
      | 'pending'
      // 冲突。表示当前 OAuth identity 与本地预期账号不一致，
      // 或服务端发现不能自动选择 target 的绑定 / 合并冲突。
      // 本登录接口不在 oauthIdentityBinding.bindingStatus 中返回该值；
      // 服务端应返回 support_required / 其他明确业务错误，客户端本地缓存可用该值驱动 UI。
      | 'conflict';

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
    bindReason:
      | 'existing_oauth_binding'
      | 'legacy_email_auto_bind'
      | 'email_claim_auto_bind'
      | 'new_oauth_account_created';
  } | null;

  // 手动合并上下文。
  // 仅 status = manual_merge_required 时有值；success 时必须为 null。
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
  manualMerge: {
    // 显式合并 source 类型完整枚举。
    // 注意：这是合并流程里的 source type 枚举全集；
    // 本登录接口返回 manualMerge 时，实际只允许 pending_oauth_bind。
    // 不要把 sourceType 当作登录接口 status；登录接口的状态是 manual_merge_required。
    sourceType:
      // pending OAuth 绑定。服务端还没有创建 OAuth source OneKeyID，
      // source 只是当前已验证 OAuth identity。
      // POST /prime/v1/account/oauth/login 的 manualMerge.sourceType 只会返回该值。
      // 后续 /merge/prepare、/merge/verify-target、/merge/confirm 继续使用该 source type；
      // /merge/confirm 成功后落库的 relationType 也使用同名值。
      | 'pending_oauth_bind'
      // 已存在 OAuth source OneKeyID。用户已经用 OAuth 创建并登录了新的 OneKeyID，
      // 后续从 Merge existing OneKeyID 入口主动合并到 legacy OneKeyID。
      // 该值不会从 POST /prime/v1/account/oauth/login 的 manualMerge.sourceType 返回；
      // 它只用于已登录 OAuth OneKeyID 发起的 merge API source path，
      // /merge/confirm 成功后落库的 relationType 记录为 merged_source。
      | 'merged_source';

    // 加密签名短期 token，客户端只当作 opaque string 保存和回传。
    // token 内容至少包含 oauthIdentityId、provider、providerSubject、normalizedEmail?、iat、exp。
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
  } | null;
};

type IAccountOAuthLoginTerminalErrorCode =
  // 终止类错误码：本次 /account/oauth/login 不能继续产出可用 session，
  // 也不能产出可继续执行的 manualMerge 前置态。
  // 客户端不能按 IAccountOAuthLoginResponse 解析 data。
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
  // OAuth token 无效、过期、provider 不匹配或无法验证。
  // 客户端处理：
  // - 清理本次 OAuth 登录过程中产生的临时 credential / OneKeyID session 状态。
  // - 报错并回到登录界面，让用户手动重新发起 Google / Apple 登录。
  // - 客户端不能自动使用当前 token 重试本接口。
  | 'oauth_credential_invalid';
```

终止类错误通过业务错误码返回，不作为 `IAccountOAuthLoginResponse.status` 返回：

- 具体错误码含义见上面的 `IAccountOAuthLoginTerminalErrorCode` 注释。
- `manual_merge_required` 不属于这里的终止类错误；它是 2xx workflow status，因为客户端需要从 response data 读取 `manualMerge.sourceOauthHandle` / `reason` / `expiresAt` 后继续合并流程，不能依赖 error path 的 extra data。

### Examples

API-01 示例已拆分到 [api-01-onekeyid-keyless-unified-login-server-oauth-login-examples.md](./api-01-onekeyid-keyless-unified-login-server-oauth-login-examples.md)。

---------------------------------------------------------

## API-02 🆕 `GET /prime/v1/account/profile`

接口性质：**新增接口**。用于读取当前 OneKeyID session 对应的 profile 聚合信息

### Request

```ts
type IAccountProfileRequestHeaders = {
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
type IAccountProfileResponse = {
  // 当前 session 对应的 active OneKeyID。
  // 结构与 POST /prime/v1/account/oauth/login 的 onekeyAccount 保持一致。
  // 如果 session 指向 merged source，不能返回 profile；
  // 必须返回 account_merged_reauth_required / 401，让客户端清理本地 session 并重新登录。
  onekeyAccount: {
    // 当前 session 绑定的 active OneKeyID。
    onekeyUserId: string;

    // profile 只能返回 active。
    // merged source 不是可登录主体，不能作为 profile 成功态返回。
    status: 'active';

    // OneKeyID 账号级展示 email，必须是 masked email 或 null。
    // 服务端不在 onekeyAccount 顶层返回 legacyEmail；
    // legacy email 可从 identities 中 identityType = legacy_email 的元素读取。
    // displayEmail 选择规则：
    // 1. 优先取 legacy_email identity 的 email；
    // 2. 如果没有 legacy_email，则按 OAuth identity 绑定时间从早到晚，
    //    取最早绑定且有 providerVerifiedEmail 的 OAuth identity；
    // 3. 服务端对选中的 email 做脱敏后返回，客户端不能用它做账号匹配 proof。
    displayEmail?: string | null;

    // 当前 OneKeyID 已绑定的 active identity 列表。
    // 字段语义与 POST /prime/v1/account/oauth/login 的 onekeyAccount.identities 完全一致。
    // legacy email 作为 identityType = legacy_email 的元素返回；
    // Google / Apple OAuth 作为 identityType = oauth 的元素返回。
    // 服务端不返回 currentOAuthIdentityOwner / currentOAuthIdentityBindingStatus 这类 current 字段。
    // 客户端若需要判断当前设备 Keyless 流程使用的 OAuth identity 是否归属当前 OneKeyID，
    // 直接用当前 credential 的 oauthIdentityId 匹配 identities 中的 identityType = oauth 元素。
    identities: Array<{
      // 身份类型。
      // - legacy_email：旧 OneKeyID email 身份。
      // - oauth：Google / Apple OAuth 身份。
      identityType: 'legacy_email' | 'oauth';

      // 仅 identityType = oauth 时返回。
      // 字段语义同 POST /prime/v1/account/oauth/login 的 oauthIdentity.oauthIdentityId。
      oauthIdentityId?: string;

      // 仅 identityType = oauth 时返回。
      provider?: 'google' | 'apple';

      // 仅 identityType = oauth 时返回。
      // provider 侧稳定 subject，例如 Google sub 或 Apple user id。
      providerSubject?: string;

      // 仅 identityType = oauth 时返回。
      // 决定该 OAuth email 是否可参与同 email 自动绑定。
      providerEmailType?:
        | 'real'
        | 'apple_private_relay'
        | 'missing_or_unverified';

      // 仅 identityType = oauth 且 providerEmailType = real / apple_private_relay 时返回。
      // 该字段来自服务端校验 provider identity claims 后解析出的 verified email。
      providerVerifiedEmail?: string;

      // legacy_email / oauth 都可以返回。
      // legacy_email 时表示旧 OneKeyID email 的规范化值；
      // oauth 时表示 providerVerifiedEmail 的规范化值。
      normalizedEmail?: string;

      // legacy_email / oauth 都可以返回。
      // 必须是 masked email 或 null，只用于 UI 展示，不能作为账号匹配 proof。
      displayEmail?: string | null;

      // 仅 identityType = oauth 且 providerEmailType = apple_private_relay 时返回。
      relayDomainMatched?: string;
    }>;
  };
};
```

---------------------------------------------------------

## API-03 🆕 `POST /prime/v1/account/identities/oauth/bind`

接口性质：**新增接口**。用于当前已经登录的 legacy email OneKeyID 用户，在 Account Security / Login methods 之类的主动入口里，把一个新的 Google / Apple OAuth identity 绑定为当前 legacy OneKeyID 的登录方式。

这个接口**绑定的是 OAuth 登录方式，不是绑定 legacy email**。target 必须是当前 session 对应的 legacy email OneKeyID。legacy email 只作为老账号已有的 proof 参与：当本次要添加的 OAuth identity 不能同 email 静默绑定时，legacy email OTP 用来证明用户确实控制这个老账号。

它解决的问题是：老 Email + OTP 用户主动给当前 legacy OneKeyID 增加一个新的 Google / Apple 登录方式，避免后续继续依赖 legacy Email + OTP。target OneKeyID 一律来自 `X-Onekey-Request-Token` 对应的当前 session，不能由 request body 指定。

它不参与普通登录流程，也不是 API-01 `manual_merge_required` 的后续接口。API-01 已经负责登录时的 OAuth identity 校验、自动绑定、创建 OneKeyID 和 pending merge 判断；API-03 只处理“用户已经有一个明确的当前 OneKeyID session，现在想把另一个 OAuth identity 绑定到这个当前账号”的主动绑定场景。

典型使用场景：

- 主场景：当前 session 是 legacy email OneKeyID，用户主动点击 `Add Google` / `Add Apple`，把 Google / Apple OAuth identity 加成这个老 OneKeyID 的新登录方式。
- 迁移场景：当前 session 是 legacy email OneKeyID，用户在 Keyless create / restore / upgrade 前，需要先把当前 Google / Apple OAuth identity 归属到这个老 OneKeyID。
- 幂等场景：当前 OAuth identity 已经绑定到当前 OneKeyID，服务端幂等返回成功。

不是本接口处理的场景：

- 不创建、绑定或恢复 legacy email identity；legacy email 只作为老账号已有的 proof。
- 不给 OAuth-only OneKeyID 提供显式入口去添加另一个 Google / Apple OAuth provider；即使另一个 provider 返回相同 verified email，也不走 API-03。
- 不处理未登录用户的 Google / Apple 普通登录；该场景走 API-01。
- 不处理 OAuth 新账号合并到 legacy 账号的显式合并流程；该场景走 API-04 到 API-06，最终由 API-06 `/merge/confirm` 改写 OAuth binding。
- 不处理“某个 OAuth identity 已经绑定到 OneKeyID A，现在要转移到 legacy email OneKeyID B”的场景。API-03 必须返回 `oauth_identity_bound_to_another_account`，不能直接转移；该场景属于显式账号合并，最终由 API-06 执行 binding retarget。

绑定规则：

- 当前 OneKeyID 必须有 `legacy_email` identity。同 email 静默绑定；跨 email、Apple private relay 或无 verified email 时，才允许返回 `legacy_email_otp_required`，要求用户验证当前 legacy email。
- 当前 OneKeyID 没有 `legacy_email` identity（OAuth-only 账号）时，本接口不提供绑定能力。客户端不应该展示入口；服务端如果收到请求，返回终止类错误 `oauth_bind_requires_legacy_email`。
- 如果当前 OAuth identity 已经绑定到另一个 active OneKeyID，本接口不能转移 binding，必须返回 `oauth_identity_bound_to_another_account`，提示客户端走显式账号合并或支持流程。

本接口不写入本地 Keyless wallet 关系，也不建立 OneKeyID 到 `keylessWalletId` 的服务端归属关系。

### Request

```ts
type IAccountOAuthBindRequestHeaders = {
  // 当前 OneKeyID Supabase session 的 access_token。
  // 这是 API-03 的接口认证和 target OneKeyID proof，用来让服务端确定
  // “把当前 OAuth identity 绑定到哪个已登录 OneKeyID”。
  // 如果当前已登录账号是 legacy OneKeyID，这里就是该 legacy OneKeyID
  // Supabase session 的当前 accessToken。
  // 它不是 API-01 里的 legacyOneKeyIdAuthToken 防分叉信号。
  // API-03 不需要在 POST body 里额外提交 legacyOneKeyIdAuthToken；
  // target 只能来自这个已认证 session，不能由 body 指定。
  // 和现有 Prime 登录态接口保持一致，通过 header 传递当前 accessToken。
  // 读代码入口：
  // - packages/kit-bg/src/services/ServiceBase.ts
  //   - getOneKeyIdClient() 会从 simpleDb.prime.getAuthToken() 读取 token，
  //     并写入 header X-Onekey-Request-Token。
  // 这里不能传 refreshToken，也不能把 legacyOneKeyIdAuthToken 放到 body 里替代该 header。
  // accessToken 缺失、过期、被撤销或无法校验时返回 401。
  // 如果该 token 对应 merged source，返回 account_merged_reauth_required / 401。
  'X-Onekey-Request-Token': string;
};

type IAccountOAuthBindRequest = {
  // 当前要绑定的 OAuth Supabase access token。
  // 入参风格与 API-01 和现有 Keyless backend share 接口保持一致，只提交 token。
  // 服务端必须从 token 校验并解析 provider、provider subject、
  // verified email、email verified 状态，再生成稳定 oauthIdentityId = hashId。
  // 客户端不单独传 provider、idToken、authorizationCode 或 refreshToken。
  token: string;

  // OTP 验证确认参数。
  // 首次调用本接口时不传该字段；服务端能静默绑定则直接 success，
  // 不能静默绑定、且当前 OneKeyID 有 legacy_email identity 可验证时，
  // 返回 legacy_email_otp_required。
  // 客户端随后调用 API-09 /prime/v1/general/emailOTP 发送 OTP，
  // 再把 oauthBindVerificationHandle + otpUuid + otpCode 回传到本接口完成确认。
  confirmation?: {
    // API-03 返回 legacy_email_otp_required 时签发的短期加密签名 token。
    // 客户端只当作 opaque string 保存和回传。
    // token 内容至少包含 oauthIdentityId、provider、providerSubject、normalizedEmail?、
    // targetOneKeyUserId、target legacy email、iat、exp。
    oauthBindVerificationHandle: string;

    // API-09 /prime/v1/general/emailOTP 返回的 uuid。
    otpUuid: string;

    // 用户输入的 legacy Email OTP。
    otpCode: string;
  };
};
```

### Response

服务端响应仍包在项目通用 `IApiClientResponse<T>` 内；下面只描述 `data` 字段。

```ts
type IAccountOAuthBindResponse = {
  // 本接口固定返回同一个 response shape。
  // 这里的 status 是 2xx 成功响应内的 workflow status，不是错误码。
  // status = success 时，oauthIdentityBinding 必须有值，oauthBindVerification 必须为 null。
  // status = legacy_email_otp_required 时，oauthBindVerification 必须有值，
  // oauthIdentityBinding 必须为 null；服务端不能创建 OAuth binding 或 email claim。
  status:
    // 当前 OAuth identity 已经绑定到当前 OneKeyID。
    // 可能是命中既有绑定、同 email 静默绑定，或 confirmation 验证通过后的绑定。
    | 'success'
    // 当前 OAuth credential 合法，但不能静默绑定到当前 OneKeyID。
    // 该状态只允许在当前 OneKeyID 有 legacy_email identity 时返回。
    // 客户端必须通过 API-09 发送 legacy Email OTP，
    // 再用 confirmation 回调本接口完成绑定。
    // 这不是“让客户端去调用另一个手动绑定接口”，而是本接口的 OTP 验证阶段。
    | 'legacy_email_otp_required';

  // 本次提交的 OAuth token 解析出的 identity 摘要。
  // 无论 status 是 success 还是 legacy_email_otp_required 都必须返回。
  // 字段语义与 API-01 的 oauthIdentity 完全一致。
  oauthIdentity: {
    // 服务端为 OAuth identity 生成的稳定 ID。
    // 当前等于 Keyless 服务端根据 OAuth token / identity claims 生成的 hashId。
    oauthIdentityId: string;

    // OAuth provider 类型，当前只允许 google / apple。
    provider: 'google' | 'apple';

    // provider 侧稳定 subject，例如 Google sub 或 Apple user id。
    providerSubject?: string;

    // OAuth email 的可信类型。
    providerEmailType:
      | 'real'
      | 'apple_private_relay'
      | 'missing_or_unverified';

    // provider 明确证明已验证时才返回。
    providerVerifiedEmail?: string;

    // 服务端基于 providerVerifiedEmail 生成的规范化 email。
    normalizedEmail?: string;

    // 脱敏展示 email，仅用于 UI 展示。
    displayEmail?: string | null;

    // 仅 providerEmailType = apple_private_relay 时返回。
    relayDomainMatched?: string;
  };

  // 当前 session 对应的 active OneKeyID。
  // 2xx response 中始终返回，因为本接口必须由已登录 OneKeyID session 调用。
  // status = success 时，identities 必须包含本次绑定成功的 OAuth identity。
  // status = legacy_email_otp_required 时，identities 不包含本次待确认的 OAuth identity。
  onekeyAccount: {
    // 当前 session 绑定的 active OneKeyID。
    onekeyUserId: string;

    // 本接口只能对 active OneKeyID 执行。
    // merged source 必须走 account_merged_reauth_required / 401。
    status: 'active';

    // OneKeyID 账号级展示 email，必须是 masked email 或 null。
    // 服务端不在 onekeyAccount 顶层返回 legacyEmail；
    // legacy email 可从 identities 中 identityType = legacy_email 的元素读取。
    // displayEmail 选择规则同 API-01。
    displayEmail?: string | null;

    // 当前 OneKeyID 已绑定的 active identity 列表。
    // 字段语义与 API-01 的 onekeyAccount.identities 完全一致。
    identities: Array<{
      identityType: 'legacy_email' | 'oauth';
      oauthIdentityId?: string;
      provider?: 'google' | 'apple';
      providerSubject?: string;
      providerEmailType?:
        | 'real'
        | 'apple_private_relay'
        | 'missing_or_unverified';
      providerVerifiedEmail?: string;
      normalizedEmail?: string;
      displayEmail?: string | null;
      relayDomainMatched?: string;
    }>;
  };

  // OAuth identity 的绑定结果。
  // 仅 status = success 时有值；legacy_email_otp_required 时必须为 null。
  oauthIdentityBinding: {
    // OAuth identity 绑定状态完整枚举。
    // 注意：这是通用枚举全集；本接口的 oauthIdentityBinding 仅 status = success 时返回，
    // 所以本字段在本接口实际只能返回 bound。
    // status = legacy_email_otp_required 时 oauthIdentityBinding 必须为 null。
    bindingStatus:
      // 已绑定。当前 OAuth identity 已经绑定到当前 OneKeyID。
      // API-03 success payload 只允许返回该值。
      | 'bound'
      // 待处理。表示当前 OAuth identity 还没有完成绑定，
      // 需要用户继续 OTP 验证流程。
      // API-03 不在 oauthIdentityBinding.bindingStatus 中返回该值；
      // 对应场景使用顶层 status = legacy_email_otp_required，并把 oauthIdentityBinding 置为 null。
      | 'pending'
      // 冲突。表示当前 OAuth identity 与当前 OneKeyID 不能直接绑定，
      // 例如已绑定到另一个 active OneKeyID，或 email claim owner 不是当前 OneKeyID。
      // API-03 不在 oauthIdentityBinding.bindingStatus 中返回该值；
      // 服务端应返回明确错误码，例如 oauth_identity_bound_to_another_account
      // 或 oauth_email_claim_conflict。
      | 'conflict';

    // 本次 OAuth identity 最终绑定到的 OneKeyID。
    // 必须等于 onekeyAccount.onekeyUserId。
    boundOneKeyUserId: string;

    // 绑定来源：
    // - existing_oauth_binding：OAuth identity 已经绑定到当前 OneKeyID，本次幂等返回成功。
    // - legacy_email_auto_bind：OAuth verified email 命中当前 OneKeyID 的 legacy_email identity。
    // - legacy_email_otp_confirmed：confirmation 中 legacy Email OTP 验证通过后绑定。
    bindReason:
      | 'existing_oauth_binding'
      | 'legacy_email_auto_bind'
      | 'legacy_email_otp_confirmed';
  } | null;

  // OAuth 绑定 OTP 验证上下文。
  // 仅 status = legacy_email_otp_required 时有值；success 时必须为 null。
  oauthBindVerification: {
    // 短期加密签名 token，客户端只当作 opaque string 保存和回传。
    // 后续通过 API-09 发送 OTP 时，作为 otpPurposeToken 传入；
    // 回调本接口 confirmation 时，作为 oauthBindVerificationHandle 传回。
    oauthBindVerificationHandle: string;

    // 需要完成的验证类型枚举列表。
    // 完整枚举当前只有 legacy_email_otp，后续如果增加其他 proof，
    // 只能在这里扩展明确枚举值。
    requiredVerification: Array<
      // 验证当前 session 对应 legacy OneKeyID 的 legacy email OTP。
      | 'legacy_email_otp'
    >;

    // API-09 发码时必须使用的 scene。
    // scene 名称沿用 ManualOAuthBind，表示“OAuth 绑定需要人工验证 legacy email OTP”。
    otpScene: 'ManualOAuthBind';

    // 当前 session 对应的 target OneKeyID。
    targetOneKeyUserId: string;

    // target legacy email 的脱敏展示值。
    // 只用于 UI 展示和提示发码目标，不能作为账号匹配 proof。
    targetDisplayEmail: string;

    // 当前 OAuth identity 的脱敏展示值；没有 verified email 时可以为 null。
    oauthDisplayEmail?: string | null;

    // 需要 OTP 验证的原因：
    // - oauth_email_mismatch：OAuth verified email 与当前 legacy OneKeyID email 不一致。
    // - apple_private_relay：Apple private relay 不能静默绑定到真实 legacy email。
    // - missing_or_unverified_email：OAuth credential 没有可用于静默绑定的 verified email。
    reason:
      | 'oauth_email_mismatch'
      | 'apple_private_relay'
      | 'missing_or_unverified_email';

    // oauthBindVerificationHandle 的过期时间，ISO 8601 字符串。
    // 过期后客户端必须重新发起 API-03 首次绑定请求。
    expiresAt: string;
  } | null;
};

type IAccountOAuthBindTerminalErrorCode =
  // 当前 OneKeyID session 缺失、过期、撤销或无法校验。
  // 客户端处理：清理本地 OneKeyID session / primePersistAtom，回到登录界面。
  | 'onekey_session_invalid'
  // 当前 session 对应的 OneKeyID 已是 merged source。
  // 客户端处理同 API-01：清理本地 session，报错并回到登录界面，让用户手动重新登录。
  | 'account_merged_reauth_required'
  // OAuth token 无效、过期、provider 不匹配或无法验证。
  // 客户端处理：清理本次 OAuth 临时 credential，报错并让用户手动重新发起 OAuth。
  | 'oauth_credential_invalid'
  // 当前 OAuth identity 已绑定到另一个 active OneKeyID。
  // API-03 不能把它强行绑定或转移到当前 OneKeyID。
  // 如果用户要把 OAuth identity 从 OneKeyID A 转移到 legacy OneKeyID B，
  // 必须走 API-04 / API-05 / API-06 的显式账号合并流程，最终由 API-06 改写 binding。
  | 'oauth_identity_bound_to_another_account'
  // 当前 OAuth verified email 的 active email claim owner 不是当前 OneKeyID。
  // 服务端不能覆盖该 claim；客户端应进入显式账号合并或客服流程。
  | 'oauth_email_claim_conflict'
  // 当前 OneKeyID 没有 legacy_email identity。
  // API-03 只服务 legacy email OneKeyID 添加 OAuth 登录方式；
  // OAuth-only OneKeyID 不提供显式入口绑定另一个 OAuth provider。
  | 'oauth_bind_requires_legacy_email'
  // confirmation 提交的 oauthBindVerificationHandle 过期、被篡改或与当前 session / OAuth identity 不匹配。
  // 客户端清理本地 manual bind state，由用户重新触发绑定流程；不要自动循环重试。
  | 'oauth_bind_verification_expired'
  // 历史数据存在无法自动判定的问题，例如 OAuth binding / email claim 唯一性异常。
  // 客户端展示客服 / 风控处理入口。
  | 'support_required';
```

终止类错误通过业务错误码返回，不作为 `IAccountOAuthBindResponse.status` 返回：

- 具体错误码含义见上面的 `IAccountOAuthBindTerminalErrorCode` 注释。
- `legacy_email_otp_required` 不属于终止类错误；它是 2xx workflow status，因为客户端需要从 response data 读取 `oauthBindVerification.oauthBindVerificationHandle` / `otpScene` / `requiredVerification` 后继续发码和确认流程。

### Examples

API-03 示例已拆分到 [api-03-onekeyid-keyless-unified-login-server-oauth-bind-examples.md](./api-03-onekeyid-keyless-unified-login-server-oauth-bind-examples.md)。

---------------------------------------------------------

## API-04 🆕 `POST /prime/v1/account/merge/prepare`

- 用于显式账号合并前的预检查。
- 支持两类 source path：当前已登录 OAuth OneKeyID session，或 `manual_merge_required` 返回的 `sourceOauthHandle`。
- 输入 source proof（session 或 `sourceOauthHandle`）、目标 legacy email。
- 服务端验签 `sourceOauthHandle`（如果传入），按 source + target legacy email 做节流和防枚举预检查后，只返回中性的 `otpScene = 'MergeExistingOneKeyId'`、`otpPurposeToken`、masked target email 和 `expiresAt`。**不发送 OTP，不持久化 merge request**。
- 客户端拿到 `otpPurposeToken` 后，调用独立 `POST /prime/v1/general/emailOTP`，传 `scene = 'MergeExistingOneKeyId'`、`otpPurposeToken` 发送 legacy Email OTP，并保存返回的 `uuid`。
- 在 legacy Email OTP 完成前，不能返回 target 是否存在、target `onekeyUserId` 或 OAuth identity 摘要，避免账号枚举。

---------------------------------------------------------

## API-05 🆕 `POST /prime/v1/account/merge/verify-target`

- 用于用户输入 legacy Email OTP 后确认 target legacy OneKeyID。
- 输入 source proof（session 或 `sourceOauthHandle`）、目标 legacy email、`otpPurposeToken`、`otpUuid` 和 legacy Email OTP。
- OTP 通过后，服务端生成新的 `mergeRequestId`，返回 target 账号摘要、当前 OAuth identity 可展示摘要、OAuth identity 归属状态、非 secret 的 `mergeRequestId`，以及加密签名的 `finalConfirmHandle`（含 `mergeRequestId`、target onekeyUserId、target legacy email / normalized email、iat、exp ≈ 5min）。`verify-target` 阶段仍不持久化 pending merge；返回的 OAuth identity 摘要只用于本次确认展示，客户端确认页必须展示当前将随 `/merge/confirm` 提交的 OAuth identity。最终实际合并哪个 source 由 `/merge/confirm` 提交并验证通过的当前 OAuth credential 决定。
- 客户端可以在本次 confirm 执行期临时持有 `mergeRequestId` 作为幂等 key；`mergeRequestId` 本身不是 secret，也不是授权凭证，不能作为用户恢复登录路径。真正执行仍必须依赖未过期且验签通过的 `finalConfirmHandle` 和 source proof。
- 任何基于 `mergeRequestId` 的执行期状态返回，都必须先校验 source proof、target session，或客服 / 风控 scoped auth；校验失败统一返回 404 / not found，不暴露 record 是否存在或状态。
- 如果来自 `sourceOauthHandle` 路径，摘要中应明确“不会迁移 source OneKeyID 数据，因为还没有创建 source OneKeyID；确认后只把 confirm 时提交的 OAuth identity 绑定到 target legacy OneKeyID”。

---------------------------------------------------------

## API-06 🆕 `POST /prime/v1/account/merge/confirm`

- 用于用户确认后的账号合并执行。
- 如果某个 OAuth identity 已经绑定到 OneKeyID A，现在要转移到 legacy email OneKeyID B，最终就是本接口执行：把 source A 标记为 `merged`，并把 source OAuth binding retarget 到 target B。
- 输入 `mergeRequestId`、`finalConfirmHandle` 和 source proof：如果 source 是当前 OAuth 新建 OneKeyID，提交当前 OneKeyID session 和当前 OAuth credential；如果来自 `sourceOauthHandle` 路径，提交当前 OAuth credential。
- 服务端按 `mergeRequestId` 幂等执行：先查询 execution record；若已存在 record，无论状态是 `processing`、`merged`、`failed` 还是 `support_required`，都必须先校验 source proof、target session 或客服 / 风控 scoped auth；source proof 中的 OAuth credential 必须解析为该 record 已落库的 canonical source。校验失败统一返回 404 / not found，不暴露 record 是否存在或状态。校验通过后，按 record 当前状态返回结果，不要求 `finalConfirmHandle` 仍未过期。若不存在 execution record，则必须验签且确认 `finalConfirmHandle` 未过期，并校验 handle 内的 `mergeRequestId` 与输入一致 → 重新校验当前 OAuth credential / OneKeyID session（防止 token 已撤销或 session 失效）并把本次提交的 OAuth identity 作为 canonical source → 创建或锁定 `IOneKeyAccountMergeRelation` execution record（初始 `status = 'processing'`）→ 在主事务中执行合并、OAuth binding retarget / 绑定和必要的 active email claim upsert / 迁移 → 成功后更新为 `merged`。如果用户在 confirm 时提交的是另一个合法 OAuth identity，服务端合并的是 confirm 时提交的这个 identity，而不是 `verify-target` 展示摘要里的旧 identity。
- 除了 `mergeRequestId` 唯一约束，`/merge/confirm` 还必须按 canonical source 建立 source-level execution lock。canonical source key 为 `provider + providerSubject`（`pending_oauth_bind`）或 `sourceOneKeyUserId`（已存在 source OneKeyID）。若同一 source 已有未完成 `processing` relation，授权通过后直接拒绝本次新请求并返回 `source_merge_in_progress`，不创建第二条执行记录，也不尝试合并到另一个 target。若同一 `mergeRequestId` 重试命中已有 record，则按该 record 当前状态返回。
- 如果执行失败或需要客服介入，必须在主合并事务外或独立审计事务中把 execution record 更新为 `failed` / `support_required`，保留结构化失败记录。不能只依赖接口日志。
- 同一个 `mergeRequestId` 的短期执行期重试：授权通过后，若状态已是 `merged`，直接返回成功和 target OneKeyID；若状态是未超时的 `processing`，返回 `processing` / `retry_later`，不重复执行；若状态是 `failed` 或 `support_required`，返回对应状态和处理指引，不重复执行。
- 如果客户端没有收到 confirm 响应，或后续遇到 source session 失效 / `account_merged_reauth_required`，客户端不要依赖 `mergeRequestId` 找回登录态。必须清理本地 OneKeyID token / `primePersistAtom`，报错并回到登录界面，让用户手动重新发起 Google / Apple 登录；客户端不能自动重试。用户手动登录后，如果合并已完成，服务端根据 OAuth binding 当前归属直接签发 target session；如果合并未完成，则按当前 OAuth binding / merge 状态重新返回对应流程。
- 如果 `finalConfirmHandle` 已过期且还没有 execution record，不能开始新的合并执行；服务端返回 `merge_confirm_expired`，客户端必须重新走 `/merge/verify-target` 获取新的 `mergeRequestId` 和 `finalConfirmHandle`。
- 如果 `processing` 已超时，服务端必须先做状态对账（OAuth binding 是否已指向 target、source `status`、target merge relation、identity retarget 子表）。确认已经完成则更新为 `merged` 并返回成功；确认尚未执行才允许重新锁定并继续执行；无法判断时更新为 `support_required`，不能盲目重复处理。
- 如果 source 是当前 OAuth 新建 OneKeyID，默认把 source OAuth binding 改写到 legacy OneKeyID；合并成功后，source OneKeyID 标记为 merged，后续登录 source OAuth identity 直接命中 target binding 并返回 target OneKeyID。记录 `relationType = 'merged_source'`。source OneKeyID 下的业务数据不迁移到 target。
- 如果是 `pending_oauth_bind`，不创建 source OneKeyID，确认后直接把 confirm 时提交的 OAuth identity 绑定到 target legacy OneKeyID；如果该 OAuth identity 有 verified email，还要在同一事务内为该 OAuth email 创建或迁移 active email claim 到 target。记录 `relationType = 'pending_oauth_bind'`，`sourceOneKeyUserId` 为空。

---------------------------------------------------------

## API-07 🆕 `GET /prime/v1/account/merge/history`

- 返回当前 OneKeyID 下的已合并 source 账号列表。
- 用于低曝光的只读查看入口，例如 Account Security / Advanced / Merged accounts。

---------------------------------------------------------

## API-08 🆕 `GET /prime/v1/account/merge/source/:sourceOneKeyId`

- 只读查看某个已合并 source 账号的摘要和 OAuth identity 处理状态。
- 返回 source provider / masked email、合并时间、OAuth identity 归属状态。
- 必须校验当前 session 的 OneKeyID 是该 source 的 target OneKeyID，或当前请求持有客服 / 风控 scoped auth；否则返回 404 / not found，不暴露 source 是否存在、是否 merged、target 是谁或任何 masked identity 信息。
- 对 source id 查询必须做限频和审计日志，避免把 merged source 只读接口变成账号枚举入口。

---------------------------------------------------------

## API-09 🔄 `POST /prime/v1/general/emailOTP`

- 复用现有独立发码接口。
- 现有代码已经把发送 Email OTP 做成独立接口：客户端先调用该接口拿到 `uuid`，再在业务确认接口提交 `uuid + code`。本迁移继续沿用这个模型，不能让 `/merge/prepare`、`/merge/verify-target` 或 OAuth bind 接口承担发码副作用。
- 请求保留 `scene`，并扩展可选的 `otpPurposeToken`。`otpPurposeToken` 是服务端签发的短期不透明 token，用于把本次 OTP 绑定到具体业务目的，例如 `MergeExistingOneKeyId` 或 `ManualOAuthBind`。
- 新增 OTP scene：`MergeExistingOneKeyId` 用于显式合并 target legacy email 验证；`ManualOAuthBind` 用于已登录 legacy OneKeyID 主动绑定跨 email、Apple private relay 或无 verified email OAuth identity。
- `MergeExistingOneKeyId` 场景必须要求 `otpPurposeToken`，由 `/merge/prepare` 签发；发码接口验签后按 token 内的 target legacy email 发码或返回中性结果，不能通过错误码、文案或时序泄露 target 是否存在。
- `ManualOAuthBind` 场景必须要求 `otpPurposeToken = oauthBindVerificationHandle`；该 handle 来自 API-03 `legacy_email_otp_required` 响应里的 `oauthBindVerification.oauthBindVerificationHandle`。发码接口验签后只向 handle 绑定的 target legacy email 发码，避免普通账户 OTP 被复用到 OAuth 绑定确认。

---------------------------------------------------------

## API-10 🔄 `GET /api/prime/send-email-verification-code`

- 当前旧 Email + OTP 登录 / 注册流程使用的发码接口。
- 迁移后只允许用于已有 legacy email OneKeyID 的找回、查看、合并或低曝光登录入口。
- 不作为普通主登录入口的发码接口，不支持探测或创建新 email 账户。
- 必须保持防枚举：无论 email 是否存在，前端展示中性文案；服务端错误码、发送节流和响应时间不能暴露账号是否存在。

---------------------------------------------------------

## API-11 ⛔ `POST /api/prime/login`

- 当前旧 Email + OTP 登录 / 注册流程使用的确认接口。
- `isRegister = false` 的 legacy email 登录 / 找回能力保留给已有 active legacy email OneKeyID。
- `isRegister = true` 或任何新 email 创建 OneKeyID 的请求一律拒绝并返回 `legacy_register_disabled`。
- 下线注册能力不依赖客户端版本 gating；登录 / 找回能力在 Phase 5 之前继续兼容老客户端。
- 不作为普通主登录入口，不创建新 email 账户。

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

- 状态：如仍属于 Keyless auth share legacy 能力，应随 auth share OTP legacy 路径一并评估删除或隔离。
- 该接口当前不是 OneKeyID / Keyless 统一登录迁移的用户路径。
- 如果保留为开发或客服工具，必须确保它不会从新统一登录、OAuth + PIN Keyless 创建 / 恢复、Cloud Sync 设置等有效用户路径触发。

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
