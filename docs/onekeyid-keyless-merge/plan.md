# OneKeyID and Keyless Unified Login Migration Plan

## 背景

后续账户系统需要合并 OneKeyID 与 Keyless。产品期望的登录方式是：

- 统一使用 Keyless 的 Google、Apple 登录。
- 不再提供 Email + OTP 作为普通登录入口。
- 用户通过 Google、Apple 登录后，同时也是 OneKeyID 账户。

本方案的核心原则是：**OneKeyID 作为唯一用户身份，Keyless 作为 OneKeyID 下的登录、钱包恢复和密钥恢复能力**。不把两套密钥材料硬合并，不迁移 mnemonic、private key、Shamir share 到 OneKeyID 服务端。

## 当前系统边界

- OneKeyID 登录态由 `primePersistAtom` 承载，核心字段包括 `onekeyUserId`、`email`、`displayEmail`、`keylessWalletId`。其中 `keylessWalletId` 是旧 Keyless 兼容字段，当前代码里多处按服务端返回的 packSetId 使用，也可能在历史路径中映射 / 派生到本地 `hd-keyless-*` wallet id；它不是当前设备本地 Keyless wallet 的权威 ID，也不是 OneKeyID 账号级唯一字段。
- 新统一登录、OAuth identity 归属和账号合并都不能依赖 `primePersistAtom.keylessWalletId` 做服务端归属判断；评审时不把旧字段命名或废弃调用点本身作为迁移问题，除非它仍可从新统一登录路径触发或被用作 OneKeyID 权威归属 proof。
- Keyless wallet 在本地 DB 中通过 `isKeyless`、`keylessDetailsInfo` 标识。正常情况下本地只有一个当前 Keyless wallet。
- Cloud Sync 属于 Keyless wallet 能力，不属于 OneKeyID 账号数据。Cloud Sync 的本地 mode、credential、同步数据和模式切换都由现有 Keyless wallet / Cloud Sync 流程处理，不纳入本次 OneKeyID / Keyless 统一登录迁移的账号状态。

## 目标模型

统一后的账户模型：

- `onekeyUserId` 是唯一主账号 ID。
- Google / Apple OAuth identity 是 OneKeyID 的登录凭证。
- `legacyEmail` 只是老 OneKeyID 用户的历史 email 字段，每个 OneKeyID 最多保留一个。新用户不能新增 email 绑定，未来也不扩展多 email 绑定。
- 服务端权威模型是：一个 `onekeyUserId` 最多绑定一个 legacy email，且可以绑定多个 Google / Apple OAuth identity。任意一个已绑定 OAuth identity 登录，都必须返回同一个 `onekeyUserId`；legacy email 找回 / 查看入口命中该账号时，也返回同一个 `onekeyUserId`。
- OneKeyID = OAuth identity；Keyless = OAuth identity + PIN 的本地钱包能力。OneKeyID 只绑定 OAuth identity，不绑定 Keyless wallet 本身，也不使用 `keylessWalletId`、`socialUserIdHash` 或任何 Keyless wallet metadata 做 OneKeyID 归属判断。
- 一个设备只有一个当前 Keyless（OAuth + PIN）上下文；不同设备可以在 Keyless 流程中使用不同 OAuth credential。只要这些 OAuth identity 归属同一个 OneKeyID，就属于同一个 OneKeyID 账户体系。
- Keyless wallet id 继续保持现有格式，例如 `hd-keyless-*`，不重建、不改名、不迁移资产账户关系。
- OAuth identity 归属完成前，如果本地同时持有 legacy OneKeyID 登录态和本地 Keyless wallet，logout 仍然分离：OneKeyID logout 不移除 Keyless wallet；Keyless wallet logout / remove 不退出 OneKeyID。
- OAuth identity 已归属当前 OneKeyID 后，OneKeyID 与 Keyless 不再区分两套 logout。统一 `logout` 同时清理 OneKeyID 登录凭证 / OAuth credential，并移除本地 Keyless wallet。
- 用户前台只感知一个账户体系：OneKey Account。

不再保留的产品形态：

- 不再展示 Email + OTP 作为默认 / 主登录入口。
- 不再让用户感知“登录 OneKeyID”和“登录 Keyless”是两套账户。
- 不再把 Email + OTP 当作默认 / 普通登录方式。Email 只作为老账号找回、迁移、跨 email 显式合并校验，以及同 email OAuth identity 自动合并的匹配字段。

## 新登录流程

1. 用户点击 `Continue with Google` 或 `Continue with Apple`。
2. 客户端走现有 Keyless / Supabase social login，拿到 `accessToken`、`refreshToken` 和 `supabaseUser`。
3. 客户端调用新的 OneKeyID OAuth 登录桥，例如 `serviceOneKeyID.loginWithOAuthToken()`，底层调用 API-01 `POST /prime/v1/account/oauth/login`。旧 `serviceOneKeyID.loginWithAccessToken()` / `servicePrime.apiLogin()` 只保留为 legacy OneKeyID session 刷新或旧 Email + OTP 兼容路径参考，不能用于新统一登录完成态。
4. 服务端根据 OAuth identity 执行 OneKeyID upsert：
   - OAuth identity 已有关联：读取 OAuth binding 的 `boundOneKeyUserId` 对应账号；若该账号是 `active`，返回该账号；若该账号已 `merged`，说明合并时 binding retarget 不完整，返回 `account_merged_reauth_required` / `support_required` 并触发服务端对账修复。
   - OAuth identity 未关联，但 verified `normalizedEmail` 命中唯一一个 active legacy OneKeyID 的 `normalizedLegacyEmail`：服务端校验 OAuth credential 后静默绑定到该 legacy OneKeyID，不要求 Email OTP。不同 oauthProvider、不同 `socialUserIdHash` 或多个设备在 Keyless 流程中使用的 OAuth identity 同 email 不构成冲突。
   - OAuth identity 未关联，且没有命中 legacy OneKeyID，但 verified email 命中唯一 active email claim owner：静默绑定到该 owner OneKeyID。
   - OAuth identity 未关联、email 无法自动合并，但客户端提交了 `legacyOneKeyIdAuthToken` 且服务端验证它对应 active legacy OneKeyID：不要直接创建新的 OneKeyID，返回 `manual_merge_required`，先引导用户进入 API-04 到 API-06 的 pending merge / 显式合并流程。
   - OAuth identity 未关联、没有可自动合并的 verified email / legacy / email claim，且客户端没有提交可验证的 `legacyOneKeyIdAuthToken`：创建新的 OneKeyID。若 provider 没有返回 verified email，则只创建 OAuth binding，不创建 email claim。
5. 如果服务端返回 `manual_merge_required`，客户端进入 pending merge state，不把本次 OAuth 登录写成普通 OneKeyID 登录态，也不设置 `isLoggedInOnServer = true`。此时还没有创建 OAuth source OneKeyID；服务端只返回加密签名短期 token `sourceOauthHandle`（不持久化 pending 状态）和可展示的 masked OAuth 信息。客户端缓存本次 OAuth credential 与 `sourceOauthHandle`，用户完成 legacy Email OTP 后，`/merge/confirm` 提交当前 OAuth credential；服务端重新校验该 credential，并确认它与确认页绑定的 canonical source 一致后，才把该 OAuth identity 直接绑定到 target legacy OneKeyID，再刷新 `primePersistAtom`。
6. 如果服务端返回正常 OneKeyID session，客户端刷新 `primePersistAtom`，用户即处于 OneKeyID 登录态。
7. 登录流程到此结束，不创建、不恢复 Keyless wallet，也不建立 Keyless wallet 到 OneKeyID 的关系，绝不要求用户输入 Keyless PIN。
8. 后续只有当用户主动进入 Keyless wallet 创建、恢复、重置 PIN 或验证场景时，才会进入 Keyless PIN / wallet verification 环节。客户端自动读取当前已登录的 OAuth credential，不重复拉起 Google / Apple 登录；只有本地 credential 失效或缺失时，才重新要求 Google / Apple 登录。

## 服务端迁移方案

### OneKeyID 数据结构目标

服务端 OneKeyID 只保留一个主账号 ID，并把不同登录凭证挂在这个主账号下。对客户端协议输出时统一使用 `identities` 数组，legacy email 和 Google / Apple OAuth 都是其中一种 identity；服务端内部仍可以保留 legacy email 字段和 OAuth binding 表作为持久化结构。下面是服务端内部持久化 record 草案；API response shape 以 [server-apis.md](./server-apis.md) 的 Shared Types 为准。

```ts
type IOneKeyIdIdentityRecord = {
  identityType: 'legacy_email' | 'oauth';
  oauthIdentityId?: string; // 仅 identityType='oauth' 时返回；服务端 OAuth identity 稳定 ID，当前等于 Keyless 服务端根据 OAuth token 生成的 hashId
  oauthProvider?: 'google' | 'apple';
  oauthSubject?: string;
  oauthEmailType?: 'real' | 'apple_private_relay' | 'missing_or_unverified';
  oauthEmail?: string;
  oauthRelayDomainMatched?: string;
  legacyEmail?: string; // 仅 identityType='legacy_email' 时返回；旧 OneKeyID email 原始值
  normalizedEmail?: string;
  displayEmail?: string;
  status?: 'active'; // 仅 identityType='legacy_email' 时返回；OAuth identity 不单独返回 status
};

type IOneKeyIdAccountRecord = {
  onekeyUserId: string;
  legacyEmail?: string; // 老用户历史 email，每个 OneKeyID 最多一个。新用户为空。
  normalizedLegacyEmail?: string; // legacyEmail 的规范化结果；active legacy OneKeyID 中全局唯一。
  identities: IOneKeyIdIdentityRecord[]; // 内部聚合 view；API response 会按 server-apis.md 的 IOneKeyIdAccount 输出
  status: 'active' | 'merged'; // 合并后 source 标记为 merged；当前方案不引入单独账号锁定状态
  mergedToOneKeyUserId?: string;                   // status='merged' 时必填，指向 target OneKeyID
  mergedAt?: string;                               // status='merged' 时必填
  createdAt: string;
  updatedAt: string;
};
```

约束：

- `legacyEmail` 只服务于老用户迁移，不作为新用户可新增的 email 绑定能力。
- 旧 email 到 OneKeyID 是唯一映射：`normalizedLegacyEmail` 在 `status='active'` 的 legacy OneKeyID 中必须全局唯一。`status='merged'` 的 source 不参与 legacy email 自动绑定。
- 当前方案不引入单独的账号禁用 / 锁定状态。在线登录、自动绑定和显式合并流程遇到无法自动判定的数据异常时，统一返回 `support_required`。
- 新用户通过 Google / Apple 创建 OneKeyID 时，不创建 `legacyEmail`。
- 一个 active OneKeyID 可以绑定多个 Google identity 和多个 Apple identity；任意一个直接绑定到该 active OneKeyID 的 OAuth identity 登录，都返回该 OneKeyID。合并完成后，source 上的 active OAuth bindings 必须直接改写到 target，登录热路径不经过 source 中转。
- 当前 OAuth identity 尚未归属任何 OneKeyID 时，Google 与 Apple 只要返回相同 verified `normalizedEmail`，并命中同一个 active email claim owner，就自动合并到同一个 OneKeyID，不需要用户显式绑定。
- 多个设备在 Keyless 流程中使用的 OAuth credential、以及多个 Google / Apple OAuth identity，只要能拿到同一个 verified email，就可以作为 OAuth identity 归属到同一个 legacy OneKeyID。
- 同一个 OAuth identity 只能绑定到一个 OneKeyID。`(oauthProvider, oauthSubject)` 必须全局唯一，不能同时归属多个 OneKeyID。
- legacy Email + OTP 找回 / 查看入口只能命中已有 active legacy OneKeyID；命中后返回该 OneKeyID，不创建新账号。
- 自动绑定只允许 verified `normalizedEmail` 严格相同；不同 email 不能进入自动流程。
- 服务端任何按 `onekeyUserId` 的写入操作必须先检查 session 绑定的 OneKeyID 是否仍为 `status='active'`。如果 session 对应的 OneKeyID 已经是 `status='merged'`，服务端必须拒绝本次写入并返回 `account_merged_reauth_required` / 401，不允许透明跟随 `mergedToOneKeyUserId` 写入 target。
- 合并执行必须以 `IOneKeyIdMergeRelation` execution record 为幂等锚点。`/merge/confirm` 先创建或锁定 `processing` 记录；主合并事务内原子更新 source 的 `status = 'merged'`、`mergedToOneKeyUserId` / `mergedAt`、source active OAuth bindings 归属、source active email claim 归属、identity retarget 子表，并把 relation 从 `processing` 更新为 `merged`。如果 source OneKeyID 已存在，source active OAuth bindings 必须改写为 `boundOneKeyUserId = targetOneKeyUserId`，source 只保留 archive / merge relation；如果是 `pending_oauth_bind`，没有 source OneKeyID，则直接把 confirm 时提交的 OAuth identity 绑定到 target legacy OneKeyID。如果主事务失败，失败状态必须在主事务外或独立审计事务中更新到同一条 relation。
- 合并成功后必须立即 revoke source OneKeyID 的旧 AUTH token、session 和 scoped token。客户端收到 `account_merged_reauth_required` / 401 后，需要清理本地 OneKeyID token / `primePersistAtom`，报错并回到登录界面，让用户手动重新发起 Google / Apple 登录；客户端不能自动重试，避免服务端持续返回同一错误时进入循环。
- OAuth 登录 / session 重新签发必须命中直接指向 active target 的 OAuth binding，并签发 target session；只读历史查询可以通过 merge relation / source archive 查看 source。写入路径不得使用 source 旧 session 透明重定向到 target。
- `IOneKeyIdAccountRecord.status` 与 `IOneKeyIdMergeRelation` 信息冗余但**前者是写入 / session 校验热路径权威源**；merge_relation 仅作审计、只读历史查询和客服排查用途，不在写入热路径里 lookup。

### OAuth identity 绑定规则

一个 OneKeyID 允许绑定多个 OAuth identity，例如同一 email 下的多个 Google identity 和多个 Apple identity。当前 OAuth identity 未归属任何 OneKeyID 时，Google 与 Apple 同 verified email 通过 active email claim owner 自动合并，不要求用户显式绑定。自动绑定只使用 `normalizedEmail` 严格相同匹配，不关心 provider 是否不同，也不关心 Keyless 本地的 `socialUserIdHash` 是否不同。

`normalizedEmail` 只做基础规范化，例如 trim 和 lowercase。除此之外不做 provider-specific 推断。

本文里的 OneKeyID `email scope` 指该 OneKeyID 的 `normalizedLegacyEmail` 和所有已绑定 OAuth identity 的 verified `normalizedEmail` 集合。自动绑定优先命中 active legacy OneKeyID 的 `normalizedLegacyEmail`；没有 legacy 命中时，必须锁定并查询 active email claim owner。OAuth identity email scope 仅作为历史数据校验和缺失 claim 回填依据，不作为并发路径的权威 owner 查询。

Apple 可能返回用户真实邮箱，也可能返回 private relay 邮箱。当前没有可依赖的 OAuth 字段标识 private relay，服务端按邮箱域名后缀识别。默认 relay domain 为 `privaterelay.appleid.com`，但不要硬编码在业务逻辑里，应放到服务端配置表或远程配置中，方便 Apple 后续调整域名时快速更新。

判断规则：

- 仅当 `oauthProvider = apple` 且 normalized email domain 命中服务端配置的 relay domain list 时，判定为 Apple private relay。
- 初始配置：`['privaterelay.appleid.com']`。
- 未命中 relay domain list 的 Apple verified email 按真实邮箱处理，继续参与同 email 自动绑定。

Apple private relay email 当前按独立账户处理，不尝试把它和用户真实 legacy email 做自动合并；若客户端提交了可验证的 `legacyOneKeyIdAuthToken`，则仍优先返回 `manual_merge_required`，避免直接创建分叉账号。后续通过通用显式账号合并流程处理。该流程有固定低曝光入口：Account Security / Advanced / Need help? 下的 `Merge existing OneKeyID`。如果 Apple 返回的是可识别的真实 verified email，则仍然走同 email 自动绑定逻辑。

Apple email 缺失处理：

