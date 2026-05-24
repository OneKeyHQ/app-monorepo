# OneKeyID and Keyless Unified Login Migration Plan

## 背景

后续账户系统需要合并 OneKeyID 与 Keyless。产品期望的登录方式是：

- 统一使用 Keyless 的 Google、Apple 登录。
- 不再提供 Email + OTP 作为普通登录入口。
- 用户通过 Google、Apple 登录后，同时也是 OneKeyID 账户。

本方案的核心原则是：**OneKeyID 作为唯一用户身份，Keyless 作为 OneKeyID 下的登录、钱包恢复和密钥恢复能力**。不把两套密钥材料硬合并，不迁移 mnemonic、private key、Shamir share 到 OneKeyID 服务端。

## 当前系统边界

- OneKeyID 登录态由 `primePersistAtom` 承载，核心字段包括 `onekeyUserId`、`email`、`displayEmail`、`keylessWalletId`。
- Keyless wallet 在本地 DB 中通过 `isKeyless`、`keylessDetailsInfo` 标识。正常情况下本地只有一个当前 Keyless wallet。
- Cloud Sync 已经有双模式：`ECloudSyncMode.OnekeyId` 和 `ECloudSyncMode.Keyless`。
- 当前代码已有从 OneKeyID sync 切换到 Keyless sync 的基础流程，例如 `enableKeylessCloudSyncWithMigrationIfNeeded()` 和 `convertSyncItemsForModeSwitch()`。

## 目标模型

统一后的账户模型：

- `onekeyUserId` 是唯一主账号 ID。
- Google / Apple OAuth identity 是 OneKeyID 的登录凭证。
- `legacyEmail` 只是老 OneKeyID 用户的历史 email 字段，每个 OneKeyID 最多保留一个。新用户不能新增 email 绑定，未来也不扩展多 email 绑定。
- 一个 OneKeyID 可以绑定多个 Google OAuth identity，也可以绑定多个 Apple OAuth identity。
- Keyless wallet 是 OneKeyID 下的钱包能力。Keyless 绑定使用当前 OAuth credential，不使用 `socialUserIdHash` 或 `keylessOwnerId` 做 OneKeyID 归属判断。
- Keyless wallet id 继续保持现有格式，例如 `hd-keyless-*`，不重建、不改名、不迁移资产账户关系。
- 用户前台只感知一个账户体系：OneKey Account。

不再保留的产品形态：

- 不再展示 Email + OTP 作为默认 / 主登录入口。
- 不再让用户感知“登录 OneKeyID”和“登录 Keyless”是两套账户。
- 不再把 Email + OTP 当作默认 / 普通登录方式。Email 只作为老账号找回、迁移、跨 email 显式合并校验，以及同 email OAuth identity 自动合并的匹配字段。

## 新登录流程

1. 用户点击 `Continue with Google` 或 `Continue with Apple`。
2. 客户端走现有 Keyless / Supabase social login，拿到 `accessToken`、`refreshToken` 和 `supabaseUser`。
3. 客户端调用 OneKeyID 登录桥，例如 `serviceOneKeyID.loginWithAccessToken()`，底层进入 `servicePrime.apiLogin()`。
4. 服务端根据 OAuth identity 执行 OneKeyID upsert：
   - OAuth identity 已有关联：返回原 `onekeyUserId`。
   - OAuth identity 未关联，且 OAuth provider 没有返回 verified email：不创建 OneKeyID，返回 `oauth_email_unverified` / `oauth_email_missing`，引导用户重新授权、切换 Google / Apple 账号或联系客服。
   - OAuth identity 未关联，但 verified email 命中 legacy OneKeyID 的 `legacyEmail`：服务端校验 OAuth credential 后静默绑定到该 legacy OneKeyID，不要求 Email OTP。不同 provider、不同 `socialUserIdHash` 或多个 Keyless / OAuth 账户同 email 不构成冲突。
   - OAuth identity 未关联，且没有命中 legacy OneKeyID，但 verified email 命中唯一已有 OAuth identity 所属的 OneKeyID：静默绑定到该 OneKeyID。
   - OAuth identity 未关联、email 无法自动合并，但本地已有 legacy OneKeyID 登录态或 legacy 登录凭证：不要直接创建新的 OneKeyID，先引导用户进入跨 email 手动升级 / 显式合并流程。
   - OAuth identity 未关联、verified email 没有命中可自动合并的 OneKeyID，且本地没有 legacy OneKeyID 登录态或 legacy 登录凭证：创建新的 OneKeyID。
5. 如果服务端返回 `manual_merge_required`，客户端进入 pending merge state，不把本次 OAuth 登录写成普通 OneKeyID 登录态，也不设置 `isLoggedInOnServer = true`。此时还没有创建 OAuth source OneKeyID；服务端只返回加密签名短期 token `sourceOauthHandle`（不持久化 pending 状态）和可展示的 masked OAuth 信息。客户端缓存本次 OAuth credential 与 `sourceOauthHandle`，用户完成 legacy Email OTP 后，服务端把当前 OAuth identity 直接绑定到 target legacy OneKeyID，再刷新 `primePersistAtom`。
6. 如果服务端返回正常 OneKeyID session，客户端刷新 `primePersistAtom`，用户即处于 OneKeyID 登录态。
7. 登录流程到此结束，不创建、不恢复、不绑定 Keyless wallet，也不要求用户输入 Keyless PIN。
8. 后续用户主动进入 Keyless 创建、恢复、重置 PIN 或验证场景时，客户端自动读取当前已登录的 OAuth credential，直接进入 Keyless PIN / wallet verification 环节，不重复拉起 Google / Apple 登录。只有本地 credential 失效或缺失时，才重新要求 Google / Apple 登录。

## 服务端迁移方案

### OneKeyID 数据结构目标

服务端 OneKeyID 只保留一个主账号 ID，并把不同登录凭证挂在这个主账号下：

```ts
type IOneKeyAccount = {
  onekeyUserId: string;
  legacyEmail?: string; // 老用户历史 email，每个 OneKeyID 最多一个。新用户为空。
  googleIdentities: IOneKeyAccountOAuthBinding[];
  appleIdentities: IOneKeyAccountOAuthBinding[];
  status: 'active' | 'merged' | 'support_locked'; // 合并后 source 标记为 merged；运营/客服锁定为 support_locked
  mergedToOneKeyUserId?: string;                   // status='merged' 时必填，指向 target OneKeyID
  mergedAt?: string;                               // status='merged' 时必填
  createdAt: string;
  updatedAt: string;
};
```

约束：

- `legacyEmail` 只服务于老用户迁移，不作为新用户可新增的 email 绑定能力。
- 新用户通过 Google / Apple 创建 OneKeyID 时，不创建 `legacyEmail`。
- 一个 OneKeyID 可以绑定多个 Google identity 和多个 Apple identity。
- 当前 OAuth identity 尚未归属任何 OneKeyID 时，Google 与 Apple 只要返回相同 verified `normalizedEmail`，就自动合并到同一个 OneKeyID，不需要用户显式绑定。
- 多个 Keyless / OAuth 账户只要能拿到同一个 verified email，就可以指向同一个 legacy OneKeyID。
- 同一个 OAuth identity 只能绑定到一个 OneKeyID。`(provider, providerSubject)` 必须全局唯一，不能同时归属多个 OneKeyID。
- 自动绑定只允许 verified `normalizedEmail` 严格相同；不同 email 不能进入自动流程。
- 服务端任何按 `onekeyUserId` 的写入操作必须先检查 `status='active'`；命中 `status='merged'` 时跟随 `mergedToOneKeyUserId` 到 target。
- 合并成功落地必须在同一事务内：source 的 `status` 改为 `merged` 且 `mergedToOneKeyUserId` / `mergedAt` 同步落库；source 的 OAuth identity 迁移到 target；`IOneKeyAccountMergeRelation` 写入对应记录。三者一致性由事务保证。
- `IOneKeyAccount.status` 与 `IOneKeyAccountMergeRelation` 信息冗余但**前者是热路径权威源**；merge_relation 仅作审计用途，不在登录 / 写入热路径里 lookup。

### OAuth identity 绑定规则

一个 OneKeyID 允许绑定多个 OAuth identity，例如同一 email 下的多个 Google identity 和多个 Apple identity。当前 OAuth identity 未归属任何 OneKeyID 时，Google 与 Apple 同 verified email 自动合并，不要求用户显式绑定。自动绑定只使用 `normalizedEmail` 严格相同匹配，不关心 provider 是否不同，也不关心 Keyless 本地的 `socialUserIdHash` 是否不同。

`normalizedEmail` 只做基础规范化，例如 trim 和 lowercase。除此之外不做 provider-specific 推断。

本文里的 OneKeyID `email scope` 指该 OneKeyID 的 `legacyEmail` 和所有已绑定 OAuth identity 的 verified `normalizedEmail` 集合。自动绑定优先命中 legacy OneKeyID 的 `legacyEmail`；没有 legacy 命中时，才用 OAuth identity email scope 查找唯一 OneKeyID。

Apple 可能返回用户真实邮箱，也可能返回 private relay 邮箱。当前没有可依赖的 OAuth 字段标识 private relay，服务端按邮箱域名后缀识别。默认 relay domain 为 `privaterelay.appleid.com`，但不要硬编码在业务逻辑里，应放到服务端配置表或远程配置中，方便 Apple 后续调整域名时快速更新。

判断规则：

- 仅当 `provider = apple` 且 normalized email domain 命中服务端配置的 relay domain list 时，判定为 Apple private relay。
- 初始配置：`['privaterelay.appleid.com']`。
- 未命中 relay domain list 的 Apple verified email 按真实邮箱处理，继续参与同 email 自动绑定。

Apple private relay email 当前按独立账户处理，不尝试把它和用户真实 legacy email 做自动合并；若本地已有 legacy 信号，则仍优先返回 `manual_merge_required`，避免直接创建分叉账号。后续通过通用显式账号合并流程处理。该流程有固定低曝光入口：Account Security / Advanced / Need help? 下的 `Merge existing OneKeyID`。如果 Apple 返回的是可识别的真实 verified email，则仍然走同 email 自动绑定逻辑。

建议独立维护 OAuth identity 绑定表：

