# Local Secret Envelope Encryption

## 背景

当前 HD 助记词、导入私钥等敏感凭证以 passcode 加密后的字符串形式持久化在本地 DB 的 `Credential.credential` 中。典型格式是 `|RP|` / `|PK|` 前缀加密载荷，解密链路依赖用户 passcode，并复用 `packages/core/src/secret` 中的 PBKDF2 + AES-GCM 逻辑。

这种设计能防止直接从 DB 读取明文，但存在一个弱点：如果攻击者完整拿到本地 DB，并能离线爆破 passcode，就可以验证并尝试恢复助记词或私钥。新的目标是让本地 DB 被复制到另一台设备后，单靠 DB 内容和 passcode 也不能解开敏感凭证。

## 目标

- DB 中不再持久化任何“只靠 passcode 即可解密”的 portable credential。
- passcode 继续参与助记词、私钥、`verifyString` 的加密解密流程。
- Electron 和 native mobile 复用现有跨平台 keychain / secureStorage 模块做本地安全存储保护，不新增底层 OS keychain 实现。
- Electron 额外加入 IndexedDB `extractable: false` CryptoKey，形成 Keychain + CryptoKey 双层外包裹。
- Web / extension 可以使用 IndexedDB CryptoKey 作为弱设备绑定方案，但不能宣称能防完整 profile 跨设备复制。
- 尽量保持 DB schema 结构稳定，优先通过 `LocalSecretEnvelope` 字符串格式版本化。

## 非目标

- 不用 WebCrypto `CryptoKey` 直接替代链私钥或 HD 助记词本体。
- 不把链签名迁移到 WebCrypto 内部执行。
- 不承诺防住原设备运行时被攻破的情况。
- 不把 Chrome extension storage / IndexedDB 视为不可迁移的硬件级安全边界。

## 最终加密模型

敏感凭证分三层处理：

```text
secret plaintext
  -> passcode encrypt
innerCredential: |RP| / |PK| / verifyString payload

innerCredential
  -> profile CryptoKey encrypt, where available
middleCiphertext

middleCiphertext
  -> Keychain / Keystore device key encrypt, where available
outerCiphertext stored in DB
```

解密反向执行：

```text
outerCiphertext from DB
  -> Keychain / Keystore decrypt
middleCiphertext
  -> profile CryptoKey decrypt
innerCredential
  -> passcode decrypt
secret plaintext
```

LSE 不能产生“只换前缀、没有新增本地保护层”的结果。至少必须有一个可用的 local wrapping layer，例如 Keychain / Keystore / secureStorage 或 IndexedDB `CryptoKey`。如果当前平台没有任何可用 wrapping layer，本轮不写入 `|LSE1|`，旧版 `|VS|` / `|RP|` / `|PK|` 数据继续兼容可读。

## 平台分层

### Electron Desktop

Electron 使用三层方案：

```text
DB credential string
  = KeychainWrap.encrypt(
      IndexedDBCryptoKeyWrap.encrypt(
        passcodeEncryptedCredential
      )
    )
```

安全边界：

- Keychain / DPAPI / Secret Service 是防单独 DB 拷贝的主边界。
- 允许底层统一 `secureStorage` 使用平台默认 Keychain 配置，包括可能的 iCloud sync keychain。此时安全边界是“OS keychain / iCloud account-bound”，不是严格的单设备绑定；如果 `secureStorage` facade 能明确提供 sync capability，envelope capability 必须记录实际 `local-only` / `cloud-sync`；如果当前 facade 不能区分，必须保守记录 `sync: 'unknown'`，不能误标为本机 device-only。
- IndexedDB `CryptoKey` 是 profile 级辅助边界，用于分离业务 DB 和 profile key store，并阻止 WebCrypto API 导出 raw key。
- 如果系统 Keychain 不可用，降级到 IndexedDB CryptoKey 时，安全等级必须标记为 `profile-bound`，不能标记为 `device-bound`。
- 如果实现只能从 Keychain 取回 raw AES key bytes，它仍能防 DB 离线拷贝，但不能防原设备运行时代码读取该 key。

平台建议：

- 通过现有统一 `secureStorage` facade 接入，不在 LSE 中重新实现或绕过 Swift / Objective-C / Java / OS binding。
- LocalSecretEnvelope 可以使用平台默认 Keychain / secureStorage 配置；如果后续需要精确区分 `local-only` / `cloud-sync` 或强制 device-only 语义，应扩展统一 `secureStorage` facade 的 capability 参数，而不是新造一套 keychain。
- 如果平台 secure storage 不可用，降级到 IndexedDB CryptoKey 时，envelope `strength` 必须是 `profile-bound`。如果 CryptoKey 也不可用，不启用 LSE 写入或迁移。

### Native Mobile

Native 使用系统安全存储作为外层：

```text
DB credential string
  = KeystoreWrap.encrypt(passcodeEncryptedCredential)
```

平台建议：

- 复用现有 native keychain / secureStorage 模块，不新增一套平台 Keychain / Keystore bridge。
- LocalSecretEnvelope 可以使用平台默认 keychain / secureStorage 配置，包括可同步 keychain；能力标记必须反映实际 `local-only` / `cloud-sync` / `unknown` 状态。
- 可选叠加生物认证或系统 passcode 访问控制。如果当前 shared facade 还不能表达 sync / require-auth / key-access 能力，应扩展现有 facade 参数，而不是绕开它。

Native 当前本地 DB 走 Realm，不依赖 IndexedDB。除非有明确的 webembed/profile key store 需求，否则不需要引入 IndexedDB CryptoKey。

### Web / Extension

Web 和 extension 只能使用 IndexedDB `CryptoKey`：

```text
DB credential string
  = IndexedDBCryptoKeyWrap.encrypt(passcodeEncryptedCredential)
```

安全边界：

- 能防业务 credential 表或 DB dump 单独泄漏。
- 能阻止 WebCrypto API `exportKey('raw')` 导出 wrapping key。
- 不能承诺防完整 Chrome profile / extension IndexedDB 被复制到另一台机器后复用。
- 不能防同 origin 恶意代码调用 `decrypt()`。

Chrome extension 不考虑 Keychain，除非后续引入 native messaging helper。

## 数据格式

保持 `Credential.credential` 为 `string`。新增 envelope 前缀，例如：

```text
|LSE1|{"wrappingLayers":[{"kind":"indexeddb-cryptokey"},{"kind":"keychain"}],...}
```

`|LSE1|` 表示 `Local Secret Envelope v1`，是最外层本地 secret envelope 前缀，不复用现有 passcode 加密 payload 的 v2 格式。现有 v2 payload 的 magic 是 `1K_ENC_V2`，仍保留在内层 `|RP|` / `|PK|` / `|VS|` 字符串中。解析顺序必须固定为：

```text
|LSE1| local secret envelope
  -> local envelope unwrap
|RP| / |PK| / |VS| inner credential
  -> passcode decrypt
1K_ENC_V2 payload
```

因此 `LSE1` 只负责描述 Keychain / Keystore / IndexedDB CryptoKey 外层包裹，不改变也不覆盖现有 secret encrypt v2 payload 语义。

推荐 envelope 字段：