- 正常首次 Apple 授权返回 `oauthSubject` 和 verified email 时，服务端必须在同一事务内完成 OAuth binding、email claim 和 OneKeyID session 签发。只要 `(oauthProvider, oauthSubject)` 已落 OAuth binding，后续 Apple 登录即使不再返回 email，也按已绑定 identity 正常返回 OneKeyID。
- 如果 `(oauthProvider, oauthSubject)` 未绑定，且 Apple 本次 token 没有返回 verified email，服务端仍可以创建 OAuth-only OneKeyID，但不能创建 email claim，也不能参与同 email 自动合并。若客户端提交 `legacyOneKeyIdAuthToken` 且服务端验证它对应 active legacy OneKeyID，仍优先返回 `manual_merge_required`，避免直接创建分叉账号。
- 客户端不能用本地 Keyless metadata、本地缓存 email、`socialUserIdHash` 或 `keylessWalletId` 来补偿 Apple 缺失 email；这些信息最多用于展示提示，不能作为 OneKeyID 创建、自动合并或显式合并 proof。创建无 email 的 OAuth-only OneKeyID 时，身份 proof 只来自已验证的 OAuth token 与 OAuth subject。
- 客户端仍可提供 `Use another Apple ID`、`Re-authorize Apple Sign-In`、`Contact support` 作为辅助恢复路径。`Re-authorize Apple Sign-In` 指引用户在系统 Apple ID 设置里对 OneKey 执行 `Stop Using Apple ID` 后重新登录，让 Apple 重新下发 email；如果重新授权后返回 verified email，则服务端可补齐 OAuth binding 的 email 字段并创建 / 回填 email claim。
- 如果用户在首次 Apple 授权返回 email 时进入了 `manual_merge_required`，但 `sourceOauthHandle` 过期或客户端丢失缓存，后续 Apple 登录又不返回 email，则仍可重新进入显式合并流程；合并 proof 是当前 OAuth credential + legacy Email OTP，不依赖本地缓存 email。

建议独立维护 OAuth identity 绑定表：

```ts
type IOneKeyIdOAuthBindingRecord = {
  oauthIdentityId: string; // 服务端 OAuth identity 稳定 ID；当前等于 Keyless 服务端根据 OAuth token 生成的 hashId
  boundOneKeyUserId: string; // 当前 OAuth identity 绑定到的 active OneKeyID；合并完成后必须改写到 target
  oauthProvider: 'google' | 'apple';
  oauthSubject: string;
  oauthEmail?: string;
  normalizedEmail?: string;
  oauthEmailType: 'real' | 'apple_private_relay' | 'missing_or_unverified';
  oauthRelayDomainMatched?: string;
  createdAt: string;
  updatedAt: string;
};
```

同时建议维护独立的 email 归属 claim 表，用来给同 email 自动合并路径提供强并发约束。它不是登录凭证表，也不替代 OAuth binding；它只回答“这个 verified normalized email 当前归属于哪个 active OneKeyID”：

```ts
type IOneKeyIdEmailClaim = {
  normalizedEmail: string;
  ownerOneKeyUserId: string;
  emailType: 'legacy' | 'real' | 'apple_private_relay';
  status: 'active' | 'merged';
  createdAt: string;
  updatedAt: string;
};
```

约束：

- email claim 表只保存 verified email，`emailType` 使用 `'legacy' | 'real' | 'apple_private_relay'`。OAuth binding 表使用 `oauthEmailType`，并允许 `oauthEmailType = 'missing_or_unverified'`，表示该 OAuth identity 当前没有可用的 verified email；这种 binding 不创建 email claim，也不能参与同 email 自动合并。
- 对 `status = 'active'` 的记录建立 `UNIQUE(normalizedEmail)`，或使用等价的行级锁 / advisory lock 机制，保证同一个 verified email 在 active 账号体系里只能有一个 owner OneKeyID。
- 一个 OneKeyID 可以拥有多个 email claim，例如一个 legacy email 和手动跨 email 升级时绑定进来的 OAuth email。
- active legacy OneKeyID 的 `normalizedLegacyEmail` 必须预先 seed 到 email claim 表，并指向该 legacy OneKeyID。
- OAuth binding 的 `normalizedEmail` 仍然不做全局唯一约束；同一个 email 可以出现在同一个 OneKeyID 的多个 Google / Apple identity 上。全局 owner 只由 email claim 表维护。
- 读取 active email claim owner 时，必须同时锁定或校验 owner OneKeyID，且 owner 必须是 `status = 'active'`。如果 owner 是 `merged`，说明 claim 迁移不完整，必须先对账迁移 claim 到 target，无法确认时返回 `support_required`，不能继续把 OAuth identity 绑定到已 merged source。
- source OneKeyID 已存在的账号合并中，source 的 active email claim 必须在同一事务内迁移到 target；`pending_oauth_bind` 没有 source OneKeyID，绑定成功时只有在当前 OAuth identity 有 verified email 时才创建或迁移 target active email claim。若发现同一个 `normalizedEmail` 已归属另一个非 target active OneKeyID，返回 `support_required`，不能覆盖。需要留痕时通过 merge relation 记录历史 owner，不保留第二条 active claim。

数据库约束：

- OneKey account 表必须对 active legacy 账号建立 `UNIQUE(normalizedLegacyEmail)` 约束，或等价的部分唯一索引，保证一个旧 email 只对应一个 active OneKeyID。迁移上线前必须完成历史数据预检查；若发现重复旧 email，必须先进入人工处理并返回 `support_required`，不能带着重复数据开启 OAuth 同 email 静默绑定。
- `UNIQUE(oauthProvider, oauthSubject)`，保证同一个 Google / Apple identity 不能绑定到多个 OneKeyID。
- `oauthIdentityId` 必须由服务端根据 OAuth token / identity claims 生成，当前等于 Keyless 服务端 `hashId`；该字段必须随 OAuth binding、profile、login 和 Keyless create / restore / verify 相关响应返回，作为本地 OAuth credential namespace 的唯一 key。OAuth binding 表必须对 `oauthIdentityId` 建立 `NOT NULL + UNIQUE` 约束，并保证该值不可变。服务端热路径仍可继续使用 `(oauthProvider, oauthSubject)` 查询，不要求把 `hashId` 改成主查询 key。
- 可以允许同一个 `onekeyUserId` 下存在多个不同的 Google / Apple identity。
- 不建议用 OAuth binding 的 `normalizedEmail` 做全局唯一约束；它只用于 identity 记录、历史校验和缺失 claim 回填。同一个 email 可以出现在同一个 OneKeyID 的多个 Google / Apple identity 上，owner 判断以 email claim 表为准。
- Apple private relay 的判断结果必须落库到 OAuth binding 的 `oauthEmailType` 和 `oauthRelayDomainMatched`，方便后续解释为什么没有按真实 legacy email 自动合并。
- OAuth upsert 必须在服务端事务内完成。对 `(oauthProvider, oauthSubject)` 和 `normalizedEmail` 两个维度都要做幂等保护，避免 Google / Apple 同邮箱并发首次登录时各自创建 OneKeyID。
- 当前 OAuth identity 未绑定且存在 verified `normalizedEmail` 时，服务端必须先按该 `normalizedEmail` 获取 email claim 行级锁、唯一插入锁、或等价 advisory lock；在持锁状态下重新查询 OAuth binding、active legacy claim、email claim owner，再决定绑定到已有 OneKeyID 或创建新 OneKeyID。
- 创建新 OneKeyID 必须和创建 OAuth binding 在同一事务内完成；如果当前 OAuth identity 有 verified email，还必须在同一事务内创建 email claim。如果 email claim 插入发生唯一冲突，说明另一个并发请求已经确定 owner；当前请求必须重新读取 claim owner，并把 OAuth identity 绑定到该 owner OneKeyID，不能创建第二个 OneKeyID。
- legacy email OneKeyID 升级到 OAuth 登录方式 / 显式合并绑定 OAuth identity 时，如果当前 OAuth identity 有 verified email，也必须先锁定 OAuth email claim。若该 claim 已归属另一个 active OneKeyID，不能直接跨绑到当前 legacy email OneKeyID，必须进入显式合并或客服流程；若该 claim 不存在，绑定成功时必须在同一事务内创建 active email claim，owner 指向 target legacy email OneKeyID。没有 verified email 时跳过 email claim 处理，只绑定 OAuth identity。

登录 upsert 规则：

1. 先按 `(oauthProvider, oauthSubject)` 查询 OAuth binding。命中后必须读取 `boundOneKeyUserId` 对应的 OneKeyID 账号状态：若该账号是 `status = 'active'`，返回该 `onekeyUserId`；若该账号是 `status = 'merged'`，说明合并时 OAuth binding retarget 不完整，不能把链式解析当作正常登录路径，必须返回 `account_merged_reauth_required` / `support_required` 并触发服务端对账修复。
2. 未命中且 OAuth token 没有返回 verified email 时，不能做同 email 自动绑定，也不能创建 email claim；如果客户端没有提交可验证的 `legacyOneKeyIdAuthToken`，则可以创建新的 OAuth-only OneKeyID，并写入 `oauthEmailType = 'missing_or_unverified'` 的 OAuth binding。Apple 第二次登录默认不返回 email（Apple 在首次授权后不再下发 email claim）；命中规则 1 已有 OAuth binding 时正常返回，否则按本规则创建 OAuth-only OneKeyID 或进入显式合并。
3. 如果是 Apple private relay email，当前按独立账户处理：不匹配用户真实 legacy email，不做自动合并。但它仍要继续执行 legacy token 检查；如果客户端提交 `legacyOneKeyIdAuthToken` 且服务端验证它对应 active legacy OneKeyID，仍返回 `manual_merge_required`，避免直接创建分叉账号。
4. 其他 verified email，包括 Apple 返回的真实邮箱，优先在持有 `normalizedEmail` 锁的事务内查找 active legacy OneKeyID 的 `normalizedLegacyEmail`。正常情况下同一个旧 email 只能命中一个 OneKeyID；命中则服务端校验 OAuth credential 合法后，静默把当前 OAuth identity 绑定到该 legacy OneKeyID，不要求 Email OTP。若预检查或运行时发现同一个 `normalizedLegacyEmail` 命中多个 active legacy OneKeyID，视为历史数据完整性异常，返回 `support_required`，不能自动绑定或创建新账号。
5. 如果没有命中 legacy OneKeyID，再用 `normalizedEmail` 查找 active email claim owner。若命中一个 owner OneKeyID，必须确认 owner OneKeyID 仍为 `status = 'active'`，再静默绑定到该 OneKeyID；若历史数据缺少 email claim，可用已有 OAuth binding 回填 claim 后再绑定。若回填时发现同一个 `normalizedEmail` 出现在多个非 merged OneKeyID 的历史 OAuth identity 集合中，或 claim owner 已经不是 active OneKeyID，视为历史数据完整性异常，不能自动绑定或新建账号，返回 `support_required`。
6. 若没有可自动绑定的同 email OneKeyID，但客户端提交 `legacyOneKeyIdAuthToken` 且服务端验证它对应 active legacy OneKeyID，则返回 `manual_merge_required`，不要创建新的 OneKeyID。这里的 legacy token 只作为防止账户分叉的服务端校验信号，不作为直接绑定 proof，也不授予任何 legacy 账户权限。服务端**不持久化任何 pending merge 状态**，只签发短期加密签名 token `sourceOauthHandle`（含 `oauthIdentityId`、oauthProvider、oauthSubject、normalizedEmail?、iat、exp ≈ 15min），随响应返回。客户端缓存本次 OAuth credential 与 `sourceOauthHandle`，用于后续 `/merge/prepare`、`/merge/verify-target`；`/merge/confirm` 必须提交当前 OAuth credential，服务端重新校验该 credential，并要求它与 `sourceOauthHandle` / `finalConfirmHandle` 绑定的 canonical source 一致。
7. 只有既没有 OAuth binding、没有同 email 可自动合并 OneKeyID、也没有可验证的 `legacyOneKeyIdAuthToken` 时，才创建新的 OneKeyID。新建账号不写入 `legacyEmail`；如果当前 OAuth identity 没有 verified email，也不写 email claim。

Upsert 必须先尝试已有关联和同 email legacy email 自动合并；Apple private relay email 例外，当前按独立账户处理。如果 Apple 返回真实 verified email，则仍然参与同 email legacy email 自动合并。如果不存在 legacy OneKeyID，再锁定 `normalizedEmail` 对应的 active email claim owner 并绑定到该 owner；只有没有 claim owner、也无法从历史 OAuth binding 安全回填唯一 owner 时，才继续后续创建或 pending merge 判断。如果 OAuth identity 没有 verified email，则跳过同 email 自动绑定和 email claim 写入，直接检查 `legacyOneKeyIdAuthToken` 或创建 OAuth-only OneKeyID。如果客户端提交了可验证的 `legacyOneKeyIdAuthToken`，跨 email / 无 email 场景必须优先进入 pending merge / 显式合并，不能直接创建新 OneKeyID。最终合并必须同时校验当前 OAuth credential 和 legacy Email OTP；legacy token 不能替代这两个 proof。

### OAuth 与 Keyless 关系规则

服务端不建立 OneKeyID 到 Keyless wallet / `keylessWalletId` 的归属关系。Keyless 流程使用 OAuth identity + PIN；其中 OAuth identity 归属到 OneKeyID，落在 `IOneKeyIdOAuthBindingRecord` 中，PIN 只属于 Keyless wallet 能力：

- `IOneKeyIdOAuthBindingRecord` 仍保持 `(oauthProvider, oauthSubject)` 全局唯一，同一个 OAuth identity 只能归属一个 OneKeyID。
- 一个 OneKeyID 可以绑定多个 Google / Apple OAuth identity；这些 identity 可以来自普通登录，也可以来自不同设备 Keyless 流程中使用的 OAuth credential。
- `keylessWalletId`、`socialUserIdHash` 和其他 Keyless wallet metadata 只属于 Keyless wallet 本地能力、恢复流程或诊断信息，不作为服务端 OneKeyID 归属字段。
- 客户端本地可以缓存“当前设备 Keyless 流程使用的 OAuth identity 是否已归属当前 OneKeyID”的状态，但权威源始终是 OAuth identity 到 OneKeyID 的绑定关系，不存在 Keyless wallet 绑定表。

### 账号合并关系记录

如果执行显式账号合并，服务端必须记录 source / target 的关系，方便后续排查、客服、审计和幂等重试。`mergeRequestId` 必须全局唯一；`/merge/confirm` 进入执行阶段时，服务端先创建或锁定该 `mergeRequestId` 对应的 execution record，状态为 `processing`。执行成功后更新为 `merged`；执行失败必须在主合并事务外或独立审计事务中写入 `failed` / `support_required`，确保主合并事务回滚时仍保留结构化失败记录。`manual_merge_required`、`merge/prepare` 和 `merge/verify-target` 阶段不写 pending 记录，confirm 前的短期流程状态靠加密签名 token 在 `/merge/prepare` → `/merge/verify-target` → `/merge/confirm` 三次请求间传递；最终 source 仍以 `/merge/confirm` 提交并验证通过的当前 OAuth credential 为准。

接受的妥协：用户在 `/merge/confirm` 前取消、OTP 失败或 token 过期的尝试不入合并关系表；如需追溯这些未进入执行阶段的尝试，依赖各接口的请求日志或 OTP 服务自身的节流记录。