```ts
type IOneKeyAccountOAuthBinding = {
  onekeyUserId: string;
  provider: 'google' | 'apple';
  providerSubject: string;
  verifiedEmail: string;
  normalizedEmail: string;
  emailType: 'real' | 'apple_private_relay';
  relayDomainMatched?: string;
  createdAt: string;
  updatedAt: string;
};
```

数据库约束：

- `UNIQUE(provider, providerSubject)`，保证同一个 Google / Apple identity 不能绑定到多个 OneKeyID。
- 可以允许同一个 `onekeyUserId` 下存在多个不同的 Google / Apple identity。
- 不建议用 OAuth binding 的 `normalizedEmail` 做全局唯一约束；它只用于自动合并匹配。同一个 email 可以出现在同一个 OneKeyID 的多个 Google / Apple identity 上。
- Apple private relay 的判断结果必须落库到 `emailType` 和 `relayDomainMatched`，方便后续解释为什么没有按真实 legacy email 自动合并。
- OAuth upsert 必须在服务端事务内完成。对 `(provider, providerSubject)` 和同 email 自动合并路径做幂等保护，避免 Google / Apple 同邮箱并发首次登录时各自创建 OneKeyID。
- 创建新 OneKeyID 前要重新检查 OAuth binding 和 email scope 归属；如果事务中发现已被其他请求创建或绑定，应返回已有 OneKeyID，不再创建第二个。

登录 upsert 规则：

1. 先按 `(provider, providerSubject)` 查询 OAuth binding，命中则返回已绑定的 `onekeyUserId`。
2. 未命中时，要求 OAuth email 是 verified 状态。若 provider 没有返回 email，或 email 不是 verified 状态，则返回 `oauth_email_missing` / `oauth_email_unverified`，不允许创建新 OneKeyID，也不参与同 email 自动合并。Apple 第二次登录默认不返回 email（Apple 在首次授权后不再下发 email claim）；命中规则 1 已有 OAuth binding 时正常返回，否则客户端必须给出明确指引："去 iOS 设置 → Apple ID → 使用此 Apple ID 的 App → OneKey → 停止使用此 Apple ID，再重新登录"，让 Apple 重新下发 email。服务端**不缓存** Apple email 用于补偿，依靠 Apple 重新授权流程恢复。
3. 如果是 Apple private relay email，当前按独立账户处理：不匹配用户真实 legacy email，不做自动合并。但它仍要继续执行本地 legacy 信号检查；如果客户端声明本地存在 legacy OneKeyID 登录态或 legacy 登录凭证，仍返回 `manual_merge_required`，避免直接创建分叉账号。
4. 其他 verified email，包括 Apple 返回的真实邮箱，优先用 `normalizedEmail` 查找 legacy OneKeyID 的 `legacyEmail`。命中则服务端校验 OAuth credential 合法后，静默把当前 OAuth identity 绑定到该 legacy OneKeyID，不要求 Email OTP。
5. 如果没有命中 legacy OneKeyID，再用 `normalizedEmail` 查找已有 OAuth binding。若只命中一个 OneKeyID，则静默绑定到该 OneKeyID；若命中多个 OneKeyID，视为历史数据完整性异常，不能自动绑定或新建账号，返回 `support_required`。
6. 若同 email 没有命中 OneKeyID，但客户端声明本地存在 legacy OneKeyID 登录态或 legacy 登录凭证，则返回 `manual_merge_required`，不要创建新的 OneKeyID。这里的客户端声明只作为防止账户分叉的引导信号，不作为身份凭证，也不授予任何 legacy 账户权限。服务端**不持久化任何 pending merge 状态**，只签发短期加密签名 token `sourceOauthHandle`（含 provider、providerSubject、verified normalizedEmail、iat、exp ≈ 15min），随响应返回。客户端缓存本次 OAuth credential 与 `sourceOauthHandle`，用于后续 `/merge/prepare`、`/merge/verify-target`、`/merge/confirm` 三段流程；状态完全由签名 token 在三个请求间传递。
7. 只有既没有 OAuth binding、没有同 email 可自动合并 OneKeyID、也没有本地 legacy 登录态或 legacy 登录凭证时，才创建新的 OneKeyID。新建账号不写入 `legacyEmail`。

Upsert 必须先尝试已有关联和同 email legacy email 自动合并；Apple private relay email 例外，当前按独立账户处理。如果 Apple 返回真实 verified email，则仍然参与同 email legacy email 自动合并。如果不存在 legacy OneKeyID，再尝试同 email OAuth binding 自动合并。如果本地已经有 legacy 登录态或 legacy 登录凭证，跨 email 场景必须优先进入手动升级 / 显式合并，不能直接创建新 OneKeyID。最终合并必须同时校验当前 OAuth credential 和 legacy Email OTP；客户端本地信号不能替代这两个 proof。

### 新增统一绑定关系

如果服务端需要记录 OneKeyID 与 Keyless wallet 的绑定状态，建议只记录绑定到哪个 OneKeyID 和哪个 OAuth identity。`socialUserIdHash`、`keylessOwnerId` 不作为 OneKeyID 绑定凭证。

```ts
type IOneKeyAccountKeylessBinding = {
  onekeyUserId: string;
  keylessWalletId: string;
  oauthProvider: 'google' | 'apple';
  oauthProviderSubject: string;
  migrationStatus: 'pending' | 'bound' | 'conflict' | 'failed';
  createdAt: string;
  updatedAt: string;
};
```

### 账号合并关系记录

如果执行显式账号合并完成，服务端必须记录 source / target 的关系，方便后续排查、客服、审计和回滚。**只在合并成功落地时创建记录**；`manual_merge_required` 阶段不写 pending 记录，状态靠加密签名 token 在 `/merge/prepare` → `/merge/verify-target` → `/merge/confirm` 三次请求间传递。

接受的妥协：用户尝试合并但取消 / 失败的过程不入审计库；如需追溯失败尝试，依赖各接口的请求日志或 OTP 服务自身的节流记录。

```ts
type IOneKeyAccountMergeRelation = {
  mergeRequestId: string;
  sourceOneKeyUserId?: string;       // pending_oauth_bind 类型时为空（source 是 OAuth identity，无 source OneKeyID）
  targetOneKeyUserId: string;        // 合并完成后必填
  relationType:
    | 'pending_oauth_bind'            // source 是 OAuth identity（无 source OneKeyID），attach 到 target
    | 'merged_alias'                  // source OneKeyID 合并为 target 的 alias，登录走 redirect
    | 'redirected_source';            // 已废弃登录主体的 source OneKeyID 指向 target
  status:
    | 'merged'                        // 合并已完成
    | 'failed'                        // 合并执行失败（部分回滚的留痕记录）
    | 'support_required';             // 合并中遇到无法自动判定的项，进入客服流程
  reason:
    | 'oauth_email_mismatch'
    | 'apple_private_relay'
    | 'local_legacy_session'
    | 'user_requested_merge'
    | 'support_created';
  sourceOauthProvider?: 'google' | 'apple';        // 触发合并的主 source identity（来自 sourceOauthHandle 或 source OneKeyID 上当前登录的 identity）
  sourceOauthProviderSubject?: string;              // 同上
  sourceVerifiedEmail?: string;                     // 同上
  // 完整迁移的 source identity 集合见子表 IOneKeyAccountMergeIdentityMigration
  targetLegacyEmail: string;        // 合并完成后必填（当前实现下 target 永远是 legacy email OneKeyID）
  verificationMethods: Array<'source_oauth' | 'legacy_email_otp'>;
  dataStatus: {
    oauthIdentity?: 'migrated' | 'linked_readonly' | 'failed';
    keylessWallet?: 'migrated' | 'linked_readonly' | 'failed';
    primeOrder?: 'migrated' | 'linked_readonly' | 'user_choice_required' | 'support_required';
    referral?: 'migrated' | 'linked_readonly' | 'user_choice_required' | 'support_required';
    cloudSync?: 'none' | 'client_merge_required' | 'user_choice_required' | 'merged' | 'failed';
  };
  createdAt: string;                  // 即 mergedAt，记录只在合并完成时创建
};
```

source 可能持有多个 OAuth identity，合并时全部迁移到 target。`IOneKeyAccountMergeRelation` 主表只记录"触发合并的主 source identity"，所有迁移的 source identity 详情落子表：

```ts
type IOneKeyAccountMergeIdentityMigration = {
  mergeRequestId: string;             // FK → IOneKeyAccountMergeRelation.mergeRequestId
  oauthProvider: 'google' | 'apple';
  oauthProviderSubject: string;
  verifiedEmail: string;
  emailType: 'real' | 'apple_private_relay';
  migratedAt: string;
};
```

子表索引建议：

- `(mergeRequestId)`：按合并请求反查迁移了哪些 identity。
- `(oauthProvider, oauthProviderSubject)`：按 identity 反查合并历史（与 `IOneKeyAccountOAuthBinding` 表交叉验证）。

记录规则：

- 记录**只在 `/merge/confirm` 成功完成时**写入；`manual_merge_required` 阶段不产生记录。
- `sourceOneKeyUserId` 是 OAuth 新建或疑似分叉的 source OneKeyID；当 `relationType = 'pending_oauth_bind'` 时为空（source 是 OAuth identity 而非 OneKeyID）。
- `targetOneKeyUserId` 是 legacy email OneKeyID，合并完成后必填。
- `pending_oauth_bind`：source 是 OAuth identity，合并仅把该 identity attach 到 target legacy OneKeyID，不涉及 source 数据迁移。
- `merged_alias` / `redirected_source`：source OneKeyID 合并为 target 的 alias / redirect，已有数据按 `dataStatus` 字段标注迁移结果。
- 后续客服、风控、订单、Referral、Cloud Sync 排查必须能通过任一 OneKeyID 查到关联的 source / target。
- 不允许只靠日志追踪分叉关系，必须有结构化数据库记录。

### 新增或调整 API

建议新增统一账户 API：