```ts
type ILocalSecretEnvelopeLayerKind =
  | 'keychain'
  | 'keystore'
  | 'secure-storage'
  | 'indexeddb-cryptokey';

type ILocalSecretEnvelopeLayerCapabilities = {
  sync: 'local-only' | 'cloud-sync' | 'unknown';
  extractable: boolean | 'unknown';
  keyAccess: 'opaque-decrypt' | 'raw-key-readable' | 'unknown';
  requireAuth?: boolean;
};

type ILocalSecretEnvelopeLayer = {
  kind: ILocalSecretEnvelopeLayerKind;
  keyRef: string;
  alg: 'AES-256-GCM' | 'OS-Keychain' | 'OS-SecureStorage';
  iv?: string;
  capabilities: ILocalSecretEnvelopeLayerCapabilities;
};

type ILocalSecretEnvelopeV1 = {
  version: 1;
  dataType: 'credential' | 'verify-string';
  recordId: string;
  wrappingLayers: ILocalSecretEnvelopeLayer[];
  strength:
    | 'secure-storage-bound'
    | 'device-bound'
    | 'profile-bound'
    | 'unavailable';
  protectedHeader: string;
  ciphertext: string;
};
```

`wrappingLayers` 是加密顺序。Desktop 示例：

```text
innerPayload
  -> layer[0] indexeddb-cryptokey AES-GCM
  -> layer[1] keychain / secure-storage wrap
  -> ciphertext
```

解密必须按反向顺序执行。每个 AES-GCM layer 使用独立 `iv`；如果某层是 OS opaque secure storage，`alg` 记录为 `OS-Keychain` / `OS-SecureStorage`，不伪装成 AES-GCM。

`protectedHeader` 是 canonical JSON，至少包含 `version`、`dataType`、`recordId`、`wrappingLayers` 的非密文字段和 capability。AAD 必须绑定 canonical protected header 与 record 类型和 record id，例如：

```text
onekey-local-db:Credential:<credentialId>:LSE1
onekey-local-db:Context:verifyString:LSE1
```

unwrap 时必须重新计算 AAD 和 protected header，不能信任 DB 中声明的 `strength`。`strength` 只能由实际成功使用的 layers 和 runtime capability 计算，用于展示、日志和策略判断。

`verifyString` 必须同样包裹，不能继续保留 passcode-only 的离线校验 oracle。

## Key 管理

### IndexedDB CryptoKey

- 使用 AES-GCM 256-bit。
- `extractable` 必须为 `false`。
- `usages` 只允许 `['encrypt', 'decrypt']`。
- 存在独立 key store，不与业务 credential records 混放。
- 每条 envelope 使用独立随机 `keyRef` 指向对应 wrapping key，降低单个 key 泄漏或清理错误的影响面。
- 如需 key rotation，必须以批量 rewrap 形式完成；修改 passcode 的 rewrap 默认复用原 `keyRef`，只刷新 IV。

### Keychain / Keystore Key

- 通过现有跨平台 keychain / secureStorage 模块管理，优先使用统一 shared `secureStorage` facade。
- keychain / secureStorage 只保存一个 LSE 专用全局高熵 wrapping key，不按 credential / verifyString 数量增长；这与 CLI bot wallet vault 的“keychain master key + 外部密文 DB”模式一致。
- key id 使用稳定 service/account 名称，例如 `onekey:lse:secure-storage:v1`。
- envelope 中的 secureStorage layer `keyRef` 固定指向该全局 key；每条记录的隔离性由独立 IV、AAD、ciphertext，以及 desktop 上额外的 per-credential IndexedDB CryptoKey layer 共同提供。
- 可以使用平台默认 Keychain / secureStorage 配置；如果统一 facade 能明确提供 sync capability，则在 layer capability 中记录实际 `local-only` / `cloud-sync`，否则记录 `sync: 'unknown'`，不能把 unknown 或 cloud-sync key 伪装成 device-only。
- 不能复用云备份业务用途的 keychain 条目；LSE 使用独立 service/account 名称。
- 优先使用 require-auth 等现有模块可表达的安全选项；如果现有模块缺少 sync / require-auth / key-access 能力标记，应扩展该模块的参数。
- 优先不可导出；如果平台实现只能返回 key bytes，必须在能力标记中体现实际强度。
- 单条 credential migration / CAS cleanup 不得删除该全局 key；secureStorage layer 不暴露 per-record key cleanup，只允许在明确的重置 / 销毁钱包场景删除全局 key。
- 删除 keychain 全局 key 后，本地 DB 中所有依赖 secureStorage layer 的 LSE 记录不可恢复，只能通过助记词、私钥、云备份或迁移传输重新恢复。

## Credential 前缀与升级顺序

`IDBCredentialBase.credential` 的升级要区分两层：

- 外层业务前缀：说明这条 credential 的业务类型，例如 `|RP|`、`|PK|`、`|LSE1|`。
- 内层加密 payload 格式：说明 passcode 加密载荷本身是 legacy CBC / legacy GCM / 当前 `1K_ENC_V2`，以及 KDF iterations 是否达到当前 target。

这两层必须按顺序升级，不能把古早格式直接包进 `|LSE1|`。

### Credential 外层前缀

- v4 local DB credential
  - 外层形态：JSON 字符串，没有 `RP` / `PK` / `LSE1` 外层前缀。
  - 说明：v4 迁移输入，不应被 `LocalSecretEnvelope` 直接处理。
  - 下一步：先跑现有 v4 -> v5 migration。
- v5 legacy HD credential
  - 外层形态：`RP` encrypted payload。
  - 说明：`hd*` 钱包助记词 / revealable seed。
  - 下一步：先做 KDF lazy upgrade。
- v5 legacy TON mnemonic credential
  - 外层形态：`RP` encrypted payload。
  - 说明：credential id 形如 `*--ton_credential`，虽然属于 imported account，但 payload 是 revealable seed。
  - 下一步：先做 KDF lazy upgrade。
- v5 legacy imported private key credential
  - 外层形态：`PK` encrypted payload。
  - 说明：普通 `imported*` 私钥 credential。
  - 下一步：先做 KDF lazy upgrade。
- v5 non-target credential
  - 外层形态：例如 `HLP`。
  - 说明：不属于本轮 local password HD / imported credential migration。
  - 下一步：跳过，除非后续单独定义迁移。
- KDF lazy upgrade 后
  - 外层形态：仍是 `RP` 或 `PK`。
  - 说明：外层前缀不变，但 stripped payload 已升级到当前 `1K_ENC_V2` target iterations。
  - 下一步：再做 `LocalSecretEnvelope` migration。
- `LocalSecretEnvelope` migration 后
  - 外层形态：`LSE1` JSON envelope。
  - 说明：DB raw value 的最外层变成 local secret envelope。
  - unwrap 后必须得到原业务 inner credential：`RP` 或 `PK` encrypted payload。

因此 `IDBCredentialBase.credential` 的目标前缀变化是：

```text
HD / TON mnemonic:
  v4 JSON or v5 legacy -> |RP|... -> |RP|<hex(1K_ENC_V2...)> -> |LSE1|{ inner: |RP|<hex(1K_ENC_V2...)> }

Imported private key:
  v4 JSON or v5 legacy -> |PK|... -> |PK|<hex(1K_ENC_V2...)> -> |LSE1|{ inner: |PK|<hex(1K_ENC_V2...)> }
```

注意：`1K_ENC_V2` 是 stripped encrypted payload 解码后的 magic，不是 `credential` 字符串的最外层前缀。DB raw string 在 KDF upgrade 后仍以 `|RP|` / `|PK|` 开头；只有完成 `LocalSecretEnvelope` migration 后，DB raw string 才以 `|LSE1|` 开头。