```ts
type IOneKeyIdMergeRelation = {
  mergeRequestId: string;
  sourceOneKeyUserId?: string;       // pending_oauth_bind 类型时为空（source 是 OAuth identity，无 source OneKeyID）
  targetOneKeyUserId: string;        // 合并完成后必填
  relationType:
    | 'pending_oauth_bind'            // source 是 OAuth identity（无 source OneKeyID），attach 到 target
    | 'merged_source';                // source OneKeyID 合并为 archive，active OAuth bindings 改写到 target
  status:
    | 'processing'                    // /merge/confirm 已进入执行阶段，防重复执行
    | 'merged'                        // 合并已完成
    | 'failed'                        // 合并执行失败的留痕记录
    | 'support_required';             // 合并中遇到无法自动判定的项，进入客服流程
  reason:
    | 'oauth_email_mismatch'
    | 'apple_private_relay'
    | 'local_legacy_session'
    | 'user_requested_merge'
    | 'support_created';
  sourceOauthProvider?: 'google' | 'apple';        // 触发合并的主 source identity（来自 /merge/confirm 当前 OAuth credential 或 source OneKeyID 上当前登录的 identity）
  sourceOauthSubject?: string;              // 同上
  sourceOauthIdentityId?: string;                   // 同上；服务端 hashId，用于和 OAuthIdentityCredentialStorage / profile 交叉验证
  sourceVerifiedEmail?: string;                     // 同上
  // source identity retarget 记录见子表 IOneKeyIdMergeIdentityRetarget
  targetLegacyEmail: string;        // 合并完成后必填（当前实现下 target 永远是 legacy email OneKeyID）
  verificationMethods: Array<'source_oauth' | 'legacy_email_otp'>;
  identityStatus: {
    oauthIdentity?: 'retargeted_to_target' | 'bound_to_target' | 'failed' | 'support_required';
  };
  createdAt: string;                  // 进入 /merge/confirm 执行阶段时创建
  updatedAt: string;
};
```

source 可能持有多个 OAuth identity。source OneKeyID 已存在时，合并必须把这些 active OAuth bindings 改写到 target；source 只保留为只读 archive，不参与 OAuth 登录热路径。`IOneKeyIdMergeRelation` 主表只记录"触发合并的主 source identity"，所有被 retarget 到 target 的 source identity 详情落子表：

```ts
type IOneKeyIdMergeIdentityRetarget = {
  mergeRequestId: string;             // FK → IOneKeyIdMergeRelation.mergeRequestId
  sourceOneKeyUserId: string;         // OAuth binding 原先指向的 source
  targetOneKeyUserId: string;         // OAuth binding 改写后的 target
  oauthIdentityId: string;            // 服务端 hashId；与 IOneKeyIdOAuthBindingRecord.oauthIdentityId 一致
  oauthProvider: 'google' | 'apple';
  oauthSubject: string;
  oauthEmail?: string;
  oauthEmailType: 'real' | 'apple_private_relay' | 'missing_or_unverified';
  retargetedAt: string;
};
```

子表索引建议：

- `(mergeRequestId)`：按合并请求反查哪些 identity 已改写到 target。
- `(oauthIdentityId)`：按服务端 OAuth identity hash 反查合并历史，并与本地 credential namespace 对账。
- `(oauthProvider, oauthSubject)`：按 identity 反查合并历史（与 `IOneKeyIdOAuthBindingRecord` 表交叉验证）。

记录规则：

- `mergeRequestId` 必须有唯一约束；`/merge/confirm` 按 `mergeRequestId` 幂等执行。
- 记录只在 `/merge/confirm` 进入执行阶段后写入，初始状态为 `processing`；`manual_merge_required`、`merge/prepare`、`merge/verify-target` 阶段不产生记录。
- 合并成功后把同一条记录更新为 `merged`；执行失败或需要客服介入时，把同一条记录更新为 `failed` / `support_required`。失败记录必须独立于主合并事务落库，不能因为主事务回滚而丢失。
- `sourceOneKeyUserId` 是 OAuth 新建或疑似分叉的 source OneKeyID；当 `relationType = 'pending_oauth_bind'` 时为空（source 是 OAuth identity 而非 OneKeyID）。
- `targetOneKeyUserId` 是 legacy email OneKeyID，合并完成后必填。
- `pending_oauth_bind`：source 是 OAuth identity，合并仅把该 identity attach 到 target legacy OneKeyID，不涉及 source 数据迁移。
- `merged_source`：source OneKeyID 合并为只读 archive，active OAuth bindings 改写到 target，OAuth identity 处理结果按 `identityStatus` 字段标注。
- 同一个 canonical source 在同一时间只能有一个未完成合并任务。`mergeRequestId` 负责单次 confirm 重试幂等；source-level execution lock 负责阻止同一个 source 并发发起第二个合并任务。只要该 source 已存在未完成 `processing` relation，其他相同 source 的新请求直接拒绝并返回 `source_merge_in_progress`，不再尝试按不同 target 合并或排队。
- 后续客服、风控、OAuth identity 归属排查必须能通过任一 OneKeyID 查到关联的 source / target。
- 进入 `/merge/confirm` 执行阶段后的分叉 / 合并关系不允许只靠日志追踪，必须有结构化数据库记录。

### 服务端接口边界

新增、调整和废弃的服务器接口统一整理在 [server-apis.md](./server-apis.md)。本节只保留服务端数据模型、归属规则和合并执行规则；流程章节只按场景引用接口名称。

### Email + OTP 下线策略

- 主登录入口是 Google / Apple OAuth。
- Email OTP 只作为旧客户端兼容能力，提供给已经存在 legacy email OneKeyID 的用户登录 / 找回 / 查看。
- 用户不能用新的 email 走 Email OTP 登录或注册。
- 新用户不允许通过 Email + OTP 创建 OneKeyID。
- 旧用户普通登录入口不展示 Email + OTP。
- 旧客户端兼容期内保留 legacy email 登录能力，但仅限旧用户找回 / 查看使用，防止 OAuth 合并故障后用户无法找回原 legacy email OneKeyID。新版本客户端不展示 legacy Email + OTP 登录入口。
- legacy email 登录入口不支持创建新 email 账户；如果 email 不存在 legacy OneKeyID，不能注册。
- legacy email 找回接口必须防止账号枚举。无论 email 是否存在，前端展示中性文案，例如“如果该邮箱有关联账户，我们会发送验证码或后续指引”；服务端错误码、发送节流和响应时间不要暴露账号是否存在。
- 旧客户端 legacy email 登录成功后**完全等同于普通 OneKeyID 登录态**，不做额外功能限制：可查看 / 操作原 OneKeyID 下账号数据、可修改账户安全设置、可使用钱包能力。Cloud Sync 仍属于 Keyless wallet 能力流程，不作为 OneKeyID 账号数据处理。新版本客户端的正式登录态不通过 API-11 建立，而应通过 Google / Apple OAuth 和 API-01 建立。
- 如果用户要合并到当前 OAuth 新账号，必须先拉起 Google / Apple OAuth 获取当前 OAuth credential，再用 legacy Email OTP 完成合并确认。仅 legacy Email OTP 不能单独完成跨 email 合并。
- 新版本客户端不提供 `Sign in legacy OneKeyID` 入口；旧版本客户端如果仍保留 Email + OTP 入口，只能服务已有 legacy email OneKeyID，不能创建新 email 账户。
- 后端需要区分普通 OAuth 登录、legacy email 找回、迁移 / 合并场景，避免旧接口被继续当作主登录入口。
- 服务端 Email + OTP 注册能力立即下线，具体接口行为见 [server-apis.md](./server-apis.md)。登录 / 找回接口只作为旧客户端兼容能力保留，老客户端的已有 legacy email 登录路径不受影响；老客户端遇到新 email 登录 / 注册诉求时提示升级 App 并改走 Google / Apple。
- 该能力下线**不**依赖客户端版本 gating（避免 User-Agent 伪造）；登录 / 找回接口在 Phase 5 之前都保持兼容老客户端。
- 前端只能根据 OneKeyID 服务端返回的 legacy flow 状态进入 Email OTP 找回 / 合并流程，不能直接调用通用 Supabase Email OTP 注册 / signup 路径来创建或探测新 email 账户。即使底层 OAuth / OTP SDK 仍有 email OTP 能力，普通登录页和新用户路径也必须被服务端状态禁止；老版本客户端误走注册请求时由服务端统一拒绝。

## 客户端迁移方案

### 登录入口

`useOneKeyAuth.loginOneKeyId()` 需要从 Email dialog 改为 Google / Apple provider selector：

- 移除普通路径里的 `PrimeLoginEmailDialogV2`。
- `EmailOTPDialog` 不再用于新版本 OneKeyID 普通登录，也不提供新版本 legacy email 登录入口；Email OTP 只保留给显式合并 target 验证等必要流程，以及旧客户端兼容路径。
- 新版本客户端不提供低曝光 `Sign in legacy OneKeyID` 登录入口；旧版本客户端的 legacy email 登录 / 找回由旧接口兼容，且不支持新 email 注册。
- Google / Apple 登录成功后，统一调用 OneKeyID login bridge。
- 登录完成后刷新 `primePersistAtom`，并缓存后续 Keyless 场景可复用的 OAuth credential。
- 如果服务端返回 `manual_merge_required`，客户端不能把这次 OAuth 登录当作新账号登录完成；必须进入 pending merge state，展示显式账号合并入口，避免自动创建新 OneKeyID 导致账户分叉。
- 登录流程不触发 Keyless PIN，也不主动执行 Keyless create / restore / bind。

### Keyless create / restore 与 OAuth 归属触发

Keyless wallet 采用 lazy create。OneKeyID 登录成功后不自动创建 Keyless wallet；只有用户进入需要 Keyless wallet 的场景时，才创建或恢复。OAuth identity 归属到 OneKeyID 是单独流程，不代表 Keyless wallet 本身归属到 OneKeyID。

Keyless PIN 的权威规则：**OneKeyID 登录流程永远不出现 Keyless PIN**。无论是 Google / Apple 登录、`Continue with existing Keyless wallet`、legacy Email OTP 找回、同 email 自动绑定、跨 email 显式合并，PIN 都不参与 OneKeyID 身份登录或账号绑定。Keyless PIN 只属于 Keyless wallet 创建、恢复、重置 PIN、verify PIN、Cloud Sync 解密 / 重加密等钱包能力场景。

Keyless 不在登录场景中触发。OAuth identity 归属到 OneKeyID 与 Keyless wallet 的创建 / 恢复 / 验证是两类流程：

1. OAuth 归属到 OneKeyID：读取当前设备可用的 OAuth credential；如果本设备尚未创建 / 恢复 Keyless wallet，则复用当前 OneKeyID 登录 OAuth credential 进入 Keyless 创建 / 恢复流程。若当前 OneKeyID 是 OAuth 登录态，OAuth identity 已经通过 API-01 归属；若当前登录态是 legacy email OneKeyID 且尚未绑定 OAuth identity，进入 Keyless 能力前只能跳转到用户明确确认的升级 / 合并流程（API-03 或 API-04 到 API-06），不能在后台静默绑定。服务端校验 credential 合法性；不要求 Keyless PIN。
2. 同 email 绑定静默完成，不要求 Email OTP。
3. 跨 email 绑定到当前已登录 legacy email OneKeyID 时，必须由用户主动触发；服务端同时校验 request body 里的 `legacyOneKeyIdAuthToken` 和 OAuth `token`，不再额外要求 legacy Email OTP。
4. 创建、恢复、重置 PIN 或验证 Keyless wallet：读取当前设备可用的 OAuth credential，然后进入 Keyless PIN / wallet proof 环节。
5. 如果本设备 credential 失效或缺失，再要求用户重新走 Google / Apple 登录。
6. OAuth identity 归属确认后，客户端可在本地派生并缓存当前设备 Keyless 流程使用的 OAuth identity 绑定状态。这个状态不是 `/profile` 服务端返回字段，例如：

```ts
type IOneKeyIdOAuthBindingLocalInfo = {
  oauthIdentityId: string; // 服务端 OAuth identity 稳定 ID；当前沿用服务端基于 OAuth token 生成的 hashId
  oauthProvider: 'google' | 'apple';
  oauthSubject: string;
  oauthIdentityKey: string; // `${oauthProvider}:${oauthSubject}`，仅用于交叉校验和调试，不作为本地 credential key
  onekeyUserId: string;
  bindingStatus:
    | 'bound' // 当前 OAuth identity 已经归属 onekeyUserId，可作为正常绑定态展示。
    | 'pending' // 客户端处于 manual_merge_required / 升级或显式合并等本地中间态；不是服务端登录接口 response 状态。
    | 'conflict'; // 客户端发现当前 OAuth identity 与本地预期账号不一致或需要用户处理；权威判断仍以服务端为准。
  updatedAt: string;
};
```

示例：

```ts
const oauthIdentityBindingLocalInfo: IOneKeyIdOAuthBindingLocalInfo = {
  oauthIdentityId: 'hash_8f2b4e6c9a1d0c7b3e5f',
  oauthProvider: 'google',
  oauthSubject: '108204857102938475610',
  oauthIdentityKey: 'google:108204857102938475610',
  onekeyUserId: 'onekey_A',
  bindingStatus: 'bound',
  updatedAt: '2026-05-24T10:00:00Z',
};
```

OAuth identity 归属只表示当前设备 Keyless 流程使用的 OAuth identity 归属到 OneKeyID，不表示 Keyless wallet 本身归属于 OneKeyID，也不引入额外的 `walletRecoveryVerified` 前置状态。统一账户绑定不校验 Keyless wallet 是否已经完成一次恢复演练，也不要求 Keyless PIN；Keyless wallet 的创建、恢复、重置 PIN 和 verify PIN 始终属于 Keyless 能力流程，恢复材料和 PIN 校验由 OAuth + PIN 流程负责，和 OneKeyID 身份绑定解耦。

存储位置：该结构由 **jotai persistAtom**（AsyncStorage 持久化）保存，**不落本地 DB（Realm / IndexedDB）**，因此不涉及 `LOCAL_DB_VERSION` bump，也不需要修改 Realm / IndexedDB schema。OAuth identity 归属状态权威源始终是服务端 `IOneKeyIdOAuthBindingRecord`；本地 persistAtom 仅作为加速冷启动渲染的缓存。本地缓存必须按 `oauthIdentityId` 匹配当前 OAuth identity，不能只缓存 `onekeyUserId + bindingStatus`，也不能用 email 做 key。`oauthProvider + oauthSubject` 只用于交叉校验和调试展示，不作为本地 credential / binding cache 主键。否则用户切换 Google / Apple、Apple private relay 或不同 provider 同 email 时，客户端可能把上一条 identity 的 `bound` 状态误套到当前 identity。本地缓存丢失（用户清数据、重装、AsyncStorage 损坏）时客户端通过 `GET /prime/v1/account/profile` 重新拉取 `identities`，并用当前设备 Keyless 流程使用的 OAuth identity 匹配其中的 `identityType = 'oauth'` 元素回填，不影响功能可用性；首次启动 atom 未 hydrate 完成期间，账户页 Keyless 状态可能短暂处于 loading，可接受。

### 本地已有 Keyless session 的升级处理

这里的“本地已有 Keyless session”指本地已经存在 Keyless wallet，并且可以从本地安全存储读取或刷新出 OAuth credential，且用户后续进入 Keyless 能力时还需要 PIN。它不等同于 OneKeyID 已登录，也不代表登录流程需要弹 Keyless PIN。

本地 Keyless wallet 正常情况下只有一个，因此不需要用 `socialUserIdHash`、`keylessWalletId` 或其他 Keyless wallet metadata 做“候选 Keyless wallet”选择。OneKeyID 归属判断只使用当前 OAuth credential：

- `socialUserIdHash` 和 Keyless wallet metadata 可以继续作为 Keyless wallet 内部状态、恢复流程或诊断信息。
- 它们不参与 OneKeyID 自动合并判断。
- 它们也不是 OAuth identity 归属到 OneKeyID 的认证材料。
- 服务端必须同时校验 request body 里的 `legacyOneKeyIdAuthToken` 和 OAuth `token`；跨 email 绑定到当前已登录 legacy email OneKeyID 时不再额外要求 legacy Email OTP。
- Keyless PIN 不参与 OneKeyID 绑定；PIN 只参与 Keyless wallet 能力。

如果 legacy email OneKeyID 已经登录：

1. 保留当前 legacy email OneKeyID 登录态，作为本次迁移的 target legacy email OneKeyID。
2. 如果当前 OAuth credential 的 verified `normalizedEmail` 命中当前 legacy email OneKeyID 的 `normalizedLegacyEmail` 或 active email claim，则服务端校验 OAuth credential 后静默绑定，不要求 Email OTP。
3. 如果 email 不同，不做 OAuth identity 到当前 legacy email OneKeyID 的自动绑定，也不静默创建新的 OneKeyID。保留当前 legacy email OneKeyID 登录态，并引导用户进入 legacy email OneKeyID 升级到 OAuth 登录方式流程或显式合并流程。
4. 如果用户主动选择把当前 legacy email OneKeyID 升级到 OAuth 登录方式，可以进入升级到 OAuth 登录方式流程。Keyless 创建 / 恢复入口可以触发该流程，但该流程只服务于当前已登录 legacy email OneKeyID，不扩展为通用跨 email 账户合并。
5. 不在登录或启动流程中弹 Keyless PIN。OAuth 绑定只在用户进入账户升级或 Keyless 相关场景时触发；同 email 静默绑定，跨 email 使用 request body 里的 OAuth `token` + `legacyOneKeyIdAuthToken`。
6. 这里的 email 判断只用于 OneKeyID OAuth identity 归属判定，不用于 Keyless wallet PIN 校验；Keyless wallet 创建、恢复、重置 PIN 或验证仍走 OAuth credential + PIN。