- `POST /prime/v1/account/oauth/login`
  - 输入 Google / Apple OAuth token。
  - 完成 OneKeyID login / register / legacy bind。
  - 正常登录时返回 OneKeyID user info、auth token、Keyless binding status。
  - 如果返回 `manual_merge_required`，只返回加密签名短期 token `sourceOauthHandle`（含 provider/providerSubject/normalizedEmail/iat/exp ≈ 15min）和 masked OAuth provider/email，不返回 OneKeyID auth token，不设置普通登录态。服务端**不**持久化任何 pending 状态。
  - 如果 OAuth identity 未绑定且 provider 没有返回 verified email，返回 `oauth_email_missing` / `oauth_email_unverified`，不创建新 OneKeyID。

- `GET /prime/v1/account/profile`
  - 返回 OneKeyID 基础信息、Prime 状态、Keyless 绑定状态、Cloud Sync 模式。

- `POST /prime/v1/account/keyless/bind`
  - 输入 OneKeyID session、Keyless OAuth credential。
  - 绑定本地 Keyless wallet 与 OneKeyID。
  - 服务端必须校验 OAuth credential 合法性。
  - 如果 OAuth verified `normalizedEmail` 与目标 OneKeyID 的 email scope 相同，则静默绑定，不要求 Email OTP。
  - 如果 OAuth email 与当前已登录 legacy OneKeyID 的 `legacyEmail` 不同，则必须走 `manualCrossEmailKeylessUpgrade`，额外输入 legacy OneKeyID Email OTP。
  - `manualCrossEmailKeylessUpgrade` 仅用于已登录 legacy OneKeyID 用户主动升级 Keyless 登录场景。

- `POST /prime/v1/account/keyless/migration/done`
  - Cloud Sync 迁移完成后标记服务端状态。

- `POST /prime/v1/account/merge/prepare`
  - 用于显式账号合并前的预检查。
  - 支持两类 source：当前已登录 OAuth OneKeyID session，或 `manual_merge_required` 返回的 `sourceOauthHandle`。
  - 输入 source proof（session 或 `sourceOauthHandle`）、目标 legacy email。
  - 服务端验签 `sourceOauthHandle`（如果传入），按 source + target legacy email 节流后发送 legacy Email OTP。**不持久化 merge request**，OTP 服务自身的短期存储与 merge 解耦。
  - 在 legacy Email OTP 完成前，不能返回 target 是否存在、target `onekeyUserId`、订单、权益或 Cloud Sync 摘要，避免账号枚举。

- `POST /prime/v1/account/merge/verify-target`
  - 用于用户输入 legacy Email OTP 后确认 target legacy OneKeyID。
  - 输入 source proof（session 或 `sourceOauthHandle`）、目标 legacy email、legacy Email OTP。
  - OTP 通过后，服务端返回 source / target 账号摘要、可合并项、冲突项、数据处理状态，以及加密签名的 `finalConfirmHandle`（含 source identity、target onekeyUserId、iat、exp ≈ 5min）。
  - 如果 source 是 `sourceOauthHandle` 类型，摘要中应明确“不会迁移 source OneKeyID 数据，因为还没有创建 source OneKeyID；确认后只把 OAuth identity 绑定到 target legacy OneKeyID”。

- `POST /prime/v1/account/merge/confirm`
  - 用于用户确认后的账号合并执行。
  - 输入当前登录 OneKeyID session 或当前 OAuth credential、`finalConfirmHandle`。
  - 服务端事务内：验签 `finalConfirmHandle` → 重新校验 OAuth credential / OneKeyID session（防止 token 已撤销或 session 失效）→ 执行合并 → 落 `IOneKeyAccountMergeRelation`（`status = 'merged'`）。
  - 如果 source 是当前 OAuth 新建 OneKeyID，默认把 source OneKeyID 合并到 legacy OneKeyID；合并成功后，source OneKeyID 标记为 merged / redirected，后续登录 source OAuth identity 返回 target OneKeyID。记录 `relationType = 'merged_alias'` 或 `'redirected_source'`。
  - 如果 source 是 `sourceOauthHandle` 类型，不创建 source OneKeyID，确认后直接把当前 OAuth identity 绑定到 target legacy OneKeyID。记录 `relationType = 'pending_oauth_bind'`，`sourceOneKeyUserId` 为空。

- `GET /prime/v1/account/merge/history`
  - 返回当前 OneKeyID 下的已合并 source 账号列表。
  - 用于低曝光的只读查看入口，例如 Account Security / Advanced / Merged accounts。

- `GET /prime/v1/account/merge/source/:sourceOneKeyId`
  - 只读查看某个已合并 source 账号的摘要和数据处理状态。
  - 返回 source provider / masked email、合并时间、数据分类状态：已迁移、已关联只读、待用户处理、需客服处理。

以下 Keyless auth share OTP legacy 代码不迁移、不替换，后续直接删除：

- `getAuthPackFromServerWithOTP`
- `uploadAuthPackToServerWithOTP`
- 相关 Email OTP auth share API 调用与 UI 入口

### Email + OTP 下线策略

- 主登录入口是 Google / Apple OAuth。
- Email OTP 只提供给已经存在 legacy email OneKeyID 的用户登录 / 找回 / 查看。
- 用户不能用新的 email 走 Email OTP 登录或注册。
- 新用户不允许通过 Email + OTP 创建 OneKeyID。
- 旧用户普通登录入口不展示 Email + OTP。
- 必须保留 legacy email 登录入口，但仅限旧用户找回 / 查看 / 合并使用，防止 OAuth 合并故障后用户无法找回原 legacy email OneKeyID。
- legacy email 登录入口不支持创建新 email 账户；如果 email 不存在 legacy OneKeyID，不能注册。
- legacy email 找回接口必须防止账号枚举。无论 email 是否存在，前端展示中性文案，例如“如果该邮箱有关联账户，我们会发送验证码或后续指引”；服务端错误码、发送节流和响应时间不要暴露账号是否存在。
- legacy email 登录成功后**完全等同于普通 OneKeyID 登录态**，不做额外功能限制：可查看 / 操作原 OneKeyID 下所有数据（订单 / Prime / Referral / Cloud Sync / Keyless 绑定）、可修改账户安全设置、可使用钱包能力。仅在 UI 入口上限制：legacy email 不作为新主登录入口，不引导创建新 Email 账号。
- 如果用户要合并到当前 OAuth 新账号，必须先拉起 Google / Apple OAuth 获取当前 OAuth credential，再用 legacy Email OTP 完成合并确认。仅 legacy Email OTP 不能单独完成跨 email 合并。
- 入口必须低曝光，例如 Account Security / Need help? / Sign in legacy OneKeyID，不放在默认登录页主按钮区。
- 后端需要区分普通 OAuth 登录、legacy email 找回、迁移 / 合并场景，避免旧接口被继续当作主登录入口。
- **服务端 Email + OTP 注册接口立即下线**：无论客户端版本，新 email 创建 OneKeyID 的请求一律拒绝，返回明确错误码 `legacy_register_disabled`。老版本客户端的注册按钮调接口会失败，文案引导用户使用 Google / Apple 登录；登录 / 找回接口继续保留服务，老客户端的 legacy email 登录路径不受影响。
- 该接口下线**不**依赖客户端版本 gating（避免 User-Agent 伪造）；登录 / 找回接口在 Phase 5 之前都保持兼容老客户端。

## 客户端迁移方案

### 登录入口

`useOneKeyAuth.loginOneKeyId()` 需要从 Email dialog 改为 Google / Apple provider selector：

- 移除普通路径里的 `PrimeLoginEmailDialogV2`。
- `EmailOTPDialog` 不再用于普通登录，只保留给已有 legacy email OneKeyID 的登录 / 找回 / 查看 / 合并、跨 email 合并 OTP 校验。
- 提供低曝光入口 `Sign in legacy OneKeyID`，仅允许已有 `legacyEmail` 的旧用户进入；不支持新 email 注册。
- Google / Apple 登录成功后，统一调用 OneKeyID login bridge。
- 登录完成后刷新 `primePersistAtom`，并缓存后续 Keyless 场景可复用的 OAuth credential。
- 如果服务端返回 `manual_merge_required`，客户端不能把这次 OAuth 登录当作新账号登录完成；必须进入 pending merge state，展示跨 email 手动升级或显式账号合并入口，避免自动创建新 OneKeyID 导致账户分叉。
- 登录流程不触发 Keyless PIN，也不主动执行 Keyless create / restore / bind。

### Keyless create / restore 与绑定触发

Keyless wallet 采用 lazy create。OneKeyID 登录成功后不自动创建 Keyless wallet；只有用户进入需要 Keyless wallet 的场景时，才创建、恢复或绑定。

Keyless 不在登录场景中触发。绑定到 OneKeyID 与 Keyless wallet 的创建 / 恢复 / 验证是两类流程：

1. 绑定 Keyless 到 OneKeyID：读取当前已登录 OAuth credential，服务端校验 credential 合法性；不要求 Keyless PIN。
2. 同 email 绑定静默完成，不要求 Email OTP。
3. 只有跨 email 绑定到当前已登录 legacy OneKeyID 时，才要求 legacy OneKeyID Email OTP。
4. 创建、恢复、重置 PIN 或验证 Keyless wallet：读取当前已登录 OAuth credential，然后进入 Keyless PIN / wallet proof 环节。
5. 如果 credential 失效或缺失，再要求用户重新走 Google / Apple 登录。
6. 绑定成功后，本地记录绑定状态，例如：

```ts
type IKeylessAccountBindingLocalInfo = {
  onekeyUserId: string;
  bindingStatus: 'bound' | 'pending' | 'conflict';
};
```

存储位置：该结构由 **jotai persistAtom**（AsyncStorage 持久化）保存，**不落本地 DB（Realm / IndexedDB）**，因此不涉及 `LOCAL_DB_VERSION` bump，也不需要修改 Realm / IndexedDB schema。绑定状态权威源始终是服务端 `IOneKeyAccountKeylessBinding`；本地 persistAtom 仅作为加速冷启动渲染的缓存。本地缓存丢失（用户清数据、重装、AsyncStorage 损坏）时客户端通过 `GET /prime/v1/account/profile` 重新拉取并回填，不影响功能可用性；首次启动 atom 未 hydrate 完成期间，账户页 Keyless 状态可能短暂处于 loading，可接受。

### 本地已有 Keyless session 的升级处理