### LSE migration candidate

`LocalSecretEnvelope` 的自动迁移必须拆成两个最窄 candidate 分支：`Context.verifyString` 分支只认 `|VS|`，`Credential.credential` 分支只认 `|RP|` / `|PK|`。

`Context.verifyString` candidate：

1. raw value 必须以 `|VS|` 开头。
2. stripped payload 必须已经是当前 target iterations 的 `1K_ENC_V2`，即 `shouldUpgradeSecretEncryptPayload()` 返回 `false`。
3. raw value 不得是 `DEFAULT_VERIFY_STRING`，也不得已经是 `|LSE1|`。
4. record identity 必须是主 context 的 `verifyString` 字段。

`Credential.credential` candidate：

1. raw value 必须只以 `|RP|` 或 `|PK|` 开头。
2. stripped payload 必须已经是当前 target iterations 的 `1K_ENC_V2`，即 `shouldUpgradeSecretEncryptPayload()` 返回 `false`。
3. raw value 不得已经是 `|LSE1|`。
4. record id 只作为二次校验和选择解密函数：
   - `accountUtils.isHdWallet({ walletId: id })` + `|RP|` 可以迁移。
   - `accountUtils.isTonMnemonicCredentialId(id)` + `|RP|` 可以迁移。
   - `accountUtils.isImportedAccount({ accountId: id })` + `|PK|` 可以迁移。
   - id 与前缀不匹配时跳过并记录无敏感信息的安全日志。

不满足以上条件的数据不进入 LSE migration。这样可以保证 LSE 只在 100% 确定属于本地 passcode `verifyString`、HD mnemonic 或 imported private key，且已完成 KDF v2 升级的场景执行。

### 覆盖范围与非覆盖范围

这个最窄 candidate 能覆盖本地 DB 中需要保护的 passcode 离线校验值、核心用户助记词和导入私钥场景：

- passcode verifyString
  - DB 位置：`Context.verifyString`
  - raw prefix：`VS`
  - 覆盖：是
  - 说明：移除 passcode-only 离线校验 oracle。
- 普通 HD 钱包助记词
  - DB 位置：`Credential`，id 满足 `accountUtils.isHdWallet()`
  - raw prefix：`RP`
  - 覆盖：是
  - 说明：新建、恢复、云备份恢复最终都会写入 revealable seed credential。
- Keyless HD 钱包本地 seed credential
  - DB 位置：`Credential`，id 满足 `accountUtils.isHdWallet()`
  - raw prefix：`RP`
  - 覆盖：是
  - 说明：只覆盖本地钱包 seed credential；keyless cloud sync 派生 credential 不在这里。
- TON imported account mnemonic
  - DB 位置：`Credential`，id 为 `*--ton_credential`
  - raw prefix：`RP`
  - 覆盖：是
  - 说明：虽然 account 属于 imported，但 credential payload 是 revealable seed。
- 普通 imported private key account
  - DB 位置：`Credential`，id 满足 `accountUtils.isImportedAccount()`
  - raw prefix：`PK`
  - 覆盖：是
  - 说明：新导入、云备份恢复、Prime Transfer 恢复最终都会写入 imported private key credential。

这里的 credential “覆盖”只指落在本机 `Credential.credential` 中、用于本地签名/导出的用户钱包 secret。Cloud Backup / Prime Transfer / legacy peer transfer 等 portable payload 不直接使用 LSE；它们恢复到本地 DB 后，如果写成 KDF v2 `|RP|` / `|PK|`，再由本机 LSE 写入或 migration 覆盖。LSE 是 local secure-storage envelope，不是跨设备备份格式。

明确不在本轮 LSE credential migration 覆盖的场景：

- v4 JSON、prefixless、unknown prefix credential：必须先走历史 migration 和 KDF lazy upgrade，不直接包 `|LSE1|`。
- `|RP|` / `|PK|` 但 stripped payload 仍需 KDF upgrade 的 credential：跳过，交回现有 KDF lazy upgrade。
- HyperLiquid agent credential：`|HLP|` 明文 JSON 或 legacy `|HL|`，虽然字段里有 `privateKey`，但它不是用户钱包助记词/导入账户私钥，需要单独威胁模型和迁移方案。
- Lightning token / access token 等 simple DB 或业务 token：不在 `Credential.credential` 的 `|RP|` / `|PK|` 范围。
- Keyless cloud sync credential、sync signing/encryption keys：使用 keyless 专用 storage / secure storage 路径，不由本轮 LSE credential migration 处理。
- Hardware wallet、QR air-gapped wallet、watch-only、external wallet：本地不持有可恢复的助记词或导入私钥。
- Cloud backup / transfer 的远端或传输中 encrypted credential：这是 portable 恢复材料，不能用本机 LSE 包装；只在落本机 DB 后进入本地保护链路。

### Cloud Backup / Transfer 兼容性

LSE 只改变本机 DB 的持久化形态，不改变 Cloud Backup / Prime Transfer 的远端或传输格式。否则旧版本接收端和跨设备恢复都会失效。

必须遵守的导出规则：

1. Cloud Backup / Prime Transfer 导出本地 credential 时，不能把 raw `|LSE1|` 写入 `privateData.credentials`。
2. 导出链路必须先 unwrap `|LSE1|` 得到 inner `|RP|` / `|PK|`。
3. 然后按现有逻辑用用户 passcode 解出 secret plaintext。
4. 最后再按 Cloud Backup / Prime Transfer 自己的 portable 格式重新加密。
5. 对旧 peer 的兼容降级仍使用现有 legacy transfer credential 格式，不能把本机 LSE 当作 transfer envelope。

必须遵守的恢复规则：

1. Cloud Backup / Prime Transfer 收到的 credential 仍按现有 portable 格式解密。
2. 恢复落本机 DB 时，先生成当前 KDF v2 inner `|RP|` / `|PK|`。
3. 再由本机 `LocalSecretEnvelopeService.wrapInnerPayload()` 写成 `|LSE1|`。
4. 恢复流程不能尝试从远端或对端复制 `keychain` / `CryptoKey` / `keyRefs`。

需要改造或验证的代码入口：

- `ServiceAccount.dumpCredentials()`：不能返回 raw DB `|LSE1|`；必须返回可被 Cloud Backup / Prime Transfer 现有逻辑处理的 inner `|RP|` / `|PK|`。
- `ServicePrimeTransfer` 指定 wallet 导出路径中直接调用 `localDb.getCredential(wallet.id)` 的分支：必须确认拿到的是 unwrapped inner credential，而不是 raw record。
- `ServiceCloudBackup.buildLegacyCredentialsForBackup()`：输入必须是 inner credential；如果收到 `|LSE1|` 应 fail-fast，不能 fallback 原样输出。
- `ServicePrimeTransfer.decryptTransferDataCredentials()`、指定 wallet 导出、CLI bot wallet 导出路径：收到 `|LSE1|`、`keyRefs`、keychain id 或 IndexedDB CryptoKey id 时必须 fail-fast。
- Cloud Backup / Prime Transfer restore 写入本地 DB 的路径：新写入必须进入 LSE，但远端 payload 本身不带 LSE。