如果 legacy email OneKeyID 未登录：

1. 如果本地 Keyless session 中的 OAuth credential 可用，登录页 / OneKeyID 登录弹窗展示“已登录的 Keyless wallet”继续入口，例如 `Continue with existing Keyless wallet`。用户点击继续后，客户端复用该 OAuth credential 调用 OneKeyID login / upsert，建立 OneKeyID 登录态，不重复拉起 Google / Apple，也不要求用户手动选择 Apple / Google。
2. 如果本地 OAuth credential 不可用或刷新失败，保持未登录状态，等待用户主动走 Google / Apple 登录。
3. OneKeyID 登录态建立后，不触发 Keyless PIN。后续如果需要把当前 OAuth identity 归属到 OneKeyID，同 email 静默绑定；只有当前登录态是 legacy email OneKeyID，且用户主动把该 legacy email OneKeyID 升级到 OAuth 登录方式时，才允许使用 API-03 通过 request body 里的 `legacyOneKeyIdAuthToken` + OAuth `token` 直接绑定。OAuth-only OneKeyID 不能进入该主动升级流程。只有用户进入创建、恢复或验证 Keyless wallet 时，才进入 PIN。
4. 如果本地 OAuth credential 已绑定或解析到当前 OneKeyID，即使 provider / subject 与当前登录使用的 OAuth identity 不同，也视为同一 OneKeyID 下的有效 OAuth identity。只有当该 OAuth identity 已绑定或解析到另一个 active OneKeyID 时，本地 Keyless wallet 才保持未归属当前 OneKeyID，并在 Keyless 场景中提示账号不匹配。**钱包列表不展示不属于当前 OneKeyID 的 wallet**：UI 按"当前 OneKeyID 已归属的 OAuth identity"过滤；用户切回原 OneKeyID 才能看到。本地 Keyless wallet 数据本身仍保留在 secure storage 中，**不删除**，避免切换登录态导致资产无法找回。

### 已登录 legacy email OneKeyID 升级到 OAuth 登录方式例外

这里讨论的是“把当前 legacy email OneKeyID 升级到 Google / Apple OAuth 登录方式”，不是给账号绑定新的 legacy email，也不是给 OAuth-only OneKeyID 添加另一个 OAuth provider。当前登录态必须是 legacy email OneKeyID；request body 里的 `legacyOneKeyIdAuthToken` 是 target legacy email OneKeyID proof，OAuth `token` 是待绑定 identity proof。

自动绑定只允许 verified `normalizedEmail` 命中 target legacy email OneKeyID 的 `normalizedLegacyEmail`。同 email 绑定静默完成，不要求 Email OTP。跨 email、Apple private relay 或无 verified email 的升级例外是：用户已经登录 legacy email OneKeyID，并且明确要把当前 OAuth identity 归属到这个 legacy email OneKeyID；服务端同时校验 body 里的 `legacyOneKeyIdAuthToken` 和 OAuth `token` 后直接绑定。

该例外必须同时满足：

1. target OneKeyID 必须是当前设备上已经登录的 legacy email OneKeyID，不能由服务端自动挑选。
2. 用户必须从账户安全或升级入口主动发起，不能在登录、启动或后台同步中静默触发。
3. 服务端必须通过 API-03 同时校验 body 里的 `legacyOneKeyIdAuthToken` 和 OAuth `token`；客户端不能只根据本地 email mismatch 自行改写绑定状态。
4. UI 必须同时展示当前 legacy email OneKeyID email 和将绑定的 OAuth identity display，并要求用户明确确认；如果 OAuth identity 没有 verified email，UI 只能展示 oauthProvider / identity display，不能用本地缓存 email 补文案。
5. 服务端必须校验 OAuth credential 合法性。
6. 本流程不要求 legacy Email OTP，也不要求 Keyless PIN。
7. 该 OAuth identity 如果已经绑定到另一个 active OneKeyID，则不能自动迁移，需要进入显式账号合并或人工处理。
8. 如果该 OAuth credential 的 verified email 已经有 active email claim owner，且 owner 不是当前 legacy email OneKeyID，也不能直接跨 email 绑定到当前 legacy email OneKeyID；必须先进入显式账号合并或客服流程，避免同一 OAuth email 分裂到多个 OneKeyID。
9. 绑定完成后，当前 legacy email OneKeyID 保持为主账号；绑定只改变 OAuth identity 归属，不迁移任何 OneKeyID 业务数据。Cloud Sync 不随 OneKeyID 绑定处理，仍由 Keyless wallet / Cloud Sync 流程决定。

该例外只用于“已登录 legacy email OneKeyID 主动升级到 OAuth 登录方式”这一条路径；Keyless 创建 / 恢复入口可以触发它，但它不是 Keyless wallet 绑定。其他跨 email 合并诉求仍然不进入自动流程。

如果 OAuth identity 已经绑定到另一个 OneKeyID A，再转移到当前 legacy email OneKeyID B，这不是本接口的升级例外，而是显式账号合并。客户端必须走 `/merge/prepare`、`/merge/verify-target`、`/merge/confirm`；最终由 `/merge/confirm` 把 source A 标记为 `merged`，并把 source active OAuth bindings 改写到 target B。

### OAuth 新建账户后的显式合并

场景：用户曾经注册过 legacy email OneKeyID，但在全新客户端使用 Google / Apple OAuth 登录。由于 OAuth email 与 legacy email 不同，或者 Apple private relay 被按独立账户处理，系统创建了新的 OneKeyID。之后用户想起自己还有 legacy email 账户，希望把两个 OneKeyID 合并成一个。

这个场景不进入自动合并，只能走用户主动发起的显式账号合并流程。显式处理分两种模式：

1. `pending_oauth_bind`：OAuth upsert 时因为本地 legacy 登录态 / 登录凭证返回 `manual_merge_required`，服务端还没有创建 OAuth source OneKeyID。用户完成 legacy Email OTP 后，直接把当前 OAuth identity 绑定到 target legacy OneKeyID，不产生需要迁移数据的 source 账号。
2. `merged_source`：用户已经用 OAuth 创建并登录了新的 OneKeyID，之后从低曝光入口主动合并 legacy OneKeyID。此时 source OneKeyID 已存在，本方案把 source active OAuth bindings 改写到 target，source 只保留 archive / merge relation，不迁移 source OneKeyID 下的业务数据。

触发时机和入口：

- 默认不提示，不因为“当前是 OAuth 新账号”就展示合并提醒，否则会影响正常新用户。
- 提供一个低曝光手动入口，给有需要的老用户自助处理。统一入口为 Account Security / Advanced / Need help? 下的 `Merge existing OneKeyID`，也可以在账户页 `More` / `Advanced` 中露出同一个入口；不放在首页、登录完成页或主按钮区。
- Apple private relay、Google 不同邮箱、Apple 真实邮箱但不同于 legacy email 等 OAuth 新建账户后的分叉场景，都复用这个通用入口，不单独设计 Apple private relay 专属入口。
- 只有出现强信号时才展示轻提示，例如：
  - 本地有 legacy OneKeyID 登录态、历史登录凭证或历史 `onekeyUserId` 记录。
  - 本地有 legacy 登录痕迹，或旧版 Email + OTP 登录痕迹。
  - 客服发起或恢复 merge request。
- 用户主动表示要找回旧 legacy OneKeyID 时才展示提示。仅有 Keyless / Cloud Sync 使用痕迹不触发 OneKeyID 合并提示；Cloud Sync 相关提示走 Keyless wallet / Cloud Sync 自身流程，不作为 OneKeyID 找回入口触发条件。
- 提示必须低干扰：不使用全屏弹窗，不阻断当前流程；可关闭；关闭后按账号和设备限频，例如 30 天内不再主动提示。
- 不在普通 Google / Apple 登录成功页强制要求合并，避免阻断新用户；但如果客户端提交了可验证的 `legacyOneKeyIdAuthToken`，应优先返回 `manual_merge_required` 并引导合并，避免账户分叉。真正执行合并时仍必须同时校验当前 OAuth credential 和 legacy Email OTP。

流程：

1. source 可以是当前已登录 OAuth 新 OneKeyID，也可以是 confirm 时提交的 pending OAuth identity；`manual_merge_required` 产生的 `sourceOauthHandle` 只是前置流程使用的加密签名短期 token，不需要服务端持久化。
2. 用户从账户页低曝光入口、账户安全二级入口、受限轻提示或客服链接进入“合并已有 OneKeyID”；如果来自 `manual_merge_required`，客户端带上 `sourceOauthHandle` 与缓存的 OAuth credential。
3. 用户输入 legacy email 后，客户端调用 `/merge/prepare` 获取中性的发码上下文；在 OTP 通过前不暴露 target 是否存在或 target 数据摘要，也不直接发送 OTP。
4. 客户端调用独立 `POST /prime/v1/general/emailOTP` 发送 legacy Email OTP，并在用户输入验证码后把验证码校验信息交给 `/merge/verify-target`，确认用户控制 target legacy OneKeyID。
5. 服务端校验当前 Google / Apple OAuth credential，确认用户控制 source OAuth identity；如果 source 是已登录 OAuth OneKeyID，同时确认当前 session 仍有效。
6. UI 展示合并摘要，包括 target email、当前将随 confirm 提交的 OAuth identity、该 OAuth identity 将改写 / 绑定到 target 的结果，以及 source OneKeyID 是否会被标记为 merged。若 source OneKeyID 已存在，摘要还要说明 source 下其他 active OAuth identities（如有）也会一起 retarget 到 target。若来自 `sourceOauthHandle` 路径，摘要明确说明本次没有 source OneKeyID 数据迁移，confirm 后只会把当前提交的 OAuth identity 绑定到 legacy OneKeyID。API-06 必须校验最终提交的 OAuth credential 与 API-05 确认页展示的 canonical source 一致；如果用户在确认页后切换 OAuth credential，不能把新的 identity 合并到已确认的 target，必须返回 mismatch 错误并要求重新走 verify-target。
7. 用户确认后执行合并 / 绑定。默认 target 是 legacy email OneKeyID；若 source OneKeyID 已存在，则 source 是 OAuth 新 OneKeyID；若来自 `sourceOauthHandle` 路径，不创建 source OneKeyID。

受控合并原则：

- 用户不是在两个账户里二选一；合并目标固定为 legacy OneKeyID，source OneKeyID 不物理删除。
- 跨 email 显式合并的校验条件固定为当前 Google / Apple OAuth credential + legacy OneKeyID Email OTP，不要求 Keyless PIN，也不额外要求其他登录方式。
- 默认策略是优先合并到 legacy email OneKeyID。source OAuth 新建 OneKeyID 已存在时，不再作为主账号使用，标记为 merged；source 尚未创建时，直接把 OAuth identity 绑定到 target legacy OneKeyID。
- source OneKeyID 已存在时，它不是孤儿 ID，也不是物理删除。它会变成 target OneKeyID 下的 merged source archive。
- source OneKeyID 已存在时，它废弃为登录主体；其账号数据、引用关系、审计记录默认长期保留在 source archive 中，方便用户未来找回和客服核对。
- source OneKeyID 已存在时，source active OAuth bindings 必须改写到 target；如果是 `pending_oauth_bind`，则没有 source OneKeyID，只绑定 confirm 时提交的 OAuth identity 到 target。
- source OneKeyID 已存在时，其数据不因合并流程物理删除；合并成功也要保留只读 archive 和 merge relation，方便客服排查和审计。
- source OneKeyID 下的业务数据**不迁移到 target** 是已定方案，不作为本迁移的待修问题。合并只改变 active OAuth bindings 归属和 source 登录主体状态；source 业务数据保留为只读 archive，不继续作为正常可写账号数据使用。
- 合并确认页必须明确展示“OAuth identity 将改写到 target，或在 pending OAuth 场景直接绑定到 target；source OneKeyID 是否会废弃为登录主体；source archive 会保留哪些只读记录”。

业内更常见的做法是 tombstone / archive + binding retarget：

- source user id 保留为 archive，不再接受新写入和新登录态。
- source active OAuth bindings 改写到 target；用户再次用 source OAuth identities 登录时直接命中 target。
- 所有合并动作写审计日志，不直接删除 source 记录。
- source account 不物理删除；账号数据保留在 source archive 中，source active OAuth identities 直接绑定到 target。
- 后续可选：在 target 账号下提供低曝光只读入口查看历史合并账号。MVP 阶段不要求用户侧入口，用户需要查询时先通过客服 / 风控查询 merge relation 和审计记录。

后续可选只读入口（非 MVP 必需）：

- 如果产品后续需要自助查看，入口可放在 Account Security / Advanced / Need help? 下，例如 `Merged accounts` 或 `Previous accounts`。
- 只有 target 存在 merged source 记录时才展示；正常新用户不可见。
- 展示 source 的 masked email / oauthProvider、合并时间、merge request id、OAuth identity 处理状态。
- 允许用户只读查看 source 的基础账号摘要、OAuth identity 归属状态和客服处理状态。Cloud Sync 状态不在 OneKeyID merged source 视图中展示。
- 不提供切回 source 账号继续使用的入口；source 只用于查看、找回、客服核对和审计。
- MVP 阶段可以不展示该入口；客服 / 风控 scoped auth 仍可按 merge relation、审计日志或内部工具查询。

合并规则：

- 身份合并本身不要求 Keyless PIN；只有进入 Keyless wallet 能力流程（包括 Cloud Sync 所需的 Keyless 数据解密、恢复或重加密）时，才按对应钱包能力要求 PIN 或本地解密凭证。
- source active OAuth bindings 改写到 target，并把 source OneKeyID 标记为 merged。source OneKeyID 下的业务数据不迁移到 target。
- OAuth identity：source OneKeyID 已存在时，source 上的 Google / Apple active OAuth bindings 改写到 target；服务端在同一事务内把 source active email claim 迁移到 target，并记录 identity retarget。后续 OAuth 登录直接命中 target binding 并返回 target session。如果是 `pending_oauth_bind` 且不存在 source OneKeyID，则直接把 OAuth identity 绑定到 target；只有当前 OAuth identity 有 verified email 时，才在绑定时创建 target active email claim。`(oauthProvider, oauthSubject)` 仍保持全局唯一。
- Keyless wallet：不作为 OneKeyID 账号合并数据迁移。source 上的 OAuth identities 按 retarget 后的 target binding 登录；Keyless wallet 本地数据、PIN、恢复材料仍走 Keyless 能力流程。不能把 `keylessWalletId` 写入账号合并关系，也不能因为合并删除本地 Keyless wallet。
- 登录行为：source OneKeyID 废弃为登录主体并标记为 merged。后续用户用 source OAuth identities 重新登录时，返回 target OneKeyID 并签发新的 target session。
- 旧 session：source OneKeyID 合并完成后，服务端必须立即 revoke source 旧 AUTH token、session 和 scoped token。旧 session 不能继续写入 source，也不能透明写入 target；服务端应返回 `account_merged_reauth_required` / 401，客户端清理本地 OneKeyID token / `primePersistAtom` 后，报错并回到登录界面，让用户手动重新发起 Google / Apple 登录。
- Cloud Sync：不属于 OneKeyID 账号合并数据，不写入 `IOneKeyIdMergeRelation` 的身份处理状态，不在合并摘要和 merged source 视图中记录状态。用户后续需要 Cloud Sync、同步模式切换或数据恢复时，走现有 Keyless wallet / Cloud Sync 流程。
- 本地钱包与资产账户：不删除本地钱包、不迁移私钥、不重建资产账户。合并只改变 OneKeyID 归属和云端账户关系，本地钱包顺序、账户、DApp 连接、Bot Wallet 关系保持不变。
- 审计与留痕：保留 merge request id、source / target OneKeyID、验证方式和操作时间。source 数据不因迁移物理删除，默认长期保留只读 archive 和引用关系；只有独立的合规删除、用户删除或法务流程可以触发数据删除评估，不能把账号合并成功作为清理 source 数据的条件。
- 分叉关系记录：`/merge/confirm` 进入执行阶段后必须写入 `IOneKeyIdMergeRelation`，记录 source / target、触发原因、验证方式、OAuth identity retarget 状态，方便未来通过任一 OneKeyID 反查关联账号。`manual_merge_required`、`prepare`、`verify-target` 阶段不持久化 pending merge state。