这里的“本地已有 Keyless session”指本地已经存在 Keyless wallet，并且可以从本地安全存储读取或刷新出 Keyless OAuth credential。它不等同于 OneKeyID 已登录，也不代表登录流程需要弹 Keyless PIN。

本地 Keyless wallet 正常情况下只有一个，因此不需要用 `socialUserIdHash` 或 `keylessOwnerId` 做“候选 Keyless wallet”选择。绑定 OneKeyID 时使用的是当前 Keyless OAuth credential：

- `socialUserIdHash`、`keylessOwnerId` 可以继续作为 Keyless wallet 内部状态、恢复流程或诊断信息。
- 它们不参与 OneKeyID 自动合并判断。
- 它们也不是 Keyless 绑定到 OneKeyID 的认证材料。
- 服务端必须校验 Keyless OAuth credential 合法性；只有跨 email 绑定到当前已登录 legacy OneKeyID 时，才额外要求 legacy OneKeyID Email OTP。
- Keyless PIN 不参与绑定。

如果 legacy OneKeyID 已经登录：

1. 保留当前 legacy OneKeyID 登录态，作为本次迁移的目标 OneKeyID。
2. 如果本地 Keyless OAuth credential 的 verified `normalizedEmail` 命中当前 OneKeyID 的 email scope，则服务端校验 OAuth credential 后静默绑定，不要求 Email OTP。
3. 如果 email 不同，不做 OAuth identity 到当前 OneKeyID 的自动绑定，也不静默创建新的 OneKeyID。保留当前 legacy OneKeyID 登录态，并引导用户进入手动跨 email Keyless 绑定 / 显式合并流程。
4. 如果用户主动选择“将当前 OneKeyID 升级为 Keyless 登录”，可以进入手动跨 email Keyless 绑定流程。该流程只服务于当前已登录 legacy OneKeyID，不扩展为通用跨 email 账户合并。
5. 不在登录或启动流程中弹 Keyless PIN。Keyless 绑定只在用户进入账户升级或 Keyless 相关场景时触发；同 email 静默绑定，跨 email 才使用 Keyless OAuth credential + legacy OneKeyID Email OTP。
6. 这里的 email 判断只用于 OneKeyID OAuth identity 归属判定，不用于 Keyless wallet PIN 校验；Keyless wallet 创建、恢复、重置 PIN 或验证仍走 OAuth credential + PIN。

如果 legacy OneKeyID 未登录：

1. 如果本地 Keyless OAuth credential 可用，客户端可以用该 credential 静默调用 OneKeyID login / upsert，建立 OneKeyID 登录态，不重复拉起 Google / Apple。
2. 如果本地 Keyless OAuth credential 不可用或刷新失败，保持未登录状态，等待用户主动走 Google / Apple 登录。
3. OneKeyID 登录态建立后，仍不立即触发 Keyless PIN。后续绑定 Keyless 到 OneKeyID 时，同 email 静默绑定，跨 email 手动升级才要求 legacy OneKeyID Email OTP；后续创建、恢复或验证 Keyless wallet 时，才进入 PIN。
4. 如果本地 Keyless OAuth credential 对应的 provider / subject 与当前 OneKeyID 登录 identity 不一致，本地 Keyless wallet 保持未绑定状态，并在 Keyless 场景中提示账号不匹配。**钱包列表不展示该 wallet**：UI 严格按"当前 OneKeyID 绑定的 Keyless wallet"过滤，不属于当前 OneKeyID 的 Keyless wallet 完全隐藏；用户切回原 OneKeyID 才能看到。本地 Keyless wallet 数据本身仍保留在 secure storage 中，**不删除**，避免切换登录态导致资产无法找回。

### 手动跨 email Keyless 升级例外

自动绑定仍然只允许 verified `normalizedEmail` 命中目标 OneKeyID 的 email scope。同 email 绑定静默完成，不要求 Email OTP。唯一需要 Email OTP 的例外是：用户已经登录 legacy OneKeyID，并且明确要把当前 OneKeyID 升级为 Keyless 登录，但可用的 Keyless OAuth email 与 legacy OneKeyID email 不同。

该例外必须同时满足：

1. 目标 OneKeyID 必须是当前设备上已经登录的 legacy OneKeyID，不能由服务端自动挑选。
2. 用户必须从账户安全或升级入口主动发起，不能在登录、启动或后台同步中静默触发。
3. UI 必须同时展示当前 OneKeyID email 和将绑定的 Keyless OAuth email，并要求用户明确确认。
4. 服务端必须校验 Keyless OAuth credential 合法性。
5. 用户必须完成 legacy OneKeyID Email OTP；绑定本身不要求 Keyless PIN。
6. 该 Keyless OAuth identity 如果已经绑定到另一个有实际数据的 OneKeyID，则不能自动迁移，需要进入显式账号合并或人工处理。
7. 如果该 Keyless OAuth credential 的 verified email 已经归属于另一个非 merged OneKeyID 的 OAuth email scope，也不能直接跨 email 绑定到当前 legacy OneKeyID；必须先进入显式账号合并或客服流程，避免同一 OAuth email 分裂到多个 OneKeyID。
8. 绑定完成后，当前 legacy OneKeyID 保持为主账号，Prime、Referral、订单和 Cloud Sync 归属不因为 Keyless email 不同而自动迁移到其他 OneKeyID。

该例外只用于“已登录 legacy OneKeyID 升级 Keyless 登录”这一条路径。其他跨 email 合并诉求仍然不进入自动流程。

### OAuth 新建账户后的显式合并

场景：用户曾经注册过 legacy email OneKeyID，但在全新客户端使用 Google / Apple OAuth 登录。由于 OAuth email 与 legacy email 不同，或者 Apple private relay 被按独立账户处理，系统创建了新的 OneKeyID。之后用户想起自己还有 legacy email 账户，希望把两个 OneKeyID 合并成一个。

这个场景不进入自动合并，只能走用户主动发起的显式账号合并流程。显式处理分两种模式：

1. `pending_oauth_bind`：OAuth upsert 时因为本地 legacy 登录态 / 登录凭证返回 `manual_merge_required`，服务端还没有创建 OAuth source OneKeyID。用户完成 legacy Email OTP 后，直接把当前 OAuth identity 绑定到 target legacy OneKeyID，不产生需要迁移数据的 source 账号。
2. `merge_existing_source`：用户已经用 OAuth 创建并登录了新的 OneKeyID，之后从低曝光入口主动合并 legacy OneKeyID。此时 source OneKeyID 已存在，需要按数据分类迁移、只读关联或进入客服处理。

触发时机和入口：

- 默认不提示，不因为“当前是 OAuth 新账号”就展示合并提醒，否则会影响正常新用户。
- 提供一个低曝光手动入口，给有需要的老用户自助处理。统一入口为 Account Security / Advanced / Need help? 下的 `Merge existing OneKeyID`，也可以在账户页 `More` / `Advanced` 中露出同一个入口；不放在首页、登录完成页或主按钮区。
- Apple private relay、Google 不同邮箱、Apple 真实邮箱但不同于 legacy email 等 OAuth 新建账户后的分叉场景，都复用这个通用入口，不单独设计 Apple private relay 专属入口。
- 只有出现强信号时才展示轻提示，例如：
  - 本地有 legacy OneKeyID 登录态、历史登录凭证或历史 `onekeyUserId` 记录。
  - 本地有 OneKeyID sync 历史、Prime / 订单 / Referral 本地缓存、或旧版 Email + OTP 登录痕迹。
  - 客服发起或恢复 merge request。
- 用户访问 Prime、订单、Cloud Sync、Referral 恢复等强账号资产场景时，只在用户主动表示要找回旧账户、找不到权益或恢复失败后展示提示。
- 提示必须低干扰：不使用全屏弹窗，不阻断当前流程；可关闭；关闭后按账号和设备限频，例如 30 天内不再主动提示。
- 不在普通 Google / Apple 登录成功页强制要求合并，避免阻断新用户；但如果本地已有 legacy 登录态或 legacy 登录凭证，应优先返回 `manual_merge_required` 并引导合并，避免账户分叉。真正执行合并时仍必须同时校验当前 OAuth credential 和 legacy Email OTP。

流程：

1. source 可以是当前已登录 OAuth 新 OneKeyID，也可以是 `manual_merge_required` 产生的 `sourceOauthHandle`（加密签名短期 token，不需要服务端持久化）。
2. 用户从账户页低曝光入口、账户安全二级入口、受限轻提示或客服链接进入“合并已有 OneKeyID”；如果来自 `manual_merge_required`，客户端带上 `sourceOauthHandle` 与缓存的 OAuth credential。
3. 用户输入 legacy email，服务端只返回中性结果并发送 legacy Email OTP；在 OTP 通过前不暴露 target 是否存在或 target 数据摘要。
4. 用户完成 legacy OneKeyID Email OTP，确认用户控制 target legacy OneKeyID。
5. 服务端校验当前 Google / Apple OAuth credential，确认用户控制 source OAuth identity；如果 source 是已登录 OAuth OneKeyID，同时确认当前 session 仍有效。
6. UI 展示合并摘要，包括 source / target email、Prime、订单、Referral、Cloud Sync、Keyless wallet、Cloud Sync 数据状态。若 source 是 `sourceOauthHandle`，摘要明确说明本次没有 source OneKeyID 数据迁移，只会把 OAuth identity 绑定到 legacy OneKeyID。
7. 用户确认后执行合并 / 绑定。默认 target 是 legacy email OneKeyID；若 source OneKeyID 已存在，则 source 是 OAuth 新 OneKeyID；若 source 是 `sourceOauthHandle`，不创建 source OneKeyID。

受控合并原则：