因此，正确实现后 Cloud Backup / Transfer 功能不应受影响；受影响的只是本地 DB raw dump。复制本机 DB 或把 raw `|LSE1|` 当作 backup payload 不再是有效恢复方式。

### 必须遵守的升级顺序

1. 先完成历史 DB schema / v4 -> v5 migration，把 v4 JSON credential 转成 v5 credential 结构。
2. 再执行现有 local password KDF v1 -> v2 lazy upgrade：
   - `|VS|<legacyPayload>` -> `|VS|<hex(1K_ENC_V2 target iterations payload)>`
   - `|RP|<legacyPayload>` -> `|RP|<hex(1K_ENC_V2 target iterations payload)>`
   - `|PK|<legacyPayload>` -> `|PK|<hex(1K_ENC_V2 target iterations payload)>`
3. KDF lazy upgrade 完成后，才允许执行 `LocalSecretEnvelope` migration：
   - `|VS|<hex(1K_ENC_V2 target iterations payload)>` -> `|LSE1|{...}`
   - `|RP|<hex(1K_ENC_V2 target iterations payload)>` -> `|LSE1|{...}`
   - `|PK|<hex(1K_ENC_V2 target iterations payload)>` -> `|LSE1|{...}`
4. 业务读路径 unwrap `|LSE1|` 后，必须返回 inner `|VS|...` / `|RP|...` / `|PK|...` 给现有 core secret 解密逻辑。

禁止的跳跃升级：

- 不允许 v4 JSON credential 直接写成 `|LSE1|`。
- 不允许 prefixless / unknown legacy credential 直接写成 `|LSE1|`。
- 不允许任何非 `|RP|` / `|PK|` 的 `Credential.credential` 进入 LSE credential migration。
- 不允许把 `|VS|` 当作 `Credential.credential` 迁移；`|VS|` 只能走 `Context.verifyString` 分支。
- 不允许 `|RP|` / `|PK|` 内层仍需要 KDF upgrade 时直接写成 `|LSE1|`。
- 不允许把 `|HLP|` 等非本轮目标 credential 混入 HD / imported local password migration。

## 关键流程

### 创建钱包或导入私钥

1. 使用现有 `encryptRevealableSeed()` / `encryptImportedCredential()` 生成 passcode 加密的 inner credential。
2. 根据平台调用 `LocalSecretEnvelopeService.wrapInnerPayload()`。
3. 只把 local secret envelope 写入 `Credential.credential`。
4. 不再持久化 legacy `|RP|` / `|PK|` portable credential。

### 解锁、签名、导出

1. 从 DB 读取 envelope。
2. 调用 `LocalSecretEnvelopeService.unwrapInnerPayload()` 得到 inner credential。
3. 使用 passcode 调用现有 core secret 解密逻辑。
4. 继续走现有多链派生、签名、导出流程。

### 修改 passcode

1. unwrap local secret envelope 得到 inner credential。
2. old passcode 解密得到 secret plaintext。
3. new passcode 重新生成 inner credential。
4. 已 wrapped 的记录复用原 LSE layer keyRef，刷新每层 AES-GCM IV，重新加密 inner credential 后写回 DB。
5. `verifyString` 同步执行同样流程。

### Lazy migration

迁移只能在用户成功输入 passcode 后执行：

LocalSecretEnvelope migration 是现有 local password KDF v1 -> v2 迭代次数升级之后的第二阶段迁移。不得把旧迭代次数的 `|VS|` / `|RP|` / `|PK|` 直接包进 envelope，否则后续 KDF lazy upgrade 需要先 unwrap 才能判断内层状态，会让迁移检查、批处理断点和失败恢复变复杂。

1. 先验证旧 passcode。
2. 先执行现有 local password KDF lazy upgrade，确保 `verifyString` 和所有 HD / imported credentials 已升级到当前 v2 target iterations。
3. 如果 KDF v1 -> v2 仍有剩余批次，本轮只推进 KDF upgrade，不启动 LocalSecretEnvelope migration。
4. KDF upgrade 完成后，迁移 `Context.verifyString`。
5. 批量迁移 raw value 为 `|RP|` / `|PK|` 且 KDF v2 已完成的 `Credential`，每批数量受控。
6. 每条迁移使用 compare-and-swap，只有旧值未变化才写入 local secret envelope。
7. 写入成功后不保留旧 portable credential。
8. 迁移进度优先通过 record 前缀判断；如新增 DB 字段，必须同时更新 Realm / IndexedDB schema 并 bump `LOCAL_DB_VERSION`。

新写入数据也必须先生成当前 v2 inner credential，再生成 local secret envelope。迁移后的 envelope 内层不应再包含 legacy KDF payload。

### LSE migration 触发时机

LSE migration 不在 app 启动时无条件扫描 DB。触发顺序固定为：

1. 用户成功输入 passcode，`verifyPassword()` 完成。
2. 先推进 local password KDF lazy upgrade。
3. 只有 `isLocalPasswordKdfLazyUpgradeCompleted()` 为 true，才进入 LSE 阶段。
4. 执行 `LocalSecretEnvelopeService` capability preflight。
5. preflight 通过后，按批次扫描仍未 `|LSE1|` 且满足 candidate 的 `|VS|` / `|RP|` / `|PK|`。
6. 每批最多处理固定数量，处理完本批即结束；后续批次由下一次成功解锁、显式后台任务或用户触发的维护流程继续推进。

因此，app 重启本身不会触发 LSE 升级；重启后如果用户再次成功解锁，并且 KDF gate 与 capability preflight 都通过，才会继续迁移剩余条目。

### LSE availability 与失败兼容

LSE migration 在扫描 DB 前必须先做平台能力预检：

1. 当前平台至少有一个可用 wrapping layer：Keychain / Keystore / secureStorage 或 IndexedDB `CryptoKey`。
2. 该 layer 能完成一次 test encrypt/decrypt round trip。
3. 能力检测结果能给出明确 `strength` 和 layer capability，例如 sync、extractable、keyAccess。
4. 能力不可用时，本轮不扫描 `Context` / `Credential`，不写 `|LSE1|`，不改变 legacy 数据。

能力不可用时不能反复空跑升级：

- 本进程内记录 `LocalSecretEnvelopeService` capability result，当前 app session 只做一次完整预检。
- 预检失败后只保留无敏感信息的 skip reason，例如 `secure-storage-unavailable`、`cryptokey-unavailable`、`roundtrip-failed`。
- 触发条件变化时才重试，例如平台能力从 unavailable 变为 available、用户重新解锁、版本升级、开发者显式清理 capability cache。
- 不因 LSE skip 修改 KDF lazy upgrade 状态；KDF upgrade 仍可独立推进。

LSE 写入或迁移失败必须 fail-safe：

- legacy `|VS|` / `|RP|` / `|PK|` 已存在数据继续兼容可读，不能因为 LSE 失败而失去解锁、签名、导出能力。
- 单条 record wrap 失败时，不写入半成品 `|LSE1|`，保留原 raw value。
- batch migration 中断后，下次只重试仍未包裹且仍满足 candidate 的 records。
- 单条 record 失败后，需要记录无敏感信息的 failure reason 和 retry state。不能记录 raw credential、inner payload、助记词、私钥或 passcode。
- 对同一条 record 的连续失败必须有退避策略；例如本 app session 内不重复重试同一失败 record，下一次成功解锁后才允许重试。
- 如果失败原因是 capability unavailable，本 session 不再扫描 DB；如果失败原因是 record-specific corruption / prefix mismatch，该 record 跳过并保留 legacy 可读状态，等待后续版本或维护工具处理。
- 新建 / 导入时如果 LSE 不可用，默认保持 legacy KDF v2 inner credential 写入还是阻止创建，需要由产品开关决定；但不能写入 `strength: 'unavailable'` 或 passcode-only 的 `|LSE1|`。