source 下的 OneKeyID 业务数据不进入本次迁移的自动处理范围，仍归属于原 OneKeyID；合并只改变 active OAuth bindings 归属和 source 登录主体状态，不做业务数据归属改写。

这个流程和“已登录 legacy email OneKeyID 升级到 OAuth 登录方式”是两个方向不同的流程：

- legacy email OneKeyID 已登录并升级到 OAuth 登录方式：target 是当前 legacy email OneKeyID，只让新的 OAuth identity 归属到当前 legacy email OneKeyID；后续 Keyless 场景可以复用该 OAuth credential。
- OAuth / pending OAuth 合并 legacy：source 可能是当前 OAuth 新 OneKeyID，也可能只是 confirm 时提交的 OAuth identity（`sourceOauthHandle` 路径）。target 是用户通过 Email OTP 验证的 legacy OneKeyID；如果 source OneKeyID 已存在，把 source active OAuth bindings 改写到 target，不迁移 source 业务数据。

两个均无 `legacyEmail` 的 OneKeyID 之间**不提供合并路径**：

- 若两者 OAuth identity 的 `normalizedEmail` 相同，跨 provider 自动合并规则（同 active email claim owner 自动归并）已在创建第二个 identity 时阻止分叉，不会落成两个独立 OneKeyID。
- 若两者 `normalizedEmail` 不同，视为用户主动持有的两个独立账号，**不提供自助合并入口，也不进入客服流程**。用户通过统一 logout 清理凭证和本地 Keyless wallet 后，用另一个 OAuth provider 重新登录在两个账号间切换。
- 显式合并入口（`Merge existing OneKeyID`）只接受 target 是 legacy email OneKeyID 的合并请求；不支持 OAuth-only → OAuth-only。
- 这里的“不支持 OAuth-only → OAuth-only”只禁止跨 email 显式合并；如果两个 OAuth identity 返回相同 verified `normalizedEmail`，且当前 OAuth identity 未归属任何 OneKeyID，仍必须按同 email 自动合并规则绑定到同一个 OneKeyID。
- OAuth-only OneKeyID 没有 legacy Email OTP 恢复例外。如果用户失去某个 OAuth provider 账号访问权（例如 Google 账号被封、Apple ID 停用、Workspace 邮箱被回收 / reassign），且该 OneKeyID 没有仍可用的已绑定 OAuth identity，也无法通过另一个 provider 返回相同 verified `normalizedEmail` 触发同 email 自动绑定，则 OneKey 不提供 Email OTP、客服人工改绑、跨 email 证明或其他恢复通道。客服只能解释边界和协助确认状态，不能把其他 email / OAuth identity 手动改绑到该 OAuth-only OneKeyID。

### OAuth credential 存储边界

账号合并只和 OAuth identity 有关。这里要解决的问题是让 OneKeyID 登录与后续 Keyless wallet 能力复用同一份 OAuth credential，而不是把 Keyless wallet 的本地 secret、PIN、恢复材料或 metadata 纳入账号合并。

新方案下 OAuth credential（access token / refresh token / id token）**只存一处：OAuth identity credential namespace**。OneKeyID 登录和后续 Keyless wallet 能力流程共享同一份 OAuth credential；OneKeyID 不能另存一份 Keyless 专用 OAuth cache，Keyless 也不能把同一份 OAuth credential 复制到 Keyless wallet secret namespace。

当前代码结论：**不能直接把旧 Keyless OAuth cache 原地作为统一权威 store**。旧实现可以复用 OAuth 登录、token refresh、secure storage 和加解密能力，但现有 cache 本身是 Keyless-owner 维度，不是 OAuth identity 维度：

- 当前 `keylessRefreshTokenStorage` 使用 `ownerId` 构造 `OneKey_Keyless_Token__${ownerId}` 和 `OneKey_Keyless_RefreshToken__${ownerId}`。
- 当前 `ownerId` 由 oauthProvider、social user id、Keyless backend 返回的 `hashId`、环境 discriminator 等材料再次 hash 得到；它是 Keyless wallet / Juicebox owner 派生 key，不是服务端 OAuth binding 的权威 ID。
- Keyless 服务端返回的 `hashId` 是根据 OAuth token / identity claims 生成的稳定 OAuth identity hash，当前公式是 `sha256(keylessWalletUserIdSalt + ':' + provider + ':' + userSub)`，可以直接作为统一登录里的 `oauthIdentityId`。问题不是 `hashId` 不稳定，而是旧本地 cache 使用的是二次派生后的 `ownerId`。统一 credential store 必须使用服务端 `hashId` / `oauthIdentityId`，不能使用本地 `ownerId`。
- `keylessWalletUserIdSalt` 一旦用于生成 `oauthIdentityId`，就属于账号身份兼容材料，不能随 Keyless wallet 迁移、服务重构或普通配置轮换改变。若未来必须换 salt，需要服务端提供新旧 `oauthIdentityId` 映射和客户端迁移，不允许静默生成另一套本地 credential key。
- 当前读取路径依赖本地 Keyless wallet 的 `keylessDetailsInfo.keylessOwnerId`，OAuth-only OneKeyID 登录、尚未 lazy-create Keyless wallet 的用户、以及多 OAuth identity 绑定场景都不能把这个 ownerId 当作统一 credential key。
- 当前 Supabase SDK session storage 也不能作为统一权威 store；它是 SDK 的当前 session cache，不是按 OAuth identity 分桶的 credential store。

确定方案：新增 / 重命名一个统一 `OAuthIdentityCredentialStorage` adapter，复用旧 Keyless OAuth 的 token 获取、refresh HTTP 调用、secure storage 写入和加密实现，但存储 key 改为服务端 `hashId`，并在 OneKeyID 账号模型中把该值命名为 `oauthIdentityId`。OneKeyID OAuth 登录、OAuth binding profile、Keyless create / restore / verify 相关接口都必须返回同一个 `oauthIdentityId = hashId`；服务端内部可以继续保留 `getKeylessWalletIdFromToken` 这类 legacy 方法名，但对 OneKeyID / 客户端协议输出必须使用 `oauthIdentityId`，避免把它误解为 Keyless wallet id。旧 `keylessRefreshTokenStorage` 不再作为新统一登录的写入目标，只保留为本地已有 Keyless wallet 的迁移只读来源。Keyless wallet 的 mnemonic password、PIN 相关材料、sync credential 等仍属于 Keyless wallet secret namespace。具体策略：

- **OAuth-only 用户**（含 Phase 2 之后的新用户、所有未持有旧 Keyless wallet 的用户）：首次 Google / Apple 登录时，服务端返回 `oauthIdentityId = hashId`，客户端直接把 OAuth credential 写入 OAuth identity namespace；该 namespace 只使用 `oauthIdentityId` 做索引，不包含 `onekeyUserId`、`keylessWalletId`、`socialUserIdHash`、`ownerId` 或任何 Keyless wallet metadata。Lazy-create Keyless wallet 时直接从这一处读取 OAuth credential，不需要、也不允许在两个 namespace 间迁移或复制。
- **本地已有 Keyless wallet 的用户**：旧 `keylessRefreshTokenStorage` 只作为迁移只读来源。迁移层在用户完成 OAuth 登录、Keyless PIN verify、token refresh，或任一能同时拿到当前 OAuth credential 和服务端 `oauthIdentityId = hashId` 的路径上，把旧 ownerId-keyed token 导入 / 移动到 `OAuthIdentityCredentialStorage`，并以 `oauthIdentityId` 建立索引。导入完成并确认统一 namespace 可读后，OneKeyID 登录 / 绑定层和 Keyless wallet 能力流程都只从 OAuth identity credential namespace 读取这同一份 credential；旧 Keyless credential cache 不能继续双写，也不能作为第二份权威凭证。登录 / 绑定层不能读取 Keyless wallet secret namespace 的实现细节，也不能用 Keyless wallet metadata 推断账号归属。
- **Legacy email 老用户升级期间**：legacy Email OTP 登录 OneKeyID 不产生 OAuth credential；只有用户完成 Google / Apple 授权，或本地 Keyless 模块提供可校验的 OAuth credential 后，才进入 OAuth identity 绑定或显式合并流程。
- 如果当前设备拿不到可用 OAuth credential，客户端要求用户重新走 Google / Apple 登录；不通过 Keyless wallet 本地 secret 或 metadata 做兜底。

清理边界：

- OAuth credential cache 的清理只能发生在 OAuth identity credential namespace 已确认可读、旧客户端兼容窗口结束、且旧 Keyless cache 不再是唯一可用凭证之后。
- OAuth credential 的写入 API 必须集中到同一个 `OAuthIdentityCredentialStorage` adapter；该 adapter 复用旧 Keyless OAuth 的底层 token refresh、secure storage 和加解密实现，但对上层只暴露 OAuth identity 语义，不暴露 `ownerId`。OneKeyID 登录、Keyless create / restore / verify、Cloud Sync 所需的 Keyless OAuth proof 都通过该 adapter 读写同一个 OAuth identity credential namespace，禁止在 OneKeyID namespace 和 Keyless namespace 各存一份相同 OAuth credential。
- 本次统一登录迁移不清理、不覆盖 Keyless wallet secret namespace，不影响 mnemonic password、PIN 相关材料、sync credential 或 Cloud Sync 数据。

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
| 登录页 / OneKeyID 登录弹窗 | `Continue with existing Keyless wallet` | 本地存在 Keyless wallet，且其 OAuth credential 可读或可刷新，但该 OAuth identity 尚未归属当前 OneKeyID 登录态 | 展示当前已登录 Keyless wallet，让用户点击继续；客户端复用本地 OAuth credential 调用 OneKeyID login / upsert。不在后台静默登录，也不要求用户重新选择 Google / Apple。 |
| 旧版本客户端 Email + OTP 入口 | `Sign in legacy OneKeyID` / 旧 Email 登录入口 | 仅旧客户端兼容期保留；新版本客户端不展示 | 进入 legacy Email + OTP 登录 / 找回流程。只允许已有 `legacyEmail` 的旧用户继续；不支持新 email 创建；前端和服务端都不能泄露 email 是否存在。旧客户端遇到新 email 登录 / 注册诉求时提示升级 App 并改走 Google / Apple。 |
| 登录页 / OneKeyID 登录弹窗 | 移除 Email + OTP 主入口 | 所有用户 | 不再展示 `Continue with OneKey ID` 后输入 email 的普通登录路径。 |
| OAuth 登录后的 pending merge 页面 | `Merge existing OneKeyID`、`Use another Google / Apple account`、`Contact support` | 服务端返回 `manual_merge_required` | 不写入普通登录态，不设置 `isLoggedInOnServer = true`。用户必须完成当前 OAuth credential + legacy Email OTP 后才能进入正式 OneKeyID session。 |
| Account / Account Security | `Sign-in methods` / `Upgrade with Google / Apple` | 已登录 OneKeyID | 展示 `/profile.identities` 中的 legacy email 和 Google / Apple OAuth identities，以及当前设备 Keyless wallet 可用状态。只有当前登录态是 legacy email OneKeyID 时，才展示升级到 Google / Apple OAuth 登录方式的入口；用户确认后拉起 OAuth，并调用 API-03 让服务端同时校验 body 里的 `legacyOneKeyIdAuthToken` 和 OAuth `token`。 |
| OAuth identity 未归属当前 OneKeyID 的中间态账户页 | `Logout OneKeyID` | 本地同时存在 legacy OneKeyID 登录态和本地 Keyless wallet，且 Keyless 使用的 OAuth identity 尚未归属当前 OneKeyID | 只清理 OneKeyID 登录态和 OneKeyID scoped token；不移除本地 Keyless wallet，不清理该 Keyless wallet 自己的 credential / PIN / 本地恢复能力。 |
| OAuth identity 未归属当前 OneKeyID 的账户选择器 Keyless wallet 右上角菜单 | `Log out wallet` | 本地同时存在 legacy OneKeyID 登录态和本地 Keyless wallet，且 Keyless 使用的 OAuth identity 尚未归属当前 OneKeyID | 只移除本地 Keyless wallet、Keyless 本地缓存和 child Bot Wallet 关系；不退出 legacy OneKeyID，不清理 OneKeyID scoped token。 |
| 合并后 / OAuth identity 已归属当前 OneKeyID 的账户页与账户选择器 | `Logout` / `Log out wallet` | 当前 OAuth identity 归属当前 OneKeyID，且本地存在 Keyless wallet | 所有 logout 入口统一成同一个动作：清理 OneKeyID 登录态、scoped token / OAuth credential，并移除本地 Keyless wallet 记录、相关本地缓存和 child Bot Wallet 关系；不删除服务端 OneKeyID、OAuth identity、legacy email、merge relation、source archive、服务端历史数据或 Keyless 服务端恢复材料。再次使用时先重新 Google / Apple 登录建立 OneKeyID；需要 Keyless 时再按 OAuth + PIN 的恢复 / 创建流程进入钱包能力。 |
| Account / Account Security / Advanced / Need help? | `Merge existing OneKeyID` | 已登录 OAuth OneKeyID；低曝光常驻 | 通用显式账号合并入口。适用于 Google 不同邮箱、Apple 真实邮箱不同于 legacy email、Apple private relay 等 OAuth 新建账户后的分叉场景。 |
| Account / Account Security / Advanced / Need help? | `Merged accounts` / `Previous accounts` | 后续可选，非 MVP 必需；仅当当前 OneKeyID 有 merged source 记录 | 只读查看历史 source 账号、合并时间、source oauthProvider/email、OAuth identity 归属状态、support request id。MVP 阶段可以不展示该入口；用户需要查询时先通过客服 / 风控查询。不能切回 source 账号继续使用；不展示 Cloud Sync 状态。 |
| 旧客户端 legacy Email + OTP 登录后的账户页 | `Continue with Google or Apple`、`View legacy account`、`Contact support` | 旧客户端 legacy Email OTP 校验成功后 | legacy email 登录态等同于普通 OneKeyID 登录态，可正常查看 / 操作原 OneKeyID 账号数据。若要在新体系中继续使用，应该升级 App 并通过 Google / Apple OAuth 建立 OneKeyID 归属；显式合并仍必须使用当前 OAuth credential + legacy Email OTP。 |
| Keyless create / restore / Keyless sync 页面 | 不新增 OneKeyID 登录入口；复用已登录 OAuth credential | 用户主动进入 Keyless 能力场景 | 这是 OAuth + PIN 的 Keyless wallet 能力流程，不是 OneKeyID 登录流程。同步是否执行只取决于 Keyless wallet / Keyless sync credential 是否已创建或恢复；OneKeyID 登录本身不触发同步。若没有可复用 OAuth credential，先让用户走 Google / Apple 获取 credential，并顺带建立 OneKeyID session 或进入明确确认的 legacy upgrade / merge 路径；然后进入 Keyless PIN / wallet verification。进入 Keyless 流程时若当前 legacy OneKeyID 尚未绑定 OAuth identity，只能跳转到 `Upgrade with Google / Apple` 确认页并走 API-03，或进入 API-04 到 API-06 显式合并；不能在后台静默绑定，也不能把 OAuth credential 当作 Keyless PIN proof。 |
| legacy email OneKeyID 已登录的账户安全页 | `Upgrade with Google / Apple` | 仅 legacy email OneKeyID 已登录 | 这是 legacy email OneKeyID 升级到 OAuth 登录方式的主动入口。用户主动发起，服务端校验 body 里的 `legacyOneKeyIdAuthToken` + OAuth `token`；不要求 legacy Email OTP，也不要求 Keyless PIN。 |
| **S1：旧客户端 legacy email 登录完成后升级提示** | 提示升级 App 并使用 Google / Apple sign-in | legacy email OTP 登录成功 + `identities` 中没有 `identityType = 'oauth'` 的元素 | 升级核心场景：旧客户端不继续扩展新绑定 UI，只提示升级 App。升级到新版本后，用户通过 Google / Apple 走 API-01；同 email 自动绑定，不能自动绑定时进入显式合并路径。 |
| **S3：Cloud Sync / Keyless sync** | 使用现有 Cloud Sync 设置 / 切换入口 | 用户主动进入 Cloud Sync 设置并选择同步模式或恢复同步 | Cloud Sync 只和 Keyless wallet / sync credential 相关，不作为 OneKeyID 迁移步骤。OneKeyID 登录、OAuth identity 归属或账号合并完成后不自动启动 Cloud Sync。用户需要同步时走现有 Cloud Sync 流程；该流程按现有规则准备 Keyless wallet / credential。 |
| **S4：Email + OTP 下线 Phase 5 临近** | 旧客户端启动后强制升级提示 | 服务端配置 Phase 5 即将启动 + 当前 OneKeyID 仅有 legacy email、无 OAuth identity | **半阻断**：旧客户端启动后强制提示升级 App 并改用 Google / Apple。新版本客户端不提供 Email + OTP 普通登录入口。 |
| **S5：旧客户端 legacy email 找回成功后** | 登录完成页提示升级 App | 用户通过旧客户端 legacy email 找回入口登录成功 | 利用刚通过 OTP 的登录窗口提示升级 App，并引导用户后续通过 Google / Apple 建立 OAuth 归属。 |
| 客服 deep link / support case | `Continue merge request` | 客服创建或恢复 merge request | 进入同一个显式合并流程，不绕过当前 OAuth credential + legacy Email OTP。 |