- 用户不是在两个账户里二选一，也不是丢弃其中一个账户的数据。
- 跨 email 显式合并的校验条件固定为当前 Google / Apple OAuth credential + legacy OneKeyID Email OTP，不要求 Keyless PIN，也不额外要求其他登录方式。
- 默认策略是优先合并到 legacy email OneKeyID。source OAuth 新建 OneKeyID 已存在时，不再作为主账号使用，标记为 merged / redirected；source 尚未创建时，直接把 OAuth identity 绑定到 target legacy OneKeyID。
- source OneKeyID 已存在时，它不是孤儿 ID，也不是物理删除。它会变成 target OneKeyID 下的 merged alias / redirected source account。
- source OneKeyID 已存在时，它废弃为登录主体；其数据、引用关系、审计记录默认长期保留为只读，方便用户未来找回、客服核对和回滚。
- source OneKeyID 已存在时，可合并的数据迁移或关联到 target；如果 source 是 `sourceOauthHandle`，则没有 source OneKeyID 数据迁移，只绑定 OAuth identity。
- 只有同一类数据出现无法自动判断的冲突时，才让用户选择 target 优先、source 优先，或进入客服处理。
- source OneKeyID 已存在时，其数据不因合并流程物理删除；迁移成功也要保留只读 archive 和 redirect 关系，确保合并失败、误操作或客服排查时可恢复。
- 合并确认页必须明确展示“将保留哪些数据、迁移哪些数据、哪些数据需要用户选择、哪些数据需要客服处理”。

业内更常见的做法是 alias / tombstone + redirect：

- source user id 保留为 alias，不再接受新写入和新登录态。
- source OAuth identity 迁移或重定向到 target，用户再次用 source OAuth 登录时直接进入 target。
- 所有合并动作写审计日志，不直接删除 source 记录。
- 重要数据按类型迁移、关联或只读归档，而不是静默丢弃。
- 在 target 账号下提供低曝光只读入口查看历史合并账号。

低曝光只读入口：

- 入口放在 Account Security / Advanced / Need help? 下，例如 `Merged accounts` 或 `Previous accounts`。
- 只有 target 存在 merged source 记录时才展示；正常新用户不可见。
- 展示 source 的 masked email / provider、合并时间、merge request id、数据处理状态。
- 允许用户只读查看 source 的订单、权益、Cloud Sync 归档状态、Keyless 绑定状态和客服处理状态。
- 不提供切回 source 账号继续使用的入口；source 只用于查看、找回、客服核对和回滚。

合并规则：

- 身份合并本身不要求 Keyless PIN；只有进入 Cloud Sync / Keyless 数据解密、恢复或重加密时，才按对应钱包能力要求 PIN 或本地解密凭证。
- 如果 source 只有登录身份、没有 Prime / 订单 / Referral / Cloud Sync / Keyless 数据，可以走快速合并，只迁移 OAuth identity，并把 source OneKeyID 标记为 merged / redirected。
- OAuth identity：把 source 上的 Google / Apple OAuth identity 迁移到 target OneKeyID。`(provider, providerSubject)` 仍保持全局唯一。
- Keyless wallet：source 上已绑定的 Keyless wallet 可以迁移或关联到 target OneKeyID。多个 Keyless / OAuth 账户指向同一个 legacy OneKeyID 是允许的；如果 target 已经有 Keyless binding，不能覆盖 target，也不能删除 source binding，应保留为 secondary / linked_readonly，或在产品只允许一个 active Keyless wallet 时进入客服处理。
- 登录行为：source OneKeyID 废弃为登录主体并标记为 merged / redirected。后续用户用 source OAuth identity 登录时，返回 target OneKeyID。
- Prime / 订单：订单记录保持不可变并全部保留，用户可在 target OneKeyID 下查看。权益尽量合并到 target；如果两个账号都有有效权益，以服务端权益合并规则处理，无法自动判定时进入客服，不直接丢弃权益。
- Referral：target legacy OneKeyID 的 Referral 关系保持主归属。source Referral 数据只做关联记录，奖励迁移需要单独产品规则；无法自动判断时进入客服，不静默覆盖。
- Cloud Sync：不能在服务端盲合并加密数据。若两个账号都有 Cloud Sync 数据，客户端需要在用户确认后拉取、解密、合并、重新加密并上传到 target。列表型数据按 item id / 更新时间去重合并；单值设置或同一 key 冲突才让用户选择 target 优先或 source 优先。
- 本地钱包与资产账户：不删除本地钱包、不迁移私钥、不重建资产账户。合并只改变 OneKeyID 归属和云端账户关系，本地钱包顺序、账户、DApp 连接、Bot Wallet 关系保持不变。
- 审计与回滚：保留 merge request id、source / target OneKeyID、验证方式和操作时间。source 数据不因迁移物理删除，默认长期保留只读 archive 和引用关系；只有独立的合规删除、用户删除或法务流程可以触发数据删除评估，不能把账号合并成功作为清理 source 数据的条件。
- 分叉关系记录：合并过程中必须写入 `IOneKeyAccountMergeRelation`，记录 source / target、触发原因、验证方式、数据处理状态和最终 redirect 关系，方便未来通过任一 OneKeyID 反查关联账号。

source 下有重要数据时的处理（落库使用 `IOneKeyAccountMergeRelation.dataStatus` 中的同名枚举值）：

- `migrated`：OAuth identity、Keyless binding、可直接归属到 target 的权益状态。
- `linked_readonly`：订单、发票、历史操作记录等不可变记录，不改写原始 owner，只通过 merge alias 让 target 可见。
- `client_merge_required`：Cloud Sync 加密数据、本地可解密的用户数据，需要客户端解密、去重、重加密上传。
- `user_choice_required`：同一 key 的单值配置、命名冲突、重复收藏等，让用户选择 target 优先或 source 优先。
- `support_required`：权益叠加、Referral 奖励、风控敏感记录等无法自动判定的项目，保留 source 只读并进入客服流程。

术语权威源：`IOneKeyAccountMergeRelation.dataStatus` 是落库结构权威源；本节描述与字段取值严格一致。

这个流程和“已登录 legacy OneKeyID 手动升级 Keyless 登录”是两个方向不同的流程：

- legacy 已登录升级 Keyless：target 是当前 legacy OneKeyID，只绑定新的 OAuth / Keyless 能力。
- OAuth / pending OAuth 合并 legacy：source 可能是当前 OAuth 新 OneKeyID，也可能只是 OAuth identity（`sourceOauthHandle`）。target 是用户通过 Email OTP 验证的 legacy OneKeyID；只有 source OneKeyID 已存在时，才需要处理两个 OneKeyID 的数据归属。

两个均无 `legacyEmail` 的 OneKeyID 之间**不提供合并路径**：

- 若两者 OAuth identity 的 `normalizedEmail` 相同，跨 provider 自动合并规则（同 email scope 自动归并）已在创建第二个 identity 时阻止分叉，不会落成两个独立 OneKeyID。
- 若两者 `normalizedEmail` 不同，视为用户主动持有的两个独立账号，**不提供自助合并入口，也不进入客服流程**。用户通过 logout 后用另一个 OAuth provider 重新登录在两个账号间切换。
- 显式合并入口（`Merge existing OneKeyID`）只接受 target 是 legacy email OneKeyID 的合并请求；不支持 OAuth-only → OAuth-only。

### Secure storage 迁移

现有 Keyless secure storage key 多以 `ownerId` 为索引，例如 refresh token、mnemonic password。迁移时不要立即改掉旧 key。

新方案下 OAuth credential（access token / refresh token / id token）**统一存储到 Keyless secure storage 的 OAuth credential namespace**，OneKeyID 与 Keyless wallet 共享同一份。具体策略：

- **OAuth-only 用户**（含 Phase 2 之后的新用户、所有未持有旧 Keyless wallet 的用户）：首次 Google / Apple 登录时直接把 OAuth credential 写入统一 namespace；Lazy-create Keyless wallet 时直接复用同一份，不需要在两个 namespace 间迁移或复制。
- **Legacy email 老用户升级期间**：legacy Email OTP 登录 OneKeyID 不产生 OAuth credential；本地旧 Keyless wallet 可能已持有自己的 OAuth credential（旧 namespace）。绑定流程完成后，统一 namespace 中保留一份 active OAuth credential（同 email 绑定时直接复用 Keyless 旧 credential；跨 email 升级时使用新 OAuth credential 覆盖，旧 credential 进入只读 archive）。

建议采用双读双写：

- 新版本写入 `onekeyUserId + keylessOwnerId` 新 namespace。
- 读取时先读新 namespace，读不到再 fallback 旧 `ownerId` namespace。
- 每个 key 需要有迁移成功标记。只有确认新 namespace 可读、旧客户端兼容窗口结束、且该旧 key 不再是唯一可用凭证时，才允许清理旧 namespace。
- 旧 namespace 清理只针对本地 credential cache，不影响服务端旧 OneKeyID sync 数据；旧 OneKeyID sync 数据按本文策略永久只读保存。

### UI / 产品入口设计

产品入口设计目标：

- 主登录路径保持简单：只展示 Google / Apple，不把 Email + OTP 重新做成普通登录方式。
- 老用户找回、跨 email 合并、Apple private relay 分叉修复都有入口，但入口必须低曝光，避免干扰正常新用户。
- 所有跨 email 合并都复用同一个 `Merge existing OneKeyID` 入口，不为 Apple private relay 单独做专属入口。
- Keyless PIN 只出现在 Keyless create / restore / reset / verify 场景，不出现在 OneKeyID 登录和账号绑定入口里。

需要增加或调整的入口：