未来如果 local password KDF target iterations 再次提升，已 `|LSE1|` 的记录需要单独设计一轮 inner KDF migration：

```text
unwrap |LSE1|
  -> inner |VS| / |RP| / |PK|
  -> passcode decrypt with metadata
  -> re-encrypt inner with new target iterations
  -> rewrap |LSE1|
```

这不纳入本阶段 LSE migration 的实现和验收范围。本阶段只覆盖“现有 legacy `|VS|` / `|RP|` / `|PK|` 先完成当前 KDF v2 target upgrade，再写入或迁移为 `|LSE1|`”。在未来真正提升 KDF target iterations 前，必须先补充并验证上述 unwrap / upgrade inner / rewrap 流程；否则不能把已 `|LSE1|` 的记录简单视为新 KDF target 已完成。

## LocalSecretEnvelopeService 边界

上层本地 DB 不直接关心平台细节，只依赖统一接口：

```ts
type ILocalSecretEnvelopeStrength =
  | 'secure-storage-bound'
  | 'device-bound'
  | 'profile-bound'
  | 'unavailable';

type ILocalSecretEnvelopeService = {
  wrapInnerPayload(params: {
    innerPayload: string;
    dataType: 'credential' | 'verify-string';
    recordId: string;
  }): Promise<string>;

  unwrapInnerPayload(params: {
    envelope: string;
    dataType: 'credential' | 'verify-string';
    recordId: string;
  }): Promise<{
    innerPayload: string;
    strength: ILocalSecretEnvelopeStrength;
  }>;

  getStrength(): Promise<ILocalSecretEnvelopeStrength>;
};
```

`wrapInnerPayload()` 在 `getStrength()` 为 `unavailable` 时必须 throw typed unavailable error，不能返回 passcode-only `|LSE1|`。`unwrapInnerPayload()` 的 key missing / key corrupted / capability unavailable 错误也必须是 typed error；`checkPassword()` / `verifyPassword()` 只能把 inner passcode decrypt 失败视为 WrongPassword，不能把 LSE key 缺失吞成 WrongPassword。

平台实现：

- `LocalSecretEnvelopeService.desktop.ts`: 复用现有 desktop keychain / secureStorage facade，并串联 IndexedDB CryptoKey。
- `LocalSecretEnvelopeService.native.ts`: 复用现有 native keychain / secureStorage facade。
- `LocalSecretEnvelopeService.ext.ts`: IndexedDB CryptoKey。
- `LocalSecretEnvelopeService.web.ts`: IndexedDB CryptoKey；不可用时返回 `unavailable`，不写 passcode-only `|LSE1|`。

## Raw / Inner / Portable API 契约

LSE 引入后必须明确区分三种数据形态：

- raw local record
  - 示例：`LSE1` envelope，或 legacy `RP` / `PK` / `VS` record。
  - 用途：DB migration、CAS、删除、清理、KDF/LSE 判定。
  - 禁止事项：不得进入 Cloud Backup / Transfer portable payload。
- inner credential
  - 示例：`VS` / `RP` / `PK` inner encrypted payload。
  - 用途：现有 core secret passcode 解密、签名、导出前处理。
  - 禁止事项：不得直接写回普通 DB 持久化。
- plaintext secret
  - 示例：mnemonic、privateKey、verifyString plaintext。
  - 用途：改密重加密、导出显示、签名派生。
  - 禁止事项：不得日志、缓存或跨边界传递。

建议 API 命名：

| API                                                         | 返回形态                                   | 允许调用方                                           |
| ----------------------------------------------------------- | ------------------------------------------ | ---------------------------------------------------- |
| `localDb.getCredentialRaw()` / `getAllCredentialsRaw()`     | raw local record                           | KDF lazy upgrade、LSE migration、CAS、DB maintenance |
| `localDb.getCredentialInner()`                              | inner credential                           | 签名、导出、改密准备阶段                             |
| `localDb.getContextVerifyStringRaw()`                       | raw `Context.verifyString`                 | KDF/LSE migration、CAS                               |
| `localDb.getContextVerifyStringInner()`                     | inner verifyString 或 `DEFAULT_VERIFY_STRING` | `checkPassword()` / `verifyPassword()`               |
| `ServiceAccount.dumpPortableCredentialsForBackupTransfer()` | inner credential mapping                   | Cloud Backup / Prime Transfer                        |

现有 `getCredential()` / `getAllCredentials()` 不应在实现中混合 raw 和 inner 语义。如果保留旧函数名，必须在实现 PR 中明确其最终语义，并新增另一组显式 API 承担相反语义。

## 安全收益

能提升的场景：

- 业务 DB / Realm / IndexedDB credential records 被复制后，攻击者不能只靠 passcode 离线解 secret。
- Electron / native 的完整 DB 复制被 Keychain / Keystore / secureStorage key 打断；如果 keychain 使用 cloud-sync，同账号安全存储同步属于已接受边界，不等同于单设备绑定。
- Web / extension 的业务 DB dump 泄漏不能直接离线爆破。
- IndexedDB CryptoKey 阻止 raw wrapping key 通过 WebCrypto API 导出。

仍不能防的场景：

- 原设备上同权限恶意代码调用完整解密流程。
- 用户输入 passcode 后，运行时代码窃取明文 secret。
- Web / extension 完整 profile 被复制后，IndexedDB CryptoKey 可能被同 origin 复用。
- 系统 Keychain / Keystore 被用户或恶意软件授权访问。

## 产品与恢复影响

- DB 备份不再是钱包恢复材料。
- 换设备不能靠复制 DB 恢复 HD 助记词或导入私钥。
- 丢失系统 Keychain / Keystore key 后，本地钱包无法仅靠 passcode 恢复。
- 用户必须依赖助记词、私钥导出或云同步的正式恢复机制。
- 迁移前必须确保用户已完成助记词备份提醒。

## 可验证实施拆解

实施必须按依赖顺序推进。每一步都要能在不依赖后续步骤的情况下单独验证；涉及写入新 envelope 的步骤应先放在功能开关或平台能力判断后面，确保旧数据读写路径不被提前破坏。

### 1. 类型与格式准备

改动范围：

- 保持 Realm / IndexedDB schema 不变，`Credential.credential` 和 `Context.verifyString` 仍是 `string`。
- 把 `IDBCredentialBase.credential` 从只表达 `IBip39RevealableSeedEncryptHex` 的窄类型调整为可承载 `|RP|` / `|PK|` legacy inner credential 或 `|LSE1|` envelope 的字符串类型。
- 新增 `|LSE1|` 常量、`ILocalSecretEnvelopeV1` 类型、`isLocalSecretEnvelope()` 判断函数。

依赖：

- 不依赖 WebCrypto、keychain 或 DB migration。

单步验证：

- TypeScript 能通过 affected files type check。
- Realm schema、IndexedDB store 定义、`LOCAL_DB_VERSION` 不发生变化。
- legacy `|RP|` / `|PK|` 字符串和新 `|LSE1|` 字符串仍能被类型接受。