明确不增加入口的位置：

- 不在首页、资产首页、普通登录完成页放 `Merge existing OneKeyID` 主按钮。
- 不因为“当前是 OAuth 新账号”就主动弹窗要求合并。
- 不在 Keyless PIN 页面放账号合并入口，避免把 PIN 误解为 OneKeyID 绑定凭证。
- 不提供 Email + OTP 新用户注册入口。
- 不提供切回 merged source OneKeyID 继续正常使用的入口；source 只用于只读查看、客服核对和审计。
- 不给 OAuth-only 账号提供主动增加另一个 OAuth identity 的入口；legacy email OneKeyID 可以通过 `Sign-in methods` 主动升级到 Google / Apple OAuth 登录方式。
- 不主动提示当前 OneKeyID 已绑定 ≥ 1 个 OAuth identity 的用户"再绑一个备用 provider"。
- 不在 Keyless PIN 输入页、转账签名页、转账确认页等敏感操作流程内插入 OAuth 绑定引导。
- 不对 OAuth-only 新用户在登录完成后主动提示再绑另一个 provider。
- 被动引导或自动拉起 OAuth 的场景中，跨 email 绑定必须要求用户明确确认，并由服务端同时校验 body 里的 `legacyOneKeyIdAuthToken` 和 OAuth `token`；不再额外要求 legacy Email OTP。

## 账户合并规则

### OneKeyID 可以自动合并

- OAuth identity 已经绑定到某个 OneKeyID。
- OAuth identity 未绑定，且非 Apple private relay email，verified email 严格命中唯一一个 active legacy OneKeyID 的 `normalizedLegacyEmail`。旧 email 到 OneKeyID 是服务端唯一映射，不需要用户显式选择 target。
- OAuth identity 未绑定，且未命中 legacy OneKeyID 时，verified email 严格命中唯一一个 active email claim owner。Google 与 Apple 同 verified email 时属于这个规则，自动合并，不要求显式绑定。
- OneKeyID 已绑定其他 Google / Apple identity，但这些 OAuth identity 的 verified email 与当前 OAuth email 相同。不同 oauthProvider、不同 `socialUserIdHash` 不构成冲突。
- 多个设备在 Keyless 流程中使用的 OAuth identity 指向同一个 legacy email 时，合并到该 legacy OneKeyID 下，不构成冲突。
- 同 email 自动合并只需要服务端校验 OAuth credential 合法性，不要求 Email OTP。
- Apple 返回真实 verified email 时，仍按同 email 自动合并；只有 Apple private relay email 暂不参与真实 legacy email 自动合并，当前按独立账户处理。

### OneKeyID 不允许自动合并

- OAuth email 不是 verified 状态。
- OAuth email 与 legacy email OneKeyID email 不同。该情况只能走“已登录 legacy email OneKeyID 升级到 OAuth 登录方式”的窄口径例外，不能自动合并。
- OAuth 新建账户后续想合并 legacy OneKeyID 时，只能走显式账号合并流程，不能在登录时自动合并。
- 如果客户端提交了可验证的 `legacyOneKeyIdAuthToken`，且 OAuth 登录无法自动合并，服务端应返回 `manual_merge_required`，客户端必须优先引导合并，不能直接创建新 OneKeyID。
- 如果历史数据破坏了旧 email 唯一映射，例如同一个 `normalizedLegacyEmail` 命中多个 active legacy OneKeyID，不能自动选择 target，也不能创建新账号，必须返回 `support_required`。
- 同一个 verified `normalizedEmail` 在历史 OAuth identity 集合中命中多个非 merged OneKeyID，且无法安全回填唯一 active email claim owner 时，视为历史数据完整性异常，不自动选择 target，不创建新账号，进入显式合并或客服流程。

### Keyless 场景内的 OAuth 归属

- 客户端读取当前设备 Keyless 流程使用的 OAuth credential，服务端校验 credential 合法性。
- 如果 OAuth verified `normalizedEmail` 命中当前 legacy email OneKeyID 的 `normalizedLegacyEmail` 或 active email claim，则静默绑定，不要求 Email OTP。
- 如果 OAuth email 与当前已登录 legacy email OneKeyID 的 `legacyEmail` 不同，必须由用户主动进入 legacy email OneKeyID 升级到 OAuth 登录方式流程；服务端同时校验 body 里的 `legacyOneKeyIdAuthToken` 和 OAuth `token`。
- 绑定不使用 `socialUserIdHash`、`keylessWalletId` 或 Keyless wallet metadata 作为认证材料。
- 绑定不要求 Keyless PIN。

### OAuth 归属冲突

OAuth 账户绑定只解决 OneKeyID 身份。Keyless wallet 本身不作为 OneKeyID 归属对象，PIN 也不参与 OneKeyID 身份归属。以下情况视为 OAuth 归属冲突或异常：

- 当前设备 Keyless 流程使用的 OAuth identity 已绑定或解析到另一个 active OneKeyID。
- 跨 email 绑定不是当前已登录 legacy email OneKeyID 用户主动发起，或 request body 中缺少合法的 `legacyOneKeyIdAuthToken` / OAuth `token`。
- OAuth credential 校验失败、过期或 OAuth subject 与服务端记录不一致。

OAuth identity 归属不使用 `socialUserIdHash`、`keylessWalletId` 或任何 Keyless wallet metadata。多个设备在 Keyless 流程中使用的 OAuth identity、以及普通 Google / Apple OAuth identity，只要 verified email 相同，都可以绑定到同一个 legacy email OneKeyID。OneKeyID 自动合并只看 verified email 严格相同；Keyless 场景的同 email 绑定只看当前 OAuth credential。目标是当前已登录 legacy email OneKeyID 的主动跨 email 绑定时，额外要求 body 里的 `legacyOneKeyIdAuthToken` 作为 target proof。

### 客服或人工流程

基于严格 email 相同自动绑定规则，仍需要客服或人工处理的场景：

- 除“已登录 legacy email OneKeyID 升级到 OAuth 登录方式”例外外，用户要求合并不同 normalized email 的账户时，只有 target 是 legacy email OneKeyID 的场景进入显式合并 / 客服流程；OAuth-only → OAuth-only 不提供跨 email 自助或客服合并。同 verified `normalizedEmail` 的多个 OAuth identity 仍走自动合并，不属于客服流程。
- OAuth 新建账户和 legacy OneKeyID 无法自动合并时，走显式账号合并；该流程把 source active OAuth bindings 改写到 target，不处理 source OneKeyID 下的业务数据。Cloud Sync 冲突不属于 OneKeyID 客服合并流程。
- OAuth binding 表存在唯一性异常，例如同一个 `(oauthProvider, oauthSubject)` 对应多个 OneKeyID。
- 同一个 verified `normalizedEmail` 在历史 OAuth identity 集合中命中多个非 merged OneKeyID，且服务端无法安全回填唯一 active email claim owner。
- 当前设备 Keyless 流程使用的 OAuth identity 已归属另一个 active OneKeyID，且用户无法完成显式合并验证。
- 用户有多个不同 email 的 OneKeyID，其中至少一个是 legacy email OneKeyID，并希望把当前 OAuth identity 归属到 legacy OneKeyID。
- Keyless 数据损坏，并且自助恢复、重置 PIN 都失败。

## Cloud Sync / Keyless Sync 策略

Cloud Sync 只和 Keyless wallet 及 Keyless sync credential 相关，不是 OneKeyID 账号数据，也不是服务端 OneKeyID 权威字段。OneKeyID 登录、OAuth 绑定和显式账号合并都不读取、不写入、不迁移、不标记 Cloud Sync 状态。

评审边界：这里的“不触发 Cloud Sync”指本次统一登录迁移不新增、不改写、不强制执行 Cloud Sync 流程，也不改变既有 Cloud Sync feature flag、订阅状态、用户主动设置入口或历史静默触发逻辑。保持原有 Cloud Sync 行为本身不是迁移问题；只有本迁移新增了 Cloud Sync 状态变更、自动上传 / 下载、模式切换或数据覆盖，才按问题处理。

新设备或无本地 Cloud Sync 历史的设备，可以按现有 Cloud Sync / Keyless wallet 规则初始化本地同步状态；这个初始化只属于 Keyless wallet 能力流程，不属于 OneKeyID 登录流程。OneKeyID 登录只建立账号登录态，不触发 Cloud Sync，不创建 Keyless wallet，也不上传 / 下载同步数据。

Keyless sync 是否真正执行，只和本地 Keyless wallet / Keyless sync credential 是否已经创建或恢复有关：没有 Keyless wallet / credential 时，Cloud Sync 处于 paused / waiting for Keyless wallet 状态；只有用户进入 Keyless wallet 创建 / 恢复 / Keyless sync 场景并完成钱包能力流程后，才按现有 Cloud Sync 规则同步。

用户如果需要切换同步模式、恢复同步或处理同步数据，继续从现有 Cloud Sync 设置 / 切换入口主动操作。现有 Cloud Sync 流程负责准备 Keyless wallet、Keyless sync credential、转换 / 上传同步数据和更新本地状态；本方案不重新定义这套流程，也不把它作为统一登录迁移的必经步骤。

账号合并只改变 OneKeyID 身份归属、OAuth identity 和必要的数据关联。Cloud Sync 不出现在 `IOneKeyIdMergeRelation` 的身份处理状态中，不进入合并确认摘要，不进入 merged source 只读归档状态，也不要求服务端给合并后的 OneKeyID 标记任何 Cloud Sync 类别。

## 用户分群

### 新用户

- 通过 Google / Apple 登录进入 upsert。
- 服务端先查 OAuth binding，再按 verified `normalizedEmail` 锁定 / 查询 active email claim owner，判断是否可自动合并。
- 只有没有 OAuth binding、没有可自动合并的 OneKeyID、且客户端没有提交可验证的 `legacyOneKeyIdAuthToken` 时，才创建新的 OneKeyID。
- 新建 OneKeyID 不创建 `legacyEmail`。
- Keyless wallet lazy create：登录后不自动创建；用户第一次进入创建钱包、恢复钱包、Keyless sync 或其他必须依赖 Keyless wallet 的场景时再创建。
- 新设备 / 无本地 Cloud Sync 历史时，OneKeyID 登录不触发同步。只有用户进入 Keyless wallet 创建 / 恢复 / Keyless sync 场景，并完成 Keyless wallet / credential 准备后，才开始按现有 Cloud Sync 规则同步。

### 只有 OneKeyID 的老用户

- 使用同 email Google / Apple 登录后静默绑定到原 OneKeyID。
- 如果只能使用不同 email 的 Google / Apple，则不自动绑定；用户先通过 Google / Apple 登录 OAuth OneKeyID，再通过低曝光 `Merge existing OneKeyID` 入口完成显式合并。
- 不强制创建 Keyless wallet。
- 第一次使用 Keyless wallet、Keyless sync、恢复或验证场景时再引导创建或恢复。

### 已有 Keyless wallet 的老用户

- 如果 legacy email OneKeyID 已登录，按当前 legacy email OneKeyID 作为迁移目标；同 email 的 OAuth identity 可以静默绑定到当前 legacy email OneKeyID，不要求 Email OTP；不同 email 不自动绑定，但用户可以主动进入 legacy email OneKeyID 升级到 OAuth 登录方式流程，并通过 body 里的 `legacyOneKeyIdAuthToken` 证明 target。
- 如果 legacy email OneKeyID 未登录，登录页优先展示已登录 Keyless wallet 的继续入口；用户点击后复用本地 OAuth credential 建立 OneKeyID 登录态。credential 不可用时等待用户主动 Google / Apple 登录。
- 启动流程只读取本地 Keyless 状态并决定是否展示继续入口，不后台静默登录 OneKeyID，也不弹 Keyless PIN。
- 将 OAuth identity 归属到 legacy OneKeyID 时，复用已登录 OAuth credential，不要求 PIN；跨 email 手动升级额外要求 body 里的 `legacyOneKeyIdAuthToken` 作为 target proof。
- 创建、恢复、重置 PIN 或验证 Keyless wallet 时，才进入 Keyless PIN。
- 保持本地 wallet id、账户、DApp 连接和 Bot Wallet 关系不变。

### 已有 Cloud Sync / Keyless sync 历史的用户

- 登录、OAuth 绑定或账号合并完成后，不处理 Cloud Sync 本地状态，不执行同步迁移，也不上传 / 下载同步数据。
- 用户需要使用、恢复或切换 Cloud Sync 时，从现有 Cloud Sync 设置 / 切换入口主动操作。
- 是否能同步只取决于该设备是否已经创建 / 恢复 Keyless wallet 和 Keyless sync credential。

### 冲突用户

- 不把不同 oauthProvider、不同 `socialUserIdHash` 或多个设备在 Keyless 流程中使用的 OAuth identity 指向同一个 legacy email 视为冲突。
- 只要 Google / Apple 能返回 verified email，并且该 email 命中一个 legacy OneKeyID，就自动合并到该 legacy OneKeyID。Apple 返回真实邮箱时也适用；Apple private relay email 先按独立账户处理，不自动合并真实 legacy email；但客户端提交了可验证的 `legacyOneKeyIdAuthToken` 时仍优先进入 `manual_merge_required`，不直接创建分叉账号。
- Google / Apple OAuth 创建的新 OneKeyID 后续发现 legacy 账户时，不作为登录冲突处理，提供显式账号合并入口。Apple private relay 只是其中一种来源。
- 只有无法获取 verified email、跨 email 非主动升级、OAuth identity 唯一性异常，或历史 OAuth identity 集合无法安全回填唯一 active email claim owner 时，才不自动合并。
- 本地标记 `IOneKeyIdOAuthBindingLocalInfo.bindingStatus = 'conflict'`。
- 客户端提供切换账号、重新验证、联系客服入口。

## 发布节奏

### Phase 1: 服务端兼容

- 支持 Google / Apple OAuth upsert OneKeyID。
- 增加当前设备 Keyless 流程使用的 OAuth identity 归属状态；账号下其他 `identities` 只作为可选只读列表展示，不影响当前设备状态。
- 保留 legacy Email + OTP 找回 / 查看接口，但不作为新用户注册或主登录入口。

### Phase 2: 客户端登录入口切换

- 登录入口切换为 Google / Apple。
- 隐藏默认 Email + OTP 登录 UI。
- 新版本客户端不再保留 `Sign in legacy OneKeyID`；legacy Email + OTP 只作为旧客户端兼容路径保留，旧客户端遇到新 email 登录 / 注册诉求时提示升级 App。
- OAuth 成功后统一调用 OneKeyID login bridge。