| 界面 | 入口 / UI | 展示条件 | 行为 |
| --- | --- | --- | --- |
| 登录页 / OneKeyID 登录弹窗 | `Continue with Google`、`Continue with Apple` | 所有用户 | 主登录入口。OAuth 成功后调用 OneKeyID upsert。登录过程不触发 Keyless PIN，也不自动创建 Keyless wallet。 |
| 登录页 footer / Help sheet | `Need help signing in?` -> `Sign in legacy OneKeyID` | 低曝光常驻，不能作为主按钮 | 进入 legacy Email + OTP 找回 / 查看流程。只允许已有 `legacyEmail` 的旧用户继续；不支持新 email 创建；前端和服务端都不能泄露 email 是否存在。 |
| 登录页 / OneKeyID 登录弹窗 | 移除 Email + OTP 主入口 | 所有用户 | 不再展示 `Continue with OneKey ID` 后输入 email 的普通登录路径。 |
| OAuth 登录后的 pending merge 页面 | `Merge existing OneKeyID`、`Use another Google / Apple account`、`Contact support` | 服务端返回 `manual_merge_required` | 不写入普通登录态，不设置 `isLoggedInOnServer = true`。用户必须完成当前 OAuth credential + legacy Email OTP 后才能进入正式 OneKeyID session。 |
| Account / Account Security | `Sign-in methods` | 已登录 OneKeyID | **只读**展示已绑定 Google / Apple identities、legacy email 状态、Keyless wallet 状态。**不提供 `Add Google` / `Add Apple` 主动添加入口**：新 OAuth identity 只能通过登录时的同 email 自动合并、或 `Merge existing OneKeyID` 显式合并流程被动绑定。 |
| Account / Account Security / Advanced / Need help? | `Merge existing OneKeyID` | 已登录 OAuth OneKeyID；低曝光常驻 | 通用显式账号合并入口。适用于 Google 不同邮箱、Apple 真实邮箱不同于 legacy email、Apple private relay 等 OAuth 新建账户后的分叉场景。 |
| Account / Account Security / Advanced / Need help? | `Sign in legacy OneKeyID` | 低曝光常驻 | 旧用户通过 legacy Email + OTP 查看原 OneKeyID，或在 OAuth 合并故障后找回 legacy 账户。不支持新 email 注册。 |
| Account / Account Security / Advanced / Need help? | `Merged accounts` / `Previous accounts` | 仅当当前 OneKeyID 有 merged source 记录 | 只读查看历史 source 账号、合并时间、source provider/email、订单 / Prime / Referral / Cloud Sync 数据状态、support request id。不能切回 source 账号继续使用。 |
| legacy Email + OTP 登录后的账户页 | `Merge to current OneKeyID` / `Continue with Google or Apple`、`View legacy account`、`Contact support` | legacy Email OTP 校验成功后 | legacy email 登录态等同于普通 OneKeyID 登录态，可正常查看 / 操作原 OneKeyID 全部数据。若要合并，必须先获取当前 OAuth credential，再用 legacy Email OTP 完成 target 校验。 |
| Prime / Orders / Referral / Cloud Sync restore 页面 | `Looking for another OneKeyID?` | 仅在强信号下低干扰展示，例如本地有 legacy 登录痕迹、旧 sync 历史、用户找不到权益或恢复失败 | 打开 `Merge existing OneKeyID` 或 `Sign in legacy OneKeyID`。提示可关闭并限频，例如 30 天内不再主动提示。 |
| Keyless create / restore / Keyless sync 页面 | 不新增 OneKeyID 登录入口；复用已登录 OAuth credential | 用户主动进入 Keyless 能力场景 | 先确认 OneKeyID session，再进入 Keyless PIN。若尚未登录 OneKeyID，先走 Google / Apple；OAuth credential 可复用，不重复弹 Google / Apple。**进入 Keyless 流程时若当前 OneKeyID 未绑定任何 OAuth identity，自动拉起 Google / Apple 绑定（被动触发，等同 S1 规则）。** |
| legacy OneKeyID 已登录的账户安全页 | `Upgrade to Keyless login` | 仅 legacy OneKeyID 已登录，且同 email 自动绑定不可用时 | 这是窄场景跨 email 手动绑定入口。用户主动发起，服务端校验当前 OAuth credential + legacy Email OTP；不要求 Keyless PIN。 |
| **S1：legacy email 登录完成页 / 启动后引导** | 自动弹出 `Set up Google / Apple sign-in` 引导卡片 | legacy email OTP 登录成功 + 该 OneKeyID `googleIdentities=[]` && `appleIdentities=[]` | 升级核心场景：被动触发，不依赖用户去 Account Security 主动 Add。拉起 Google / Apple；同 email 静默绑定；跨 email **始终要求重新 legacy Email OTP**，不豁免（即便用户刚通过 OTP 登录也要再走一遍）。可关闭并限频。 |
| **S3：Cloud Sync 模式切换** | 进入 OneKeyID → Keyless sync 迁移流程时自动拉起 OAuth | `cloudSyncMode = onekeyid` 且用户触发迁移或自动迁移启动 | 迁移前自动拉起 Google / Apple 获取 OAuth credential；OAuth credential 缺失时阻断迁移；不要求 Keyless PIN。 |
| **S4：Email + OTP 下线 Phase 5 临近** | 启动后强制弹窗 `Set up Google / Apple sign-in before Phase 5` | 服务端配置 Phase 5 即将启动 + 当前 OneKeyID 仅有 legacy email、无 OAuth identity | **半阻断**：启动后强制弹窗每次必看，用户可点 `Skip` 跳过，但 Phase 5 启动后该 OneKeyID 将无法用 legacy email 登录。文案明确警告。底层绑定规则与 S1 相同（跨 email 要 OTP）。 |
| **S5：`Sign in legacy OneKeyID` 找回成功后** | 登录完成页直接展示 `Set up Google / Apple sign-in` 卡片 | 用户通过低曝光 legacy email 找回入口登录成功 | 利用刚通过 OTP 的登录窗口主动引导绑定 OAuth identity，避免下次登录还要再找回。卡片可关闭。跨 email 仍要求重新 OTP。 |
| 客服 deep link / support case | `Continue merge request` | 客服创建或恢复 merge request | 进入同一个显式合并流程，不绕过当前 OAuth credential + legacy Email OTP。 |

明确不增加入口的位置：

- 不在首页、资产首页、普通登录完成页放 `Merge existing OneKeyID` 主按钮。
- 不因为“当前是 OAuth 新账号”就主动弹窗要求合并。
- 不在 Keyless PIN 页面放账号合并入口，避免把 PIN 误解为 OneKeyID 绑定凭证。
- 不提供 Email + OTP 新用户注册入口。
- 不提供切回 merged source OneKeyID 继续正常使用的入口；source 只用于只读查看、客服核对和回滚。
- 不提供 `Add Google` / `Add Apple` 主动添加 OAuth identity 入口；`Sign-in methods` 仅做只读展示。新 identity 只能通过"登录时同 email 自动合并"、"`Merge existing OneKeyID` 显式合并"，或被动自动引导（S1 / S2 / S3 / S4 / S5）绑定。
- 不主动提示当前 OneKeyID 已绑定 ≥ 1 个 OAuth identity 的用户"再绑一个备用 provider"。
- 不在 Keyless PIN 输入页、转账签名页、转账确认页等敏感操作流程内插入 OAuth 绑定引导。
- 不对 OAuth-only 新用户在登录完成后主动提示再绑另一个 provider。
- 自动引导场景的跨 email 绑定**始终**要求重新走 legacy Email OTP，不因"用户刚通过 OTP 登录"而豁免；豁免只允许同 email 静默绑定。

## 账户合并规则

### OneKeyID 可以自动合并

- OAuth identity 已经绑定到某个 OneKeyID。
- OAuth identity 未绑定，且非 Apple private relay email，verified email 严格命中某个 legacy OneKeyID 的 `legacyEmail`。
- OAuth identity 未绑定，且未命中 legacy OneKeyID 时，verified email 严格命中唯一一个已有 OAuth identity 所属的 OneKeyID。Google 与 Apple 同 verified email 时属于这个规则，自动合并，不要求显式绑定。
- OneKeyID 已绑定其他 Google / Apple identity，但这些 OAuth identity 的 verified email 与当前 OAuth email 相同。不同 provider、不同 `socialUserIdHash` 不构成冲突。
- 多个 Keyless / OAuth 账户指向同一个 legacy email 时，合并到该 legacy OneKeyID 下，不构成冲突。
- 同 email 自动合并只需要服务端校验 OAuth credential 合法性，不要求 Email OTP。
- Apple 返回真实 verified email 时，仍按同 email 自动合并；只有 Apple private relay email 暂不参与真实 legacy email 自动合并，当前按独立账户处理。

### OneKeyID 不允许自动合并

- OAuth email 不是 verified 状态。
- OAuth email 与 legacy OneKeyID email 不同。该情况只能走“已登录 legacy OneKeyID 手动升级 Keyless 登录”的窄口径例外，不能自动合并。
- OAuth 新建账户后续想合并 legacy OneKeyID 时，只能走显式账号合并流程，不能在登录时自动合并。
- 如果客户端本地存在 legacy OneKeyID 登录态或 legacy 登录凭证，OAuth 登录无法自动合并时，服务端应返回 `manual_merge_required`，客户端必须优先引导合并，不能直接创建新 OneKeyID。
- 同一个 verified `normalizedEmail` 命中多个非 merged OneKeyID 的 OAuth email scope 时，视为历史数据完整性异常，不自动选择 target，不创建新账号，进入显式合并或客服流程。

### Keyless 可以在 Keyless 场景内绑定

- 客户端读取当前已登录 OAuth credential，服务端校验 credential 合法性。
- 如果 OAuth verified `normalizedEmail` 命中当前 OneKeyID 的 email scope，则静默绑定，不要求 Email OTP。
- 如果 OAuth email 与当前已登录 legacy OneKeyID 的 `legacyEmail` 不同，必须由用户主动进入手动跨 email Keyless 升级流程，并完成 legacy OneKeyID Email OTP。
- 绑定不使用 `socialUserIdHash` 或 `keylessOwnerId` 作为认证材料。
- 绑定不要求 Keyless PIN。

### Keyless 绑定冲突

OAuth 账户绑定只解决 OneKeyID 身份。Keyless wallet 绑定不要求 Keyless PIN，也不额外要求 Keyless wallet 验证步骤。以下情况视为 Keyless 绑定冲突或异常：

- 当前 Keyless OAuth identity 已绑定到另一个有实际数据的 OneKeyID。
- 同一个 `(provider, providerSubject)` 已经绑定到另一个 OneKeyID，不能再次绑定到当前 OneKeyID。
- 跨 email 绑定不是当前已登录 legacy OneKeyID 用户主动发起，或没有完成 legacy OneKeyID Email OTP。
- OAuth credential 校验失败、过期或 provider subject 与服务端记录不一致。

Keyless wallet 绑定不使用 `socialUserIdHash` 或 `keylessOwnerId`。多个 Keyless / OAuth 账户只要 verified email 相同，都可以绑定到同一个 legacy OneKeyID。OneKeyID 自动合并只看 verified email 严格相同；Keyless 同 email 绑定只看当前已登录 OAuth credential，跨 email 手动升级才额外要求 legacy OneKeyID Email OTP。

### 客服或人工流程

基于严格 email 相同自动绑定规则，仍需要客服或人工处理的场景：