### 2. Envelope parser / serializer

改动范围：

- 新增纯函数 `serializeLocalSecretEnvelopeV1()` / `parseLocalSecretEnvelope()`。
- 校验 `version`、`dataType`、`recordId`、`wrappingLayers`、`protectedHeader`、`strength`、`ciphertext`。
- AAD 固定绑定 record 类型和 id，例如 `onekey-local-db:Credential:<credentialId>:LSE1`。

依赖：

- 依赖步骤 1 的类型和常量。
- 不依赖实际加密实现。

单步验证：

- 单元测试覆盖合法 envelope 往返序列化。
- 错误 `dataType` / `recordId` / malformed JSON / 不支持版本必须拒绝。
- parser 错误信息不得包含 `ciphertext`、inner credential、助记词、私钥或 key material。

### 3. IndexedDB CryptoKey profile layer

改动范围：

- 新增 `IndexedDbCryptoKeyLocalSecretLayer`。
- AES-GCM 256-bit wrapping key 使用 `extractable: false`，`usages` 只允许 `encrypt` / `decrypt`。
- CryptoKey 存在独立 key store，不与业务 `Credential` records 混放。
- 提供 `encrypt({ plaintext, aad })` / `decrypt({ ciphertext, layer, aad })`，不直接处理 passcode 或 DB record。

依赖：

- 依赖步骤 2 的 AAD 和 envelope 字段约定。
- 不依赖 keychain。

单步验证：

- 生成的 `CryptoKey` 调用 `crypto.subtle.exportKey('raw', key)` 应失败。
- 同一 profile key 可 decrypt 自己 encrypt 的 payload。
- 错误 AAD、错误 layer iv、删除 CryptoKey 后 decrypt 必须失败。
- Web / extension 平台能力检测失败时返回明确的不可用状态，不静默降级成 passcode-only `|LSE1|`。

### 4. 复用 keychain / secureStorage 的 device layer

改动范围：

- 新增 `SecureStorageLocalSecretLayer`，底层只复用现有统一 `secureStorage` facade。
- 在 keychain / secureStorage 中保存单个 LSE 专用全局高熵 AES wrapping key，或使用现有模块可提供的等价加解密能力。
- LocalSecretEnvelope 专用 key id 使用稳定命名，例如 `onekey:lse:secure-storage:v1`。
- 如果现有 facade 不能表达 sync / require-auth / key-access capability，本阶段保守记录 `unknown`；后续需要精确表达时，应扩展现有 facade 参数并向现有 native / desktop 实现透传，不新增另一套 OS bridge。

依赖：

- 依赖步骤 2 的 AAD 约定。
- 不依赖 IndexedDB CryptoKey；native 可单独只用这一层。

单步验证：

- mock secureStorage 可验证多条 envelope 复用同一个稳定 keyRef，keychain / secureStorage 条目不会按 credential 数量增长。
- per-record cleanup 不会删除或尝试删除全局 secureStorage key。
- 使用隔离 test keyRef 删除 keychain / secureStorage item 后，已有 envelope 无法 unwrap；Dev Settings 非破坏性自测不得删除真实全局 LSE key。
- 如果统一 `secureStorage` facade 能提供 sync capability，macOS desktop 路径必须记录真实 keychain sync 状态；当前 facade 不能区分时，envelope layer 必须保守标记 `sync: 'unknown'`。
- native 路径必须使用已有 secureStorage facade；代码中不得新增独立 Swift / Objective-C / Java / Kotlin keychain bridge。

### 5. LocalSecretEnvelopeService 平台组合

改动范围：

- 新增统一接口 `LocalSecretEnvelopeService`。
- `desktop` 组合顺序：先 IndexedDB CryptoKey profile layer，再 keychain / secureStorage device layer。
- `native` 默认只使用 keychain / secureStorage device layer。
- `ext` / `web` 只使用 IndexedDB CryptoKey profile layer。
- envelope 的 `wrappingLayers`、capabilities 和 runtime `strength` 必须反映实际使用层级。

依赖：

- 依赖步骤 3 和 / 或步骤 4。
- 不依赖 credential read/write 改造。

单步验证：

- desktop mock 两层时，输出 envelope 包含 `keychain` 和 `indexeddb-cryptokey` 两个 ordered layers，`strength` 为 `secure-storage-bound` 或更具体的 runtime strength。
- desktop keychain 不可用但 CryptoKey 可用时，`strength` 为 `profile-bound`。
- ext / web 输出不包含 `keychain` / `keystore`，`strength` 为 `profile-bound`。
- wrong `recordId` 或 wrong `dataType` unwrap 必须失败。

### 6. 兼容读路径

改动范围：

- 增加 raw record 读取能力，供 migration / CAS 使用。
- 业务兼容读路径在返回给现有调用方前自动 unwrap `|LSE1|`，legacy `|RP|` / `|PK|` / `|VS|` 原样返回。
- `checkPassword()` / `verifyPassword()` 在解密 `Context.verifyString` 前先 unwrap envelope。
- `getCredential()` 等业务读入口继续返回 passcode-encrypted inner credential，避免所有链签名调用方一次性改造。
- `ServiceAccount.dumpCredentials()` 以及 Cloud Backup / Prime Transfer 依赖的 credential 导出入口必须返回 unwrapped inner credential，不能泄漏 raw `|LSE1|` 到 portable payload。

依赖：

- 依赖步骤 5。
- 必须早于任何新 envelope 写入。

单步验证：

- 旧 DB 中的 legacy `verifyString` 和 credentials 仍可校验密码、签名、导出。
- 手工构造的 `|LSE1|` `verifyString` 可被 `checkPassword()` 正常校验。
- 手工构造的 `|LSE1|` credential 经 `getCredential()` 读取后，现有 core secret 解密函数能用 passcode 解开。
- 手工构造的 `|LSE1|` credential 经 `dumpCredentials()` / Prime Transfer 指定 wallet 导出后，导出 payload 中不包含 raw `|LSE1|`。
- KDF lazy upgrade 和后续 migration 使用 raw record，不会因为业务读路径 unwrap 而破坏 compare-and-swap。

### 7. 新写入 credential 进入 envelope

改动范围：

- 收敛 HD 钱包创建、TON mnemonic imported、普通 imported private key 等 credential 写入点。
- 不在通用 `txAddRecords()` 里自动包装，避免影响非 credential store。
- 新写入流程必须先生成当前 KDF v2 inner credential，再调用 `LocalSecretEnvelopeService.wrapInnerPayload()`。
- 写入 DB 的 `Credential.credential` 必须是 `|LSE1|...`，不再是直接可由 passcode 解开的 portable credential。
- 这一阶段必须在修改 passcode 链路兼容完成后才能解除 feature gate；否则新写入的 `|LSE1|` 会让旧改密流程失败。

依赖：

- 依赖步骤 6 的兼容读路径。
- 依赖步骤 9 的修改 passcode 兼容。
- 依赖现有 KDF v2 加密函数。

单步验证：

- 新建 HD 钱包后，DB raw credential 以 `|LSE1|` 开头。
- 导入私钥后，DB raw credential 以 `|LSE1|` 开头。
- 新建 / 导入后立即修改 passcode 成功。
- 业务读取得到 inner credential 后，签名和导出仍走现有多链流程。
- raw DB 中不出现新写入的 `|RP|` / `|PK|` portable credential。