### Phase 3: Keyless 场景 OAuth 归属灰度

- 登录后只刷新当前设备 Keyless 流程使用的 OAuth identity 归属状态，不触发 PIN。
- 用户进入 Keyless 场景时，复用当前 OAuth credential；本设备尚未有可用 OAuth credential 时，才拉起 Google / Apple 进入 Keyless 创建 / 恢复。同 email 静默绑定；目标是当前已登录 legacy email OneKeyID 的主动跨 email 绑定时，要求 body 里的 `legacyOneKeyIdAuthToken` + OAuth `token`。
- 用户进入 Keyless 创建、恢复、同步或验证场景时，复用当前设备可用 OAuth credential；只有钱包能力需要 PIN。
- 记录绑定成功率、冲突率、失败原因。
- 不触发 Cloud Sync，也不处理 Keyless sync credential 或同步数据。

### Phase 4: Cloud Sync 保持现有流程

- 本次统一登录迁移不自动修改 Cloud Sync 本地状态，不处理 Keyless sync credential，不上传 / 下载同步数据。
- 保留现有 Cloud Sync 设置 / 切换入口，由用户主动处理同步。
- Cloud Sync 数据不因账户迁移自动删除；保留策略沿用现有 Cloud Sync 方案。

### Phase 5: 下线 legacy

- 普通用户默认不可见 Email + OTP。
- legacy Email + OTP 仅作为旧客户端兼容路径、显式合并 target 验证和客服 / 风控流程保留；新版本客户端不提供普通登录或低曝光登录入口，不支持新 email 创建。
- 清理普通登录路径中的旧 UI、旧状态字段和旧文案；不能删除 `legacyEmail`、merge relation、merged source archive 等迁移保留字段。Cloud Sync 数据清理不属于本迁移范围。

## 发布止损策略

本方案不设计数据回滚，不提供把已完成 OAuth binding、email claim、merged source 关系自动回退到迁移前状态的流程。发布开关只用于停止继续放量或关闭某条新入口，已落库的账号关系按前文的 source archive、merge relation 和客服核对流程处理。

- Feature flag 控制：
  - `unifiedAccountEnabled`
  - `googleAppleOnlyLoginEnabled`
  - `autoBindKeylessEnabled`
- 若 OAuth upsert 出现问题，关闭 `googleAppleOnlyLoginEnabled`，停止新用户继续走 Google / Apple 主登录放量；不恢复新 email 注册。
- 若 Keyless 场景 OAuth 归属出现问题，关闭 `autoBindKeylessEnabled`，不影响 OneKeyID 登录。
- Cloud Sync 不作为本迁移的自动发布项；相关 feature flag 和止损沿用现有 Cloud Sync / Keyless wallet 流程。

## 风险点

- OAuth 自动绑定只能使用 verified `normalizedEmail`，不要加入额外启发式匹配规则。
- 未绑定的 OAuth identity 如果没有 verified email，可以创建 OAuth-only OneKeyID，但不能创建 email claim，也不能参与同 email 自动合并；如果客户端提交了可验证的 `legacyOneKeyIdAuthToken`，必须优先返回 `manual_merge_required`，避免生成无法自动合并的分叉账号。
- 创建新 OneKeyID 前必须先穷尽合并路径：已有关联、同 email 自动合并、可验证 `legacyOneKeyIdAuthToken` 触发的 pending merge / 显式合并。否则会造成账户分叉。
- OAuth upsert 必须有事务和幂等保护：未绑定 OAuth identity 首次登录且存在 verified `normalizedEmail` 时，必须先锁定 `normalizedEmail` 对应的 email claim，再决定绑定已有 OneKeyID 或创建新 OneKeyID，避免同 email Google / Apple 并发登录创建多个 OneKeyID。没有 verified email 时跳过 email claim 锁，只对 `(oauthProvider, oauthSubject)` / `oauthIdentityId` 做唯一约束保护。
- `normalizedLegacyEmail` 必须在 active legacy OneKeyID 中保持全局唯一。开启 OAuth 同 email 静默绑定前必须完成历史数据预检查和唯一约束落库；如果运行时发现重复旧 email，必须返回 `support_required`，不能自动绑定。
- `manual_merge_required` 必须是 pending merge state，不能授予普通 OneKeyID 登录态或 legacy 账户权限。
- `sourceOauthHandle` / `finalConfirmHandle` 必须是加密签名短期 token，不持久化任何服务端 pending 状态。`sourceOauthHandle` 绑定触发 `manual_merge_required` 时的 `oauthIdentityId` / provider / subject / normalizedEmail? / iat / exp，用于 `prepare` / `verify-target` 阶段的防枚举、节流和展示；`finalConfirmHandle` 绑定 `mergeRequestId`、target onekeyUserId、target legacy email / normalized email、sourceType、canonical source、iat、exp，用于证明 target Email OTP 已通过且用户确认的是同一个 source。`merge/confirm` 时必须验签 token 并**重新校验**当前 OAuth credential（防止 token 已撤销或被伪造），且当前 OAuth credential 必须与 `finalConfirmHandle` / execution record 中的 canonical source 一致；不一致时返回 mismatch 错误并要求客户端重新走 verify-target。已有 execution record 的重试必须匹配该 record 已落库的 canonical source。
- Email OTP 发送必须保持独立接口模型：`/merge/prepare` 只签发 `otpPurposeToken`，不发送 OTP；客户端必须通过 `/prime/v1/general/emailOTP` 传 `scene + otpPurposeToken` 发码，再把 `otpUuid + code` 提交给业务确认接口。不能把发码副作用耦合进 merge prepare。
- `/merge/confirm` 必须同时按 `mergeRequestId` 和 canonical source 幂等 / 互斥执行。进入执行阶段后必须先落 `processing` execution record；同一个 source 只要已有未完成 `processing` 任务，其他相同 source 的新 confirm 直接返回 `source_merge_in_progress`，不创建第二条执行记录。成功、失败和客服介入都必须更新同一条结构化记录。失败审计不能和主合并事务一起回滚丢失；客户端断网后在 confirm 执行期短重试同一个 `mergeRequestId` 不能重复迁移或重复绑定；重复 `/merge/verify-target` 产生多个 `mergeRequestId` 时，也必须被 source-level execution lock 拒绝并提示已有任务未完成。任何按 `mergeRequestId` 返回状态的请求都必须先授权，不能把 `mergeRequestId` 当作 secret。source 旧 session 失效后，用户恢复登录路径不是继续查询 `mergeRequestId`，而是重新 OAuth 登录，由 OAuth binding 当前归属返回 target session。
- legacy Email OTP 找回接口必须防账号枚举，不能通过文案、错误码或时序泄露 email 是否存在。
- 显式合并在 legacy Email OTP 通过前不能返回 target 是否存在或 target 数据摘要，避免把合并入口变成账号枚举接口。
- 同 email 绑定不能要求 Email OTP，否则会把普通 Google / Apple 登录变回迁移流程。
- 跨 email 绑定必须限制在已登录 legacy email OneKeyID 的主动升级路径内，并要求 body 里的 `legacyOneKeyIdAuthToken` + OAuth `token` 同时验证通过。
- legacy email OneKeyID 升级到 OAuth 登录方式由 API-03 直接完成：客户端在 POST body 提交 `legacyOneKeyIdAuthToken` 和 OAuth `token`，服务端校验两份 proof 后绑定；客户端不能只靠本地 email 判断改写绑定状态。OAuth-only 当前账号不能进入该流程。
- 跨 email OAuth identity 升级例外必须保持在已登录 legacy email OneKeyID 的主动升级路径内，不能复用到普通登录或后台自动绑定。
- 两个 OneKeyID 都有数据时，不能静默合并；必须经过显式账号合并确认，并保留 source merged archive / merge relation。
- source OneKeyID 合并完成后必须 revoke 旧 AUTH token / session / scoped token；写入接口遇到 source 旧 session 必须返回 `account_merged_reauth_required` / 401，不允许透明写入 target。客户端必须清理本地 OneKeyID token / `primePersistAtom`，报错并回到登录界面，让用户手动重新登录。
- 同一个 verified `normalizedEmail` 在历史 OAuth identity 集合中命中多个非 merged OneKeyID，且无法安全回填唯一 active email claim owner 时，不能自动选择 target，必须进入显式合并或客服流程。
- Keyless wallet 必须 lazy create，不能在 OneKeyID 登录成功后自动创建，否则会扩大迁移风险和误创建概率。
- `socialUserIdHash`、`keylessWalletId` 和任何 Keyless wallet metadata 不参与 OneKeyID 自动合并和 OAuth identity 归属认证。
- OneKeyID 只绑定 OAuth identity：一个 OneKeyID 可以绑定多个 OAuth identity；同一个 OAuth identity 只能归属一个 active OneKeyID。服务端不能建立 `keylessWalletId` 到 OneKeyID 的归属关系。
- 统一登录迁移、OAuth 绑定和账号合并不得读取、写入、迁移、标记 Cloud Sync 状态，不得自动上传、覆盖或删除 Cloud Sync 数据；用户需要同步、恢复或切换同步模式时走现有 Keyless wallet / Cloud Sync 流程。
- OAuth credential cache 清理不能删除唯一可用凭证；清理只能在 OAuth identity credential namespace 存在可读凭证、旧客户端兼容窗口结束、且旧 Keyless cache 不再是唯一可用凭证后进行。
- 账号合并不得清理、覆盖或迁移 Keyless wallet secret namespace；Cloud Sync 数据清理不属于本迁移范围。
- 旧版本客户端必须继续可用至少 2-3 个版本周期；明确标记为已废弃且无用户路径的 Keyless auth share OTP legacy 代码除外，可直接删除。
- OAuth identity 归属完成前，本地同时持有 legacy OneKeyID 和本地 Keyless wallet 时，logout 必须保持分离：
  - OneKeyID logout 只清理 OneKeyID 登录态和 OneKeyID scoped token，不移除本地 Keyless wallet，也不清理该 Keyless wallet 自己的 credential / PIN / 本地恢复能力。
  - Keyless wallet logout / remove 只移除本地 Keyless wallet、Keyless 本地缓存、当前 cloud sync keyless wallet id 和 child Bot Wallet 关系，不退出 legacy OneKeyID，也不清理 OneKeyID scoped token。
  - 如果处于 legacy email 老用户升级中间态，且旧 Keyless OAuth cache 尚未导入统一 OAuth identity credential namespace，在绑定成功前仍按各自入口分别清理登录态和旧兼容 cache；导入成功后只能以统一 namespace 作为 OAuth credential 权威来源，不能继续保留两份可写凭证。
- OAuth identity 已归属当前 OneKeyID 后，OneKeyID 与 Keyless 只有一个统一 logout，不再提供“只退出 OneKeyID 但保留 Keyless wallet”的 logout。logout 时必须同时清理：
  - OneKeyID 登录态、scoped token、OAuth credential（access token / refresh token / id token）。
  - 如果本地存在 Keyless wallet，则移除本地 Keyless wallet 记录、Keyless 本地缓存、当前 cloud sync keyless wallet id 和 child Bot Wallet 关系。
- 评审边界：统一 logout / Keyless wallet remove 是用户主动触发的产品行为，其中本地 Keyless wallet、child Bot Wallet、DApp connection、本地缓存或本地 sync credential 的清理属于预期本地状态清理，不作为“迁移导致账户数据丢失 / 损坏”问题重复报告。只有未经过用户主动 logout / remove 的迁移、登录、合并、自动绑定或后台流程执行了这类清理，或删除了服务端权威数据，才按数据丢失风险处理。
- 统一 logout 后移除本地 Keyless wallet 记录 / 缓存是已定产品行为，不再提供恢复验证前置检查、保留本地 Keyless wallet 的分离 logout，或仅退出 OneKeyID 的隐藏入口。再次使用 Keyless wallet 时，用户重新通过 Google / Apple 登录，并按 OAuth + PIN 的 Keyless 创建 / 恢复流程进入钱包能力。
- 统一 logout 只清理本地状态和本地 Keyless wallet 记录 / 缓存，不以 Keyless wallet 是否已经恢复验证作为前置条件；Keyless 恢复能力由后续 OAuth + PIN 流程负责。
- 统一 logout 不能删除服务端权威数据，包括 OneKeyID 主账号、OAuth identity 绑定、legacy email、合并关系、merged source archive、服务端只读历史数据或 Keyless 服务端恢复材料。再次使用时必须重新 Google / Apple 登录；需要 Keyless wallet 时再走创建 / 恢复流程并进入 PIN。
- 统一 logout / Keyless wallet remove 后，保持现有 Cloud Sync 本地状态行为：不额外把 `isCloudSyncEnabledKeyless` 置为 false。可以清理 `currentCloudSyncKeylessWalletId`、本地 Keyless sync credential 和 cached sync credential，但 Cloud Sync 开关状态本身保持原样；后续用户重新登录并恢复 / 创建 Keyless wallet 后，按现有 Cloud Sync 流程继续。
- 如果本地 `isCloudSyncEnabledKeyless = true`，但本地 Keyless wallet / Keyless sync credential 已被删除或不可用，Cloud Sync 进入 paused 状态：不自动关闭开关、不执行 Keyless sync、不上传空本地数据。Cloud Sync 页面提示用户恢复或创建 Keyless wallet；恢复 / 创建完成并重新获得 Keyless sync credential 后，再按本地 Keyless mode 继续同步。
- 共享设备 / 切换 OneKeyID 场景的安全边界：统一 logout 执行后，本地无 OAuth credential，也无可继续使用的本地 Keyless wallet，下次启动不会自动 bootstrap，必须用户主动重新走 Google / Apple。OAuth identity 未归属当前 OneKeyID 的中间态下，如果用户只执行 OneKeyID logout 而保留 Keyless wallet，客户端不能用该 Keyless credential 在后台静默恢复 OneKeyID 登录；只能在登录页展示已登录 Keyless wallet 的继续入口，用户点击继续后才复用该 credential。
- **OAuth provider 全局故障时 OAuth-only 用户无登录路径**：当 Google 与 Apple OAuth 服务同时不可用时，没有 `legacyEmail` 的 OAuth-only 用户将完全无法登录。这是 OAuth-only 主登录方案的**固有风险**，产品上接受该风险。旧客户端兼容期内，已有 legacy email 用户仍可通过旧 Email + OTP 登录路径兜底；新版本客户端不提供 Email + OTP 普通登录入口。OAuth-only 用户只能等待 provider 恢复。Google 与 Apple 是独立云服务，同时全局故障概率极低且持续时间通常为小时级，不设计应急通道。
- **OAuth-only 用户个人 OAuth 访问权丢失无恢复例外**：没有 `legacyEmail` 的 OAuth-only OneKeyID 只信任 OAuth provider proof。用户丢失 Google / Apple / Workspace 账号访问权、provider 停用账号、邮箱被组织回收或 reassign 时，如果没有其他已绑定 OAuth identity，也没有另一个 provider 能返回相同 verified `normalizedEmail`，OneKey 不提供 Email OTP 兜底、客服人工改绑、跨 email 证明恢复或紧急恢复通道。没有 verified email 的 OAuth-only 账号只能依赖同一个 OAuth identity 恢复。该风险是 OAuth-only 主登录模型的一部分，产品上接受。
- **legacy email 静默自动绑定的信任根是 OAuth provider 的 verified email**：OAuth identity 未关联但 verified `normalizedEmail` 命中唯一一个 active legacy OneKeyID 的 `normalizedLegacyEmail` 时静默绑定、不要求 Email OTP。该规则隐含信任假设：**Google / Apple 返回的 verified email 是该 email 当前真实持有人的身份证明**。若 OAuth provider 层面发生 email 变更 / Workspace 邮箱 reassign / 管理员接管等情况，新持有人可以通过 OAuth 静默接管原 legacy OneKeyID。这是 OAuth 模型的固有信任假设，**责任在 OAuth provider**（Google / Apple / Workspace 管理员），不在 OneKey 产品方案。产品上接受该风险，不设计额外 OTP 验证（否则会破坏同 email 自动合并的体验目标）。

## 验收标准