- 除“已登录 legacy OneKeyID 手动升级 Keyless 登录”例外外，用户要求合并不同 normalized email 的账户。
- OAuth 新建账户和 legacy OneKeyID 都已有数据，且自动合并无法处理时，走显式账号合并；若权益、Referral 或 Cloud Sync 冲突无法自动决策，再进入客服。
- OAuth binding 表存在唯一性异常，例如同一个 `(provider, providerSubject)` 对应多个 OneKeyID。
- 同一个 verified `normalizedEmail` 在 OAuth email scope 中命中多个非 merged OneKeyID，服务端无法唯一判断 target。
- Keyless wallet 已绑定到另一个有实际数据的 OneKeyID，且用户无法完成两个 OneKeyID 的显式合并验证。
- 用户有多个不同 email 的 OneKeyID，并希望合并 Prime、Referral、订单、Cloud Sync 或 Keyless wallet。
- Keyless 数据损坏，并且自助恢复、重置 PIN 都失败。
- 订阅、订单、Referral 归属与自动绑定后的 OneKeyID 不一致。

## Cloud Sync 迁移方案

新用户默认使用 Keyless sync。

老用户迁移流程：

1. 如果当前启用 OneKeyID sync，先用 OneKeyID credential 完成一次 sync，确保本地数据最新。
2. 准备 Keyless wallet 和 Keyless sync credential。
3. 使用 `convertSyncItemsForModeSwitch()` 将本地 sync item 从 OneKeyID 加密改为 Keyless 加密，**写入本地临时 namespace**，不覆盖原始 OneKeyID 加密版本。
4. 按 itemId **幂等上传**到服务端 Keyless namespace；网络中断 / 进程退出后下次启动从头执行步骤 3-4，重复上传同一 itemId 直接覆盖，不需要本地 checkpoint。
5. 步骤 4 全部 item 上传成功后，客户端调用 `POST /prime/v1/account/keyless/migration/done`，**服务端在此一步标记 `cloudSyncMode = keyless`**；标记成功才视为迁移完成。
6. 标记成功后客户端清理本地临时 namespace，把 Keyless 加密版本提升为活跃版本；本地 OneKeyID 加密版本保留为只读 archive。
7. 旧 OneKeyID sync 数据永久只读保存，用于回滚、旧版本兼容和客服排查。

中断恢复原则：

- 步骤 3 中断：临时 namespace 部分写入，下次启动检测到 `cloudSyncMode = onekeyid` 且本地有未完成临时 namespace，丢弃临时 buffer 从头重新执行。
- 步骤 4 中断：服务端 Keyless namespace 部分写入；下次启动从头重新转换 + 重新上传（按 itemId 幂等覆盖）。
- 步骤 5 中断（上传完成但标记前崩溃）：下次启动 `cloudSyncMode` 仍是 `onekeyid`，客户端按原模式继续；本次启动重试 migration 时会重新转换 + 重新上传 + 重新标记，幂等覆盖既有 Keyless namespace，最终结果一致。
- 步骤 6 中断：本地临时 namespace 残留，下次启动检测到 `cloudSyncMode = keyless` 直接清理临时 buffer。
- 多设备并发：服务端 `cloudSyncMode` 切换为单调操作（`onekeyid → keyless` 不可回退）。device A 标记成功后，device B 下次刷新 mode 即跟随 Keyless 模式；device B 在 device A 标记前持有的 OneKeyID 模式上传仍正常落入旧 namespace，不影响最终一致。

迁移过程中不能删除旧 OneKeyID sync 数据，也不能让本地只剩不可解密的新数据。本地临时 namespace 在步骤 5 标记成功**之前**绝不替换活跃 namespace。

## 用户分群

### 新用户

- 通过 Google / Apple 登录进入 upsert。
- 服务端先查 OAuth binding，再按 verified `normalizedEmail` 查可自动合并的 OneKeyID email scope。
- 只有没有 OAuth binding、没有可自动合并的 OneKeyID、且本地没有 legacy 登录态或 legacy 登录凭证时，才创建新的 OneKeyID。
- 新建 OneKeyID 不创建 `legacyEmail`。
- Keyless wallet lazy create：登录后不自动创建；用户第一次进入创建钱包、恢复钱包、Keyless sync 或其他必须依赖 Keyless wallet 的场景时再创建。
- Cloud Sync 默认 Keyless mode，但真正需要 Keyless credential / wallet 时才进入 Keyless 创建或恢复流程。

### 只有 OneKeyID 的老用户

- 使用同 email Google / Apple 登录后静默绑定到原 OneKeyID。
- 如果只能使用不同 email 的 Google / Apple，则不自动绑定；用户通过低曝光 `Merge existing OneKeyID` 或 `Sign in legacy OneKeyID` 入口完成显式合并 / 绑定。
- 不强制创建 Keyless wallet。
- 第一次使用 Keyless wallet、Keyless sync、恢复或验证场景时再引导创建或恢复。

### 已有 Keyless wallet 的老用户

- 如果 legacy OneKeyID 已登录，按当前 OneKeyID 作为迁移目标；同 email 的 Keyless OAuth identity 可以静默绑定到当前 OneKeyID，不要求 Email OTP；不同 email 不自动绑定，但用户可以主动进入手动跨 email Keyless 升级流程。
- 如果 legacy OneKeyID 未登录，优先复用本地 Keyless OAuth credential 静默建立 OneKeyID 登录态；credential 不可用时等待用户主动 Google / Apple 登录。
- 登录和启动流程只刷新 OneKeyID 登录态与 Keyless binding status，不主动弹出 PIN。
- 绑定 Keyless 到 legacy OneKeyID 时，复用已登录 OAuth credential，不要求 PIN；只有跨 email 手动升级才要求 legacy OneKeyID Email OTP。
- 创建、恢复、重置 PIN 或验证 Keyless wallet 时，才进入 Keyless PIN。
- 保持本地 wallet id、账户、DApp 连接和 Bot Wallet 关系不变。

### 已启用 OneKeyID sync 的老用户

- 登录后先完成 OneKeyID sync。
- 再执行 Keyless sync migration。
- 成功后新设备默认走 Keyless sync 恢复。

### 冲突用户

- 不把不同 provider、不同 `socialUserIdHash` 或多个 Keyless / OAuth 账户指向同一个 legacy email 视为冲突。
- 只要 Google / Apple 能返回 verified email，并且该 email 命中一个 legacy OneKeyID，就自动合并到该 legacy OneKeyID。Apple 返回真实邮箱时也适用；Apple private relay email 先按独立账户处理，不自动合并真实 legacy email；但本地存在 legacy 信号时仍优先进入 `manual_merge_required`，不直接创建分叉账号。
- Google / Apple OAuth 创建的新 OneKeyID 后续发现 legacy 账户时，不作为登录冲突处理，提供显式账号合并入口。Apple private relay 只是其中一种来源。
- 只有无法获取 verified email、跨 email 非主动升级、OAuth identity 唯一性异常，或同一 OAuth email scope 命中多个非 merged OneKeyID 时，才不自动合并。
- 标记 `migrationStatus = conflict`。
- 客户端提供切换账号、重新验证、联系客服入口。

## 发布节奏

### Phase 1: 服务端兼容

- 支持 Google / Apple OAuth upsert OneKeyID。
- 增加 OneKeyID 与 Keyless binding status。
- 保留 legacy Email + OTP 找回 / 查看接口，但不作为新用户注册或主登录入口。

### Phase 2: 客户端登录入口切换

- 登录入口切换为 Google / Apple。
- 隐藏默认 Email + OTP 登录 UI。
- 在低曝光位置保留 `Sign in legacy OneKeyID`，仅供旧用户找回 / 查看 / 合并 legacy email OneKeyID。
- OAuth 成功后统一调用 OneKeyID login bridge。

### Phase 3: Keyless 绑定灰度

- 登录后只刷新 Keyless binding status，不触发 PIN。
- 用户进入 Keyless 绑定场景时，复用已登录 OAuth credential；同 email 静默绑定，跨 email 手动升级才要求 legacy OneKeyID Email OTP。
- 用户进入 Keyless 创建、恢复、同步或验证场景时，复用已登录 OAuth credential；只有钱包能力需要 PIN。
- 记录绑定成功率、冲突率、失败原因。
- 不立即强制 Cloud Sync 迁移。

### Phase 4: Cloud Sync 迁移灰度

- 新用户默认 Keyless sync。
- 老用户从 OneKeyID sync 灰度迁移到 Keyless sync。
- 旧 OneKeyID sync 数据永久只读保存。

### Phase 5: 下线 legacy

- 普通用户默认不可见 Email + OTP。
- legacy Email + OTP 仅保留低曝光找回 / 查看 / 合并入口，不支持新 email 创建。
- 清理普通登录路径中的旧 UI、旧状态字段和旧文案；不能删除 `legacyEmail`、merge relation、merged source archive、旧 OneKeyID sync 只读数据等迁移保留字段。

## 回滚策略

- Feature flag 控制：
  - `unifiedAccountEnabled`
  - `googleAppleOnlyLoginEnabled`
  - `autoBindKeylessEnabled`
  - `keylessSyncDefaultEnabled`
- 若 OAuth upsert 出现问题，关闭 `googleAppleOnlyLoginEnabled`，临时恢复 legacy fallback；fallback 仍仅面向已有 legacy email OneKeyID，不恢复新 email 注册。
- 若 Keyless binding 出现问题，关闭 `autoBindKeylessEnabled`，不影响 OneKeyID 登录。
- 若 Cloud Sync 迁移出现问题，关闭 `keylessSyncDefaultEnabled`，旧 OneKeyID sync 数据仍可用于恢复。

## 风险点