### 8. `verifyString` 写入进入 envelope

改动范围：

- `setPassword()` / `updatePassword()` / `txUpdateContextVerifyString()` 的新 `verifyString` 写入改为 wrapped envelope。
- 创建密码和修改密码都必须先生成当前 KDF v2 `|VS|` inner payload，再包装为 `|LSE1|`。
- `DEFAULT_VERIFY_STRING` 仍保持特殊未设置状态，不包装。
- 这一阶段必须与修改 passcode 链路兼容一起启用，不能先于步骤 9 单独上线。

依赖：

- 依赖步骤 6 的 `checkPassword()` 兼容读路径。
- 依赖步骤 9 的修改 passcode 兼容。

单步验证：

- 新设置密码后，raw `Context.verifyString` 以 `|LSE1|` 开头。
- `isPasswordSet()`、`verifyPassword()` 行为保持不变。
- reset password set 后仍写回 `DEFAULT_VERIFY_STRING`，不会尝试 unwrap。
- DB raw data 中不再存在新写入的 passcode-only `|VS|` oracle。

### 9. 修改 passcode 链路

改动范围：

- `buildCredentialPasswordUpdate()` 先 unwrap raw credential 得到 inner credential，再用 old passcode 解出 secret plaintext。
- 使用 new passcode 生成新的 KDF v2 inner credential 后，复用原 LSE layer keyRef、刷新 IV 重新 wrap。
- `verifyString` 同步执行 unwrap -> old passcode decrypt -> new passcode encrypt -> 复用 keyRef 并 rewrap。
- password update 的 CAS 比较必须比较 raw original envelope，而不是 unwrap 后的 inner credential。
- `verifyString` 也必须保存 `originalVerifyStringRaw`，事务内 compare-and-swap；如果 raw 值已变化则 abort。
- password change candidate 必须复用统一 `classifyLocalPasswordCredential(raw)`，不能只按 id 前缀判断。
- 如果改密时把所有 local-password candidates 都重写成当前 KDF v2 inner payload 并写成 LSE，必须在同一事务内原子设置 `localPasswordKdfUpgraded=true`、`localPasswordKdfUpgradedTargetIterations=current`、`localPasswordKdfUpgradeLastScannedCredentialId=''`。否则改密只重写当前 credential，不做 LSE wrap，等 KDF completion flag 完成后再迁移。

依赖：

- 依赖步骤 6。
- 必须早于步骤 7 / 8 的新 LSE 写入解除 feature gate。

单步验证：

- legacy credentials 修改 passcode 后可迁移为 `|LSE1|` 并可用 new passcode 解密。
- 已 wrapped credentials 修改 passcode 后仍保持 `|LSE1|`，old passcode 失效，new passcode 可签名和导出。
- 并发修改 credential 时 CAS 能阻止覆盖更新。

### 10. KDF lazy upgrade gate

改动范围：

- 保留现有 local password KDF v1 -> v2 lazy upgrade 作为第一阶段。
- `verifyPassword()` 成功后，如果 KDF lazy upgrade 未完成，只推进 KDF upgrade，不启动 LocalSecretEnvelope migration。
- 只有 `isLocalPasswordKdfLazyUpgradeCompleted()` 为 true 后，才允许启动 LocalSecretEnvelope migration。
- KDF upgrade 只改变 `|VS|` / `|RP|` / `|PK|` stripped payload 的 `1K_ENC_V2` 状态和 iterations，不改变最外层业务前缀。
- LSE migration 只允许在成功解锁后的后台 lazy task 或显式维护流程中启动，不能在 app 启动时无条件扫描 DB。

依赖：

- 依赖步骤 6 的 raw 读能力。
- 必须早于步骤 11 / 12 的 migration。

单步验证：

- 构造低迭代次数 legacy `verifyString` / credential 后，首次 verify 只完成或推进 KDF upgrade。
- KDF upgrade 有剩余批次时，raw `|VS|` / credential 不会被包进 `|LSE1|`。
- KDF upgrade 完成后，raw `verifyString` 仍以 `|VS|` 开头，raw credential 仍以 `|RP|` / `|PK|` 开头，但 stripped payload 已是当前 target iterations 的 `1K_ENC_V2`。
- 仅重启 app、未成功解锁时，不会触发 LSE migration。

### 11. `verifyString` LocalSecretEnvelope migration

改动范围：

- KDF gate 完成后，优先迁移 `Context.verifyString`。
- 如果 raw `verifyString` 已是 `|LSE1|` 或为 `DEFAULT_VERIFY_STRING`，跳过。
- migration 前必须确认 stripped `|VS|` payload 不再需要 KDF upgrade；`shouldUpgradeSecretEncryptPayload()` 返回 `true` 时跳过，交回 KDF lazy upgrade。
- 对 legacy `|VS|` 使用 compare-and-swap 写入 envelope。
- 迁移失败时保留 legacy `|VS|`，本 session 不反复重试同一失败项。

依赖：

- 依赖步骤 8 和步骤 10。

单步验证：

- KDF v2 legacy `verifyString` 成功迁移为 `|LSE1|`。
- 迁移后 `verifyPassword()` 正常。
- 构造 `|VS|` 但 stripped payload 仍需 KDF upgrade 的记录，本轮不会被 LSE migration 包装。
- 构造 wrap 失败后，legacy `|VS|` 仍可用于下次解锁；重启后必须在用户成功解锁且 preflight 通过后才重试。
- 并发修改 `verifyString` 时 CAS 不覆盖新值。
- 迁移失败时错误日志不包含 `|VS|` payload 或 passcode。

### 12. Credential LocalSecretEnvelope migration

改动范围：

- 扫描 raw credentials，candidate 判定只看最窄条件：raw value 以 `|RP|` 或 `|PK|` 开头，且尚未 `|LSE1|`。
- migration 前必须确认 stripped payload 不再需要 KDF upgrade；`shouldUpgradeSecretEncryptPayload()` 返回 `true` 的记录本轮跳过，交回 KDF lazy upgrade。
- record id 只做二次校验和选择解密函数：`accountUtils.isHdWallet()` + `|RP|`、`accountUtils.isTonMnemonicCredentialId()` + `|RP|`、`accountUtils.isImportedAccount()` + `|PK|` 才迁移。
- id 与前缀不匹配、prefixless、unknown prefix、`|HLP|` 等记录必须跳过，不能推测或强行包进 `|LSE1|`。
- 每批数量受控，逐条 wrap，逐条 compare-and-swap。
- 单条失败时保留 legacy raw value，记录无敏感 retry state，本 session 不反复重试同一失败项。
- 使用 Local DB `Context` 中的持久化 marker 记录 KDF 与 LSE migration 进度；对应 Realm / IndexedDB schema 必须同步更新，并 bump `LOCAL_DB_VERSION`。

依赖：

- 依赖步骤 7、10、11。

单步验证：