- 登录页主登录区域只能展示 Google / Apple；新版本客户端不展示 legacy Email + OTP 登录入口。旧版本客户端如仍有 Email + OTP 入口，只能作为兼容路径服务已有 legacy email OneKeyID，不能创建新 email 账号。
- Google / Apple 登录正常返回 OneKeyID session 后，`primePersistAtom.isLoggedIn` 和 `isLoggedInOnServer` 均为 true；`manual_merge_required` 不属于正常登录完成态。
- Google / Apple 登录成功后不触发 Keyless PIN，也不自动创建或恢复 Keyless wallet，不建立 Keyless wallet 到 OneKeyID 的关系。
- Keyless wallet 仅在用户进入创建钱包、恢复钱包、Keyless sync 或其他必须依赖 Keyless wallet 的场景时 lazy create。
- OAuth identity 归属完成前，本地同时持有 legacy OneKeyID 和本地 Keyless wallet 时，OneKeyID logout 与 Keyless wallet logout / remove 仍然分离，互不清理对方状态。
- OAuth identity 已归属当前 OneKeyID 后，所有 logout 入口统一：触发后同时清理 OneKeyID 登录凭证 / OAuth credential，并移除本地 Keyless wallet 记录 / 缓存；但不删除服务端 OneKeyID、OAuth identity、合并历史或 Keyless 服务端恢复材料。
- 未归属任何 OneKeyID 的 Google / Apple OAuth identity 返回相同 verified email 时，自动合并为同一个 OneKeyID，不出现显式绑定确认；已归属的 OAuth identity 始终返回原 OneKeyID。
- OAuth-only 账号之间不提供跨 email 显式合并；但两个 OAuth identity 返回相同 verified `normalizedEmail` 且当前 identity 未归属 OneKeyID 时，必须自动合并到同一个 OneKeyID。
- OAuth-only 用户丢失所有可证明归属的 OAuth 登录方式时，不能通过 Email OTP、客服人工改绑、跨 email 证明或其他例外恢复该 OneKeyID；只能使用已绑定 OAuth identity，或通过相同 verified `normalizedEmail` 的未绑定 OAuth identity 触发同 email 自动绑定。没有 verified email 的 OAuth-only 账号只能通过同一个已绑定 OAuth identity 恢复。
- 未归属任何 OneKeyID 的 Google / Apple OAuth identity 如果没有 verified email，可以创建 OAuth-only OneKeyID，但不创建 email claim，也不能参与同 email 自动合并。
- Apple OAuth identity 如果已经有 `(oauthProvider, oauthSubject)` binding，后续 Apple 不返回 email 也必须正常登录原 OneKeyID；如果未绑定且 Apple 不返回 verified email，可以创建 OAuth-only OneKeyID。若客户端提交了可验证的 `legacyOneKeyIdAuthToken`，仍优先返回 `manual_merge_required`。
- 老 Email + OTP 用户可通过同 email Google / Apple 静默绑定回原 OneKeyID，不要求 Email OTP。
- 服务端必须保证旧 email 到 active legacy OneKeyID 的唯一映射；同 email 静默绑定依赖 `normalizedLegacyEmail` 唯一约束，不能依赖客户端选择 target。
- legacy Email + OTP 登录 / 找回只作为旧客户端兼容路径保留，可用于旧用户登录查看 legacy email OneKeyID，但不能创建新 email 账户，也不能作为新版本客户端默认或低曝光登录入口。
- legacy Email + OTP 找回路径不泄露 email 是否存在；旧客户端遇到新 email 登录 / 注册诉求时提示升级 App。
- Account Security / Advanced / Need help? 必须提供 `Merge existing OneKeyID`；Apple private relay、Google 不同邮箱、Apple 真实邮箱不同于 legacy email 等 OAuth 新建账户分叉场景都复用该入口。
- `Merged accounts` / `Previous accounts` 是后续可选入口，非 MVP 必需；如果展示，只在当前 OneKeyID 有 merged source 记录时出现，并且只能只读查看，不能切回 source OneKeyID 正常使用。MVP 阶段用户需要查询 merged source 信息时，先通过客服 / 风控查询。
- 客户端提交了可验证的 `legacyOneKeyIdAuthToken`，且 OAuth 无法自动合并时，服务端必须返回 `manual_merge_required`，客户端展示显式合并路径，不能直接创建新 OneKeyID。
- `manual_merge_required` 不产生普通 OneKeyID 登录态，不创建 source OneKeyID；用户完成 legacy Email OTP 和 OAuth credential 校验后，直接绑定到 target legacy OneKeyID，再刷新为正式登录态。
- `/merge/confirm` 同一个 `mergeRequestId` 可在 confirm 执行期安全短重试：授权通过后，已 `merged` 返回同一个成功结果；未超时 `processing` 返回 `processing` 和 `retryAfterSeconds`；`failed` / `support_required` 返回对应状态，不重复执行。同一个 canonical source 已有未完成 `processing` 任务时，其他相同 source 的新 confirm 返回 `source_merge_in_progress`，不创建第二条执行记录。授权失败必须返回 404 / not found，不暴露 record 是否存在或状态。source session 失效或客户端不确定 confirm 是否成功时，客户端必须清理本地 OneKeyID token / `primePersistAtom`，报错并回到登录界面，让用户手动重新发起 Google / Apple 登录；如果合并已完成，用户手动登录后 OAuth 登录直接返回 target session。
- legacy email OneKeyID 已登录且当前 OAuth email 不同时，只能通过用户主动确认的手动升级流程绑定，并要求 body 里的 `legacyOneKeyIdAuthToken` + OAuth `token` 同时验证通过，不能静默绑定。
- OAuth 新建 OneKeyID 可通过显式账号合并到 legacy OneKeyID；合并后 source OAuth identity 直接绑定 legacy OneKeyID，登录返回 legacy OneKeyID，并且 source 账号数据长期只读保留。
- 合并后 source 旧 AUTH token / session / scoped token 不能继续写 source，也不能透明写 target；服务端必须立即 revoke 并返回 `account_merged_reauth_required` / 401，客户端清理本地 OneKeyID token / `primePersistAtom`，报错并回到登录界面，让用户手动重新登录。
- 显式合并在 legacy Email OTP 通过前不能暴露 target 账号是否存在或 target 账号数据摘要。
- 同一个 verified `normalizedEmail` 在历史 OAuth identity 集合中命中多个非 merged OneKeyID，且无法安全回填唯一 active email claim owner 时，不能自动绑定或创建新账号，必须进入显式合并或客服流程；同一个 `normalizedLegacyEmail` 命中多个 active legacy OneKeyID 时，必须返回 `support_required` 并人工修复数据。
- 已有 Keyless wallet 的用户升级后，同一设备不生成第二个 Keyless wallet。
- 同一个 OneKeyID 可以绑定多个 OAuth identity；同一个 OAuth identity 不能同时绑定到多个 active OneKeyID。`keylessWalletId` 不作为服务端 OneKeyID 归属字段。
- 本地资产账户、钱包顺序、DApp 连接、Bot Wallet、地址簿、收藏、Market watchlist 不丢失。
- Keyless create、restore、reset PIN、verify PIN 流程仍可用。
- 统一登录迁移完成后，Cloud Sync 不出现在 `IOneKeyIdMergeRelation` 的身份处理状态、合并确认摘要或 merged source 只读状态中。
- OneKeyID 登录、OAuth 绑定和账号合并不触发 Cloud Sync；只有 Keyless wallet 创建 / 恢复并取得 Keyless sync credential 后，才按现有 Cloud Sync 流程同步。
- 用户主动从现有 Cloud Sync 设置入口同步、恢复或切换同步模式时，继续使用现有 Cloud Sync 流程；该流程的成功 / 失败 / 重试不作为本迁移验收项。

## 已定方案

- Apple private relay email：当前按独立账户处理，不自动合并真实 legacy email；但如果客户端提交了可验证的 `legacyOneKeyIdAuthToken`，仍返回 `manual_merge_required`，不直接创建分叉账号。后续通过通用显式账号合并流程处理，入口是 Account Security / Advanced / Need help? 下的 `Merge existing OneKeyID`。Apple 返回真实 verified email 时仍走同 email 自动绑定逻辑。服务端通过配置化 relay domain list 识别 private relay，并把 OAuth binding 的 `oauthEmailType = apple_private_relay` 和 `oauthRelayDomainMatched` 落库。
- 老 Email + OTP 用户没有同邮箱 Google / Apple：新版本客户端不提供 legacy Email + OTP 登录入口。用户可先用 Google / Apple OAuth 登录，再通过 `Merge existing OneKeyID` 使用当前 OAuth credential + legacy Email OTP，把 OAuth 新建 OneKeyID 合并到 legacy OneKeyID。旧客户端兼容期内仍可让已有 legacy email 用户登录 / 找回，但新 email 登录 / 注册诉求必须提示升级 App。
- Cloud Sync 数据保留策略：本次统一登录迁移不清理、不覆盖 Cloud Sync 数据，也不自动处理 Cloud Sync 状态。数据保留、恢复和后续清理策略沿用现有 Cloud Sync / Keyless wallet 方案，方便旧版本兼容和客服排查。

## 术语对照

本节统一本文档中容易混淆的账号、合并和 Keyless 术语。实现和评审时以本节定义为准。

| 术语 | 含义 | 使用范围 / 注意事项 |
| --- | --- | --- |
| OneKeyID / OneKey account | OneKey 服务端主账号，主键是 `onekeyUserId`。 | 统一登录后的用户身份主体。 |
| OAuth identity | Google / Apple 返回的登录身份，由 `oauthProvider + oauthSubject` 唯一标识。 | OneKeyID 绑定的是 OAuth identity，不绑定 Keyless wallet。 |
| OAuth binding | `(oauthProvider, oauthSubject) -> boundOneKeyUserId` 的绑定记录。 | `boundOneKeyUserId` 是该 OAuth identity 当前绑定到的 active OneKeyID；合并完成后必须改写到 target。 |
| `boundOneKeyUserId` | OAuth binding 指向的 active OneKeyID。 | 登录时必须读取该账号状态：`active` 直接签发 session；`merged` 表示 binding retarget 不完整，必须返回错误并对账修复。不要把它叫做 owner，避免和 email claim owner 混淆。 |
| `active` OneKeyID | 当前可作为登录主体的 OneKeyID。 | 可签发普通 session，可接受写入。语义是“未被 merge 掉”。 |
| `merged` OneKeyID | 已废弃为登录主体的 source archive。 | 必须有 `mergedToOneKeyUserId` 指向 target；不能签发 source 普通 session；source 旧 session 写入返回 `account_merged_reauth_required`。 |
| `support_required` | 服务端发现无法自动判定的账号合并 / 绑定异常。 | 当前方案不引入单独账号锁定状态；在线业务流程遇到需要人工处理的问题统一返回 `support_required`，客户端展示客服处理入口。 |
| `manual_merge_required` | `POST /prime/v1/account/oauth/login` 返回的业务状态。 | 表示本次 OAuth 登录因为客户端提交了可验证的 `legacyOneKeyIdAuthToken`，且当前 OAuth identity 不能自动绑定 / 登录 OneKeyID，客户端必须进入 pending merge state。该响应不包含 OneKeyID auth token，也不设置普通登录态。 |
| pending merge state | 客户端本地的临时合并流程状态。 | 由 `manual_merge_required` 触发；客户端缓存当前 OAuth credential 与 `sourceOauthHandle`，继续调用 `/merge/prepare`、`/merge/verify-target`、`/merge/confirm`。它不是服务端持久化状态。 |
| `pending_oauth_bind` | 后续 merge API 的 `sourceType`，也是 `/merge/confirm` 成功后落库的 `relationType`。 | 表示 source 还没有 OneKeyID，只是 confirm 时提交并校验通过的 OAuth identity；成功后直接绑定到 target legacy OneKeyID。不要把它当作 OAuth 登录接口的 `status`。 |
| `merged_source` | `/merge/confirm` 成功后落库的另一种 `relationType`。 | 表示 source 是一个已经存在的 OAuth 新 OneKeyID；合并后 source 被标记为 `merged`，source active OAuth bindings retarget 到 target。它不是 `POST /prime/v1/account/oauth/login` 的 `manualMerge.sourceType` 返回值。 |
| source | 合并中被废弃登录主体的一方。 | 可以是已存在的 OAuth 新 OneKeyID，也可以只是 confirm 时提交的 pending OAuth identity。`sourceOauthHandle` 只用于 confirm 前的短期流程状态，不是最终 source 权威。source 不等于 email claim owner。 |
| target | 合并后保留为主账号的一方。 | 当前显式合并只接受 target 是 legacy email OneKeyID。 |
| canonical source | `/merge/confirm` 用于互斥的 source key。 | `pending_oauth_bind` 使用 `oauthProvider + oauthSubject`；已存在 source OneKeyID 使用 `sourceOneKeyUserId`。同一个 canonical source 同时只能有一个未完成合并任务。 |
| email claim | `normalizedEmail -> ownerOneKeyUserId` 的邮箱归属记录。 | 只回答“这个 verified normalized email 当前归属于哪个 active OneKeyID”。它不是登录凭证，也不替代 OAuth binding。 |
| email claim owner | 某个 `normalizedEmail` 当前归属的 active OneKeyID。 | “owner” 只允许用于 email claim 语义；不要用 owner 指 OAuth binding、source 或 target。 |
| `legacyEmail` / `normalizedLegacyEmail` | 老 OneKeyID 用户的历史 email 及其规范化结果。 | 只服务老用户迁移；新用户不新增 legacy email。`normalizedLegacyEmail` 在 active legacy OneKeyID 中必须唯一。 |
| `keylessWalletId` | 旧 Keyless 兼容字段，现有代码可能按 packSetId 使用，也可能在历史路径中映射 / 派生到本地 `hd-keyless-*` wallet id。 | 不是当前设备本地 Keyless wallet 的权威 ID，也不是 OneKeyID 账号级字段；不能写入服务端 OneKeyID 归属关系。 |
| `socialUserIdHash` | Keyless wallet 内部用于记录 / 校验社交身份的 hash。 | 只属于 Keyless 诊断或恢复流程；不作为 OneKeyID 认证材料。 |
| `oauthIdentityId` | 服务端为 OAuth binding 生成的稳定 identity ID；当前沿用服务端根据 OAuth token / identity claims 生成的 `hashId`。 | 用作本地 OAuth credential namespace 和归属状态缓存的唯一 key。`oauthProvider + oauthSubject` 只用于服务端唯一约束、交叉校验和调试展示，不作为本地 credential key。 |
| OAuth identity credential namespace | 本地 secure storage 中保存 OAuth credential 的唯一逻辑 namespace；由新的 `OAuthIdentityCredentialStorage` adapter 管理，复用旧 Keyless OAuth 的 token refresh、secure storage 和加解密能力，但不复用旧 ownerId-keyed cache 作为权威 store。 | OneKeyID 和 Keyless 都从这一处读写同一份 credential；key 固定使用服务端 `oauthIdentityId = hashId`；不能包含 `onekeyUserId`、`keylessWalletId`、`ownerId`、`socialUserIdHash` 或 Keyless wallet metadata。 |
| `IOneKeyIdOAuthBindingLocalInfo.bindingStatus` | 本地缓存的当前设备 OAuth identity 绑定状态。 | 只是 AsyncStorage / jotai persistAtom 缓存，用于加速渲染；必须保存 `oauthIdentityId`，不能只保存 `onekeyUserId + bindingStatus`；权威源始终是服务端 OAuth binding。它不是 `/profile` 的服务端返回字段，由客户端用当前 credential 匹配 `identities` 数组派生。 |

禁止混用规则：

- 不用 `owner` 表示 OAuth binding 指向的账号；统一叫 `boundOneKeyUserId` 或 “binding 指向的账号”。
- 不用 `owner` 表示合并 source / target；合并语境只使用 `source` 和 `target`。
- `active` 只描述 OneKeyID 账号状态，不描述 email claim 或本地钱包状态。
- Keyless wallet 相关语境只使用 OAuth identity、`keylessWalletId`、`socialUserIdHash` 这些明确字段名表达边界，不引入额外归属术语。

## 服务器接口变更

新增、调整、下线和废弃的服务器接口已拆分到 [server-apis.md](./server-apis.md)。该文件按接口 URL 使用二级标题组织。