- OAuth 自动绑定只能使用 verified `normalizedEmail`，不要加入额外启发式匹配规则。
- 未绑定的 OAuth identity 如果没有 verified email，不能创建 OneKeyID，避免生成无法自动合并的分叉账号。
- 创建新 OneKeyID 前必须先穷尽合并路径：已有关联、同 email 自动合并、本地 legacy 登录态 / 登录凭证触发的手动合并。否则会造成账户分叉。
- OAuth upsert 必须有事务和幂等保护，避免同 email Google / Apple 并发登录创建多个 OneKeyID。
- `manual_merge_required` 必须是 pending merge state，不能授予普通 OneKeyID 登录态或 legacy 账户权限。
- `sourceOauthHandle` / `finalConfirmHandle` 必须是加密签名短期 token（绑定 provider / subject / normalizedEmail / iat / exp），不持久化任何服务端 pending 状态；`merge/confirm` 时必须验签 token 并**重新校验**当前 OAuth credential（防止 token 已撤销或被伪造），不能只凭 token 完成绑定。
- legacy Email OTP 找回接口必须防账号枚举，不能通过文案、错误码或时序泄露 email 是否存在。
- 显式合并在 legacy Email OTP 通过前不能返回 target 是否存在或 target 数据摘要，避免把合并入口变成账号枚举接口。
- 同 email 绑定不能要求 Email OTP，否则会把普通 Google / Apple 登录变回迁移流程。
- 跨 email 绑定必须限制在已登录 legacy OneKeyID 的主动升级路径内，并要求 legacy OneKeyID Email OTP。
- 手动跨 email Keyless 升级例外必须保持在已登录 legacy OneKeyID 的主动升级路径内，不能复用到普通登录或后台自动绑定。
- 两个 OneKeyID 都有数据时，不能静默合并；必须经过显式账号合并确认，并保留 source merged / redirected 记录。
- 同一个 verified `normalizedEmail` 命中多个非 merged OneKeyID 时不能自动选择 target，必须进入显式合并或客服流程。
- Keyless wallet 必须 lazy create，不能在 OneKeyID 登录成功后自动创建，否则会扩大迁移风险和误创建概率。
- `socialUserIdHash` 和 `keylessOwnerId` 不参与 OneKeyID 自动合并和 Keyless 绑定认证。
- Cloud Sync 重加密必须保证失败可重试，不得破坏本地数据。
- Secure storage namespace 迁移必须双读双写。
- 账号合并、Cloud Sync 迁移和 secure storage namespace 迁移都不能删除唯一可用数据或唯一可用凭证；清理只能在存在可读新副本和明确迁移成功标记后进行。
- 旧版本客户端必须继续可用至少 2-3 个版本周期。
- OneKeyID logout 不应删除本地 Keyless wallet。logout 时清理：登录态、scoped token。OAuth credential 的清理策略取决于当前 OneKeyID 与 Keyless wallet 的绑定状态：
  - **默认情况**（OAuth-only 用户全程，或 legacy 升级完成后）：OneKeyID 与 Keyless wallet **共享同一份** OAuth credential（统一存于 Keyless secure storage 的 OAuth credential namespace）。OAuth-only 用户首次 Google / Apple 登录拿到 credential 后直接存入统一 namespace，后续 lazy-create Keyless wallet 时直接复用同一份，不存两份。logout 时**清这一份** OAuth credential（access token / refresh token / id token）。下次启动本地无 OAuth credential，访问 OneKeyID 或 Keyless wallet 都必须重新走 Google / Apple；重新 OAuth 自动同时建立 OneKeyID 登录态。
  - **临时情况**（legacy email 老用户升级中间态：用户已通过 legacy Email OTP 登录 OneKeyID，本地旧 Keyless wallet 已有独立 OAuth credential，但 Keyless 与 OneKeyID 的绑定尚未完成）：可能临时存在两份 credential（OneKeyID 升级到 OAuth 拿到的新 credential 与旧 Keyless wallet 内部 credential）。logout 时各自清各自的；Keyless 绑定到 OneKeyID 成功后两份合并为一份（产品规则定义保留哪份为 active）。
- 共享设备 / 切换 OneKeyID 场景的安全边界：默认情况下 logout 后本地无 OAuth credential，下次启动不会自动 bootstrap，必须用户主动重新走 Google / Apple。中间态升级期间的 bootstrap 路径（行 364）仅适用于"Keyless wallet 未与 OneKeyID 绑定 + 本地 Keyless wallet 持有自己的 OAuth credential"的窄场景，不会被 logout 后的 OAuth-only 用户利用（因为此场景下 credential 已被一并清空）。
- **OAuth provider 全局故障时 OAuth-only 用户无登录路径**：当 Google 与 Apple OAuth 服务同时不可用时，没有 `legacyEmail` 的 OAuth-only 用户将完全无法登录。这是 OAuth-only 主登录方案的**固有风险**，产品上接受该风险。legacy 用户仍可通过低曝光 `Sign in legacy OneKeyID` 入口走 Email + OTP 兜底；OAuth-only 用户只能等待 provider 恢复。Google 与 Apple 是独立云服务，同时全局故障概率极低且持续时间通常为小时级，不设计应急通道。
- **legacy email 静默自动绑定的信任根是 OAuth provider 的 verified email**：OAuth identity 未关联但 verified `normalizedEmail` 命中 legacy OneKeyID 的 `legacyEmail` 时静默绑定、不要求 Email OTP。该规则隐含信任假设：**Google / Apple 返回的 verified email 是该 email 当前真实持有人的身份证明**。若 OAuth provider 层面发生 email 变更 / Workspace 邮箱 reassign / 管理员接管等情况，新持有人可以通过 OAuth 静默接管原 legacy OneKeyID。这是 OAuth 模型的固有信任假设，**责任在 OAuth provider**（Google / Apple / Workspace 管理员），不在 OneKey 产品方案。产品上接受该风险，不设计额外 OTP 验证（否则会破坏同 email 自动合并的体验目标）。

## 验收标准

- 登录页主登录区域只能展示 Google / Apple；legacy Email + OTP 只能藏在 footer / help sheet 的低曝光 `Sign in legacy OneKeyID` 入口中，不能作为主按钮出现。
- Google / Apple 登录正常返回 OneKeyID session 后，`primePersistAtom.isLoggedIn` 和 `isLoggedInOnServer` 均为 true；`manual_merge_required` 不属于正常登录完成态。
- Google / Apple 登录成功后不触发 Keyless PIN，也不自动创建、恢复或绑定 Keyless wallet。
- Keyless wallet 仅在用户进入创建钱包、恢复钱包、Keyless sync 或其他必须依赖 Keyless wallet 的场景时 lazy create。
- 未归属任何 OneKeyID 的 Google / Apple OAuth identity 返回相同 verified email 时，自动合并为同一个 OneKeyID，不出现显式绑定确认；已归属的 OAuth identity 始终返回原 OneKeyID。
- 未归属任何 OneKeyID 的 Google / Apple OAuth identity 如果没有 verified email，不能创建新 OneKeyID。
- 老 Email + OTP 用户可通过同 email Google / Apple 静默绑定回原 OneKeyID，不要求 Email OTP。
- legacy Email + OTP 找回入口仍可用于旧用户登录查看 legacy email OneKeyID，但不能创建新 email 账户，也不能作为默认主登录入口。
- legacy Email + OTP 找回入口不泄露 email 是否存在。
- Account Security / Advanced / Need help? 必须提供 `Merge existing OneKeyID`；Apple private relay、Google 不同邮箱、Apple 真实邮箱不同于 legacy email 等 OAuth 新建账户分叉场景都复用该入口。
- `Merged accounts` / `Previous accounts` 只在当前 OneKeyID 有 merged source 记录时展示，并且只能只读查看，不能切回 source OneKeyID 正常使用。
- Prime / Orders / Referral / Cloud Sync restore 场景下的找回旧账号提示只能在强信号下低干扰展示，并且必须可关闭、限频。
- 本地存在 legacy OneKeyID 登录态或 legacy 登录凭证时，OAuth 无法自动合并必须返回 / 展示手动合并路径，不能直接创建新 OneKeyID。
- `manual_merge_required` 不产生普通 OneKeyID 登录态，不创建 source OneKeyID；用户完成 legacy Email OTP 和 OAuth credential 校验后，直接绑定到 target legacy OneKeyID，再刷新为正式登录态。
- legacy OneKeyID 已登录且 Keyless OAuth email 不同时，只能通过用户主动确认的手动升级流程绑定，并要求 legacy OneKeyID Email OTP，不能静默绑定。
- OAuth 新建 OneKeyID 可通过显式账号合并迁移到 legacy OneKeyID；合并后 source OAuth identity 登录返回 legacy OneKeyID，并且 source 账号数据长期只读保留。
- 显式合并在 legacy Email OTP 通过前不能暴露 target 账号是否存在或 target 账号数据摘要。
- 同一个 verified `normalizedEmail` 命中多个非 merged OneKeyID 时，不能自动绑定或创建新账号，必须进入显式合并或客服流程。
- 已有 Keyless wallet 的用户升级后不生成第二个 Keyless wallet。
- 本地资产账户、钱包顺序、DApp 连接、Bot Wallet、地址簿、收藏、Market watchlist 不丢失。
- Keyless create、restore、reset PIN、verify PIN 流程仍可用。
- OneKeyID sync 迁移到 Keyless sync 后，新设备能通过统一账户恢复数据。
- 迁移失败可重试，回滚期间旧 OneKeyID sync 数据仍可读。

## 已定方案

- Apple private relay email：当前按独立账户处理，不自动合并真实 legacy email；但如果本地已有 legacy 登录态 / 登录凭证，仍返回 `manual_merge_required`，不直接创建分叉账号。后续通过通用显式账号合并流程处理，入口是 Account Security / Advanced / Need help? 下的 `Merge existing OneKeyID`。Apple 返回真实 verified email 时仍走同 email 自动绑定逻辑。服务端通过配置化 relay domain list 识别 private relay，并把 `emailType = apple_private_relay` 和 `relayDomainMatched` 落库。
- 老 Email + OTP 用户没有同邮箱 Google / Apple：保留低曝光 legacy Email + OTP 找回 / 查看入口。用户可先用 Google / Apple OAuth 登录，再通过 `Merge existing OneKeyID` 使用当前 OAuth credential + legacy Email OTP，把 OAuth 新建 OneKeyID 合并到 legacy OneKeyID。该入口不支持新 email 账号创建，也不恢复为普通主登录入口。
- 旧 OneKeyID sync 数据保留策略：永久只读保存，不设计额外清理窗口。这样旧版本兼容、回滚和客服排查都可以依赖原数据，迁移方案也更简单。