- legacy HD credential 迁移后 raw value 以 `|LSE1|` 开头，业务签名仍正常。
- legacy imported private key 迁移后 raw value 以 `|LSE1|` 开头，导出仍正常。
- unwrap 后 inner credential 仍是 `|RP|` 或 `|PK|`，并且 stripped payload 是当前 target iterations 的 `1K_ENC_V2`。
- 构造 `|RP|` / `|PK|` 但 stripped payload 仍需 KDF upgrade 的记录，本轮不会被 LSE migration 包装。
- 构造 id 与前缀不匹配的记录，例如 `hd*` + `|PK|` 或普通 `imported*` + `|RP|`，必须跳过。
- 非 local password credential，例如不属于 `hd*` / `imported*` 的记录，不被误迁移。
- 中断后再次执行 migration 只处理剩余 legacy records。
- 单条 wrap 失败后仍可通过 legacy inner credential 签名 / 导出；重启后必须在用户成功解锁且 preflight 通过后才重试。
- 删除 IndexedDB CryptoKey 后，对应已迁移 records 无法 unwrap；使用隔离 test keyRef 删除 keychain / secureStorage key 后，对应 test envelope 无法 unwrap。真实 LSE 全局 keychain key 不参与 per-record 删除测试。

### 13. 平台与恢复验证

改动范围：

- Electron / native / extension / web 分平台跑能力检测和降级标记。
- 增加安全日志和用户可理解的恢复错误，但不得输出 secret、inner credential、outer plaintext 或 wrapping key。
- DB backup / restore 文案和错误提示必须反映：复制 DB 不再是钱包恢复方式。
- Cloud Backup / Prime Transfer 导出仍使用 portable credential 格式，restore 落本机 DB 后再写成 LSE。

依赖：

- 依赖步骤 5、7、8、12。

单步验证：

- Desktop dev E2E 提供 `yarn test:e2e:desktop:lse`：启动 Electron 后调用 dev-only self-test，验证 `Context.verifyString` 和测试 HD credential 都写成 `|LSE1|`，且 wrapping layers 同时包含 `indexeddb-cryptokey` 与 `secure-storage`。
- `yarn test:e2e:desktop:lse` 会删除测试 credential 的 IndexedDB CryptoKey，并使用隔离 test keyRef 验证 secureStorage key 删除会阻断 unwrap；自检结束后必须清理测试 DB records 和 per-credential IndexedDB CryptoKey，不得删除真实 LSE 全局 secureStorage key。
- Web dev E2E 提供 `yarn test:e2e:web:lse`：启动 web dev server 后调用同一 dev-only self-test，验证 web 平台只写入 `indexeddb-cryptokey` 单层 `|LSE1|`，`strength` 为 `profile-bound`。
- `yarn test:e2e:web:lse` 会删除测试 credential 的 IndexedDB CryptoKey，并确认 DB record 无法 unwrap；web 路径不得出现 `secure-storage` / keychain layer。
- Extension dev E2E 提供 `yarn test:e2e:ext:lse`：构建并加载 MV3 unpacked extension，在 extension background service worker 调用同一 dev-only self-test，验证 extension 平台只写入 `indexeddb-cryptokey` 单层 `|LSE1|`，`strength` 为 `profile-bound`。
- `yarn test:e2e:ext:lse` 会删除测试 credential 的 IndexedDB CryptoKey，并确认 DB record 无法 unwrap；extension 路径不得出现 `secure-storage` / keychain layer。该脚本需要 Chrome / Chromium 允许命令行加载 unpacked extension；如果当前系统 Chrome 禁用 `--load-extension`，脚本会 fail-fast，并可通过 `EXT_E2E_BROWSER_EXECUTABLE` / `EXT_E2E_EXTENSION_ID` 指定可用环境。
- Native harness E2E 提供 `yarn test:e2e:native:lse` 和 `yarn test:e2e:native:lse:android`：在 iOS / Android React Native harness 中验证 secureStorage layer 可以 wrap / unwrap，并且删除 native secureStorage key 后无法 unwrap。
- Native harness 需要已启动的 iOS simulator，或已授权的 Android device / emulator。它只验证平台 secureStorage adapter 和 key missing 错误，不替代完整手机端创建钱包、云恢复或 Prime Transfer UI 流程。
- Dev Settings 面板提供 `Run Local Secret Envelope Self-Test` 调试按钮，调用非破坏性的 `runLocalSecretEnvelopeDebugSelfTest()`。该入口只创建临时 LSE records / keys，验证完成后清理临时数据，不得复用会清空 wallets/accounts/password 的隔离 E2E self-test。
- Dev Settings 面板提供 `Run LSE Restore Self-Test` 调试按钮，调用非破坏性的 `runLocalSecretEnvelopeRestoreSelfTest()`。该入口创建一条临时 imported `|PK|` credential，写成本机 `|LSE1|` 后验证 `localDb.getCredentialInner()` 能读回 portable inner credential，并验证 Cloud Backup / Prime Transfer 导出 guard 接受 inner `|PK|`、拒绝 raw `|LSE1|`。
- `Run LSE Restore Self-Test` 只覆盖服务层恢复落库和 portable export 边界，不覆盖 Cloud Backup 文件选择、网络 / Google Drive、Prime Transfer socket / 房间配对、恢复 UI 确认页等完整产品流程。
- Electron 缺失 keychain / secureStorage 全局 key 后，DB 中 envelope 无法 unwrap，错误提示指向本机安全密钥缺失；删除该全局 key 只允许出现在明确 reset / destroy 或隔离 test keyRef 场景。
- Native 缺失 secureStorage key 后，DB 中 envelope 无法 unwrap；删除真实全局 key 只允许出现在明确 reset / destroy 场景。
- Extension 删除 IndexedDB CryptoKey 后，credential records 无法 unwrap。
- Web / extension 的 `strength` 不会显示为 `device-bound`。
- 单元测试覆盖 Cloud Backup 导出保护：raw `|LSE1|` 会被拒绝，portable `|RP|` / `|PK|` 会重新编码成旧版备份格式并保持可解。
- 单元测试覆盖恢复落库保护：Cloud Backup / Prime Transfer 恢复出的 imported `|PK|` 通过本地 DB 写入路径后，raw DB credential 必须变为 `|LSE1|`，inner credential 仍可按 passcode 解开。
- Cloud Backup / Prime Transfer 导出 payload 不包含 `|LSE1|`、`keyRefs`、keychain id 或 IndexedDB CryptoKey id。
- Cloud Backup / Prime Transfer restore 后，本地 raw DB credential 以 `|LSE1|` 存储，业务签名 / 导出仍正常。
- 完整 Cloud Backup restore 与 Prime Transfer restore UI 流程属于产品回归验证：它覆盖文件选择、网络 / Google Drive、socket / 房间配对和恢复确认页，不作为 LSE cryptographic boundary 的唯一验收条件。LSE 安全验收以本步骤的平台 E2E、Dev Settings restore self-test 和服务层单元测试为准；产品回归可复用 Dev Settings restore self-test 检查最终落库结果。
- 所有新增日志通过静态搜索确认不包含 mnemonic、privateKey、inner credential、wrapping key。

## 总体验收标准

- 新建 HD 钱包、导入私钥后，DB 中不存在可直接由 passcode 解开的 `|RP|` / `|PK|` 字符串。
- `Context.verifyString` 不再提供 passcode-only 离线校验 oracle。
- Electron DB 复制到另一台机器后，缺少 Keychain key 时无法 unwrap。
- Web / extension 删除 IndexedDB CryptoKey 后，credential records 无法 unwrap。
- 修改 passcode 后，所有 wrapped credentials 可用 new passcode 正常签名和导出。
- legacy credential 可在用户成功输入 passcode 后迁移，迁移中断可恢复。
- 所有错误日志不包含助记词、私钥、inner credential、outer plaintext 或 wrapping key。
