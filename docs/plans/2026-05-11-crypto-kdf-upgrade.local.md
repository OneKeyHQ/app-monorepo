# Crypto KDF and AES-GCM upgrade reference

日期：2026-05-11

## 目标

本文档记录基于密码的加密升级设计结论，重点包括 PBKDF2 迭代次数、AES-GCM 采用、lazy upgrade、legacy payload 检测、移动端原生 crypto，以及数据共享兼容性。

首要规则是：不要直接修改 `PBKDF2_NUM_OF_ITERATIONS` 并假设旧数据仍能工作。现有加密 payload 不记录迭代次数，因此修改默认值会导致 legacy payload 无法读取。

## 当前状态

- `packages/shared/src/appCrypto/consts.ts` 定义了 `PBKDF2_NUM_OF_ITERATIONS = 5000`。
- `packages/core/src/secret/encryptors/aes256.ts` 已经在 `encryptAsync`、`decryptAsync`、`encryptStringAsync` 和 `decryptStringAsync` 中接受可选的 `iterations` 参数。
- Legacy AES-CBC payload 格式是 `salt + iv + ciphertext`。它没有 magic、version、cipher metadata、KDF metadata、iteration count 或 MAC。
- 现有 AES-GCM payload 格式是 `1K_AES_GCM + salt + nonce + ciphertext||tag`。它可以识别 GCM mode，但仍然不记录 iteration count。
- 移动端原生目前使用 `react-native-aes-crypto` 处理 PBKDF2 和 AES-CBC。
- AES-GCM 目前通过 `packages/shared/src/appCrypto/modules/aesGcm.ts` 使用 `@noble/ciphers` JavaScript 实现。

## 安全结论

- 新 payload 首选 AES-GCM，因为它是 AEAD mode。它在同一个构造中同时提供机密性和认证。
- 当前 AES-CBC 用法只负责加密。除非额外添加独立 MAC，否则它不会认证 ciphertext 或 metadata。当前存储格式不包含 MAC。
- AES-GCM 在同一个派生 key 下，每次加密都必须使用唯一 nonce。推荐 nonce 长度为 12 bytes。
- plaintext 被使用前，必须先验证 authentication tag。
- Version、KDF、iteration count、cipher mode、data type 和其他 header metadata 应通过 AES-GCM AAD 认证。
- 不要通过尝试多种 mode 或 iteration count 直到某个成功的方式实现解密。解密必须由明确的 magic/version markers 选择。

## 新 Payload 格式

为新写入引入 versioned envelope，例如 `1K_ENC_V2`。

v2 envelope 应明确包含：

- `version`
- `cipher`，初始为 `aes-256-gcm`
- `kdf`，初始为 `pbkdf2-sha256`
- `iterations`
- `salt`
- `nonce`
- `ciphertext`
- `tag`
- 当调用方能提供稳定 domain separation 时，可选 `dataType` 或 `purpose`

推荐布局：

- 如果希望保持当前 hex/base64 存储的效率，使用紧凑的 binary header。
- 在 AES-GCM AAD 中包含确定性的 header encoding。
- 保持输出与现有存储类型兼容：`encryptAsync` 返回 bytes，`encryptStringAsync` 返回 hex，只有已经这样做的 caller layer 才使用 base64。

解密分发顺序应为：

1. 如果 payload 以 `1K_ENC_V2` 开头，解析 v2 header，并使用 header 中定义的参数解密。
2. 否则，如果 payload 以 `1K_AES_GCM` 开头，按 legacy GCM 解密；除非调用方显式传入 `iterations`，否则使用 legacy 默认 iteration count。
3. 否则，按 legacy CBC 解密；除非调用方显式传入 `iterations`，否则使用 legacy 默认 iteration count。

代码中这三类 payload mode/version 必须用枚举表达，并在注释里保持语义清晰：

- `legacyCbc`：最老的格式，`salt + iv + ciphertext`，没有 magic header、version、cipher/KDF metadata 或 authenticated header。
- `legacyGcm`：带 `1K_AES_GCM` magic header 的 legacy AES-GCM 格式，能认证 ciphertext/AAD，但没有完整 version、KDF 或 iterations metadata。它只用于 Keyless 相关特定路径，例如 Keyless Cloud Sync item、Keyless encrypted mnemonic、Keyless backend share payload 和本地 keyless sync credential map；大部分历史 legacy payload 仍是 `legacyCbc`。
- `v2`：本次升级的新 envelope，magic header 为 `1K_ENC_V2`，包含 version、cipher、KDF、iterations、salt、nonce 和 authenticated `dataType` metadata。

Legacy 默认 iteration count 必须保留为一个具名常量，并与新的写入目标分离。例如：

- `PBKDF2_LEGACY_NUM_OF_ITERATIONS = 5000`
- `PBKDF2_CURRENT_NUM_OF_ITERATIONS = 600_000`

### 默认写入策略

不能长期依赖业务调用方手动传 `format: 'v2'`。这个参数只适合 Phase 1 primitive tests、少量兼容性 fallback 和协议 gate 内部使用；如果让每个业务调用自行记住传参，新增路径很容易静默落回 legacy CBC + 5000 iterations。

后续 non-native rollout 应引入中心化 write policy，而不是把格式选择散落到业务层：

- 低层 crypto primitive 继续保留显式 legacy/v2 能力，用于 legacy read、测试、兼容性 gate 和迁移工具。
- 对 local-only human-password/passcode paths，storage owner 或 service-level helper 应默认写 v2，并使用 `PBKDF2_CURRENT_NUM_OF_ITERATIONS = 600_000` 或 benchmark 后确认的目标值。
- 对 shared/server-visible paths，必须走统一 shared encrypt policy。该入口不传 `format` 时默认 legacy；后续只能按 `sharedScene`、compatibility gate、peer/server capability 或显式 `format` 精确切到 v2。
- 新增持久化加密调用不应直接调用 bare `encryptAsync` / `encryptStringAsync` 选择默认值；应通过场景化 helper 或显式 policy，例如 local credential、local verify string、backup shared payload、cloud sync shared payload。
- 后续测试必须覆盖“未显式选择 legacy 的 local-only write 默认产出 `1K_ENC_V2`”，避免回归到 legacy。

## Lazy Upgrade 策略

Lazy upgrade 不应作为隐式写入隐藏在低层 `decryptAsync` 内部。

推荐 API 形态：

- 普通业务读路径继续使用 `decryptAsync`。它必须自动兼容 legacy CBC、legacy GCM 和 v2，并且只返回 plaintext。
- Metadata decrypt helper 只用于本地 lazy upgrade 决策，返回 plaintext 加 metadata，例如 `{ plaintext, format, version, iterations, cipher, needsUpgrade }`。
- `decryptAsyncWithMetadata` 不应被当成普通业务 read API 到处调用；后续应收窄为 owner-specific helpers，例如 `decryptVerifyStringWithMetadata`、`decryptRevealableSeedWithMetadata`、`decryptImportedCredentialWithMetadata`，只给 local DB / credential owner 用。
- 保持低层 crypto layer 无副作用。
- 由 storage owner 决定 record 是否可以安全重写。
- 仅在密码验证成功或本地解密成功之后重写。
- 尽可能使用 transaction 或 compare-and-swap 语义。
- 记录聚合迁移数量和失败信息，但不要记录 secrets 或 ciphertext。

仅本地持久化数据可以更早做 lazy upgrade。共享数据或 server-visible 数据必须由兼容性规则把关。

## 受影响的本地持久化数据

这些数据类别可能受默认 KDF/cipher 变更影响：

- Password verification string：`IDBContext.verifyString`，由 `encryptVerifyString` 写入，由 `decryptVerifyString` 读取。
- `ELocalDBStoreNames.Credential` 中的本地 credentials：
  - HD wallet revealable seed，前缀为 `|RP|`。
  - Imported private key credential，前缀为 `|PK|`。
  - Ton mnemonic credential，像 revealable seed 一样存储在 imported-account 相关 ids 下。
  - 可能存在 legacy HyperLiquid `|HL|` records，但当前 `|HLP|` agent credentials 是 plaintext JSON，不应通过基于密码的加密迁移。
- Biology auth 和 passkey password storage：secure storage item `password`，通过 `encodeSensitiveTextAsync` 保存。
- Prime master password 本地缓存：`primeMasterPasswordPersistAtom.encryptedSecurityPasswordR1`。
- Keyless local storage：
  - Device pack，目前是临时且 deprecated。
  - Refresh token。
  - Access token。
  - Mnemonic password。
  - Keyless sync credential map，目前是 GCM 且 `iterations: 1`。
  - Keyless encrypted mnemonic，目前是 GCM 且使用 `KEYLESS_ENCRYPTION_ITERATIONS`。
- 本地交易历史 `decodedTx.encodedTxEncrypted`，通过 `servicePassword.encryptByInstanceId` 创建。
- Local DB backup bucket，会复制 account bucket records，包括 `Credential`、`Context` 和 `CloudSyncItem`。
- 任何持久化 `servicePassword.encryptString` 或 `servicePassword.encryptByInstanceId` 结果的通用 caller。

本地迁移应优先关注 `Context.verifyString` 和 `Credential`，因为它们是解锁和派生 private keys 所必需的。

## 受影响的共享数据

共享数据不能仅仅因为新客户端读取了它就升级。如果共享 payload 被重写为旧客户端无法理解的格式，旧客户端可能立即失去访问能力。

受影响的共享场景：

- Prime Cloud Sync：
  - `CloudSyncItem.data` 会同步到 server，并被多个客户端读取。
  - OneKey ID mode 当前使用 `encryptStringAsync` 默认值。
  - Keyless mode 使用自己的 AES-GCM 路径，且 `iterations: 1`。
- Cloud Backup V1/V2：
  - Backup payloads 包含加密的 private data 和 credentials。
  - 旧 backup payloads 必须保持可读。
  - 新 backup writes 需要 backup-format version 和 compatibility gate。
- Prime Transfer：
  - Pairing verification 使用 `encryptAsync` 和 pairing code。
  - Transfer payloads 使用 E2EE connection key 加密。
  - `privateData.decryptedCredentialsHex` 使用 `encryptStringAsync`。
  - 新客户端可能向旧客户端 transfer，因此写入 v2 前需要 peer capability 或 protocol version。
- Prime master password server payload：
  - `encryptedSecurityPasswordR1ForServer` 保存在 server 上，并跨设备使用。
  - 它需要严格的 read compatibility 和 write gating。
- Keyless cloud sync and backup：
  - Keyless cloud sync encrypted items 和 backup payloads 可能被另一台客户端恢复。
  - 它们需要独立的 format versioning，因为它们已经使用不同 KDF 参数。
- CLI BotWallet export or transfer：
  - 如果 CLI 消费加密 payload，则 CLI format support 必须独立 versioned。

## Phase 0 Inventory

本节按生产持久化影响面整理当前调用方。测试、Developer Gallery、底层 wrapper implementation 不算 rollout 阻塞项，但需要随 v2 primitives 更新测试断言。

### 本地持久化写入

| Path | Call | Data | Current key source | Upgrade priority |
| --- | --- | --- | --- | --- |
| `packages/core/src/secret/index.ts:197` | `encryptVerifyString` -> `encryptAsync` | `IDBContext.verifyString` password verification string | App password / raw migration password | P0 local lazy upgrade。解锁入口，必须保持 legacy read。 |
| `packages/core/src/secret/index.ts:236` | `encryptRevealableSeed` -> `encryptStringAsync` | HD revealable seed credential with `\|RP\|` prefix | App password | P0 local lazy upgrade。派生 private keys 所必需。 |
| `packages/core/src/secret/index.ts:277` | `encryptImportedCredential` -> `encryptStringAsync` | Imported private key credential with `\|PK\|` prefix | App password | P0 local lazy upgrade。Imported accounts 所必需。 |
| `packages/kit-bg/src/services/ServicePassword/biologyAuthUtils.ts:44` | `encodeSensitiveTextAsync` | Biology auth stored password | Background sensitive-text key or supplied key | P1 local migration。依赖 secure storage owner 控制 rewrite。 |
| `packages/kit-bg/src/services/ServicePassword/biologyAuthUtils.ts:70` | `encodeSensitiveTextAsync` | Biology auth migration/re-key path | Supplied key | P1 local migration。需与 secure storage compatibility 一起处理。 |
| `packages/kit-bg/src/services/ServicePassword/index.ts:182` | `encryptByInstanceId` -> `encodeSensitiveTextAsync` | Generic instance-id encrypted local strings | App instance id | P2 local migration。不是 password-hardening path，重点是 format versioning。 |
| `packages/kit-bg/src/services/ServiceHistory.ts:1440` | `servicePassword.encryptByInstanceId` | `decodedTx.encodedTxEncrypted` local replace-tx payload | App instance id | P2 local migration。失败不应影响历史记录展示或 replace-tx flow。 |
| `packages/kit-bg/src/services/ServiceMasterPassword/ServiceMasterPassword.tsx:238` | `encryptSecurityPassword` -> `encryptStringAsync` | Local `encryptedSecurityPasswordR1` cache | Local passcode-derived key | P1 local lazy upgrade。Human-entered passcode path，KDF upgrade 有价值。 |
| `packages/kit-bg/src/services/ServiceKeylessWallet/utils/keylessSyncCredentialStorage.ts:49` | `encryptStringAsync` | Local keyless sync credential map | Fixed storage key, `iterations: 1`, GCM | P2 format migration only。不是 KDF security hardening。 |
| `packages/kit-bg/src/vaults/*/Vault.ts` | `encodeSensitiveTextAsync` | Imported private key input before credential creation | Background sensitive-text key | Usually transient/local handoff。Credential record 仍由 core credential encryptors 管控。 |
| `apps/cli/src/signer/base/SignerSoftwareBase.ts:401` | `encodeSensitiveTextAsync` | CLI software signer password placeholder | CLI constant | CLI-specific compatibility review。不要混入 app local DB rollout。 |

### 共享、跨设备或 server-visible 写入

| Path | Call | Data | Current key source | Gate required |
| --- | --- | --- | --- | --- |
| `packages/kit-bg/src/services/ServicePrimeCloudSync/cloudSyncItemBuilder.ts:238` | `encryptStringAsync` | `CloudSyncItem.data` in OneKey ID mode | `primeAccountSalt + securityPasswordR1` | Yes。Server/client compatibility gate before v2 writes。 |
| `packages/kit-bg/src/services/ServicePrimeCloudSync/keylessCloudSyncUtils.ts:125` | `encryptStringAsync` | Keyless Cloud Sync item data | Seed-derived encryption key, `iterations: 1`, GCM + AAD | Yes for format changes。No KDF iteration upgrade required by default。 |
| `packages/kit-bg/src/services/ServiceCloudBackup/index.ts:225` | `encryptAsync` | Legacy Cloud Backup private data | Backup password | Yes。Backup format version selection required。 |
| `packages/kit-bg/src/services/ServiceCloudBackupV2/ServiceCloudBackupV2.ts:245` | `encryptAsync` | Cloud Backup V2 `privateDataEncrypted` | Backup password plus backup salt | Yes。Backup V2 manifest/version gate required。 |
| `packages/kit-bg/src/services/ServiceCloudBackupV2/backupProviders/ICloudBackupProvider.ts:208` | `encryptStringAsync` | iCloud Backup V2 password verify record | Backup password plus fixed salt | Yes。Shared iCloud record must stay readable by supported clients。 |
| `packages/kit-bg/src/services/ServiceCloudBackupV2/backupProviders/GoogleDriveBackupProvider.ts:67` | `encryptStringAsync` | Google Drive Backup V2 password verify file | Backup password plus fixed salt | Yes。Shared file must stay readable by supported clients。 |
| `packages/kit-bg/src/services/ServicePrimeTransfer/ServicePrimeTransfer.ts:604` | `encryptAsync` | Pairing-code verification payload | Short pairing code | Yes。Protocol capability/min-version gate required。 |
| `packages/kit-bg/src/services/ServicePrimeTransfer/ServicePrimeTransfer.ts:1436` | `encryptAsync` | E2EE transfer payload | ECDHE/session-derived `connectedEncryptedKey` | Yes for format changes。Prefer HKDF/session envelope over PBKDF2 iteration increase。 |
| `packages/kit-bg/src/services/ServicePrimeTransfer/ServicePrimeTransfer.ts:1562` | `encryptStringAsync` | `privateData.decryptedCredentialsHex` embedded in transfer payload | App password supplied during send | Yes。Peer/client compatibility gate required before v2. |
| `packages/kit-bg/src/services/ServiceMasterPassword/ServiceMasterPassword.tsx:155` | `encryptSecurityPasswordForServer` -> `encryptStringAsync` | `encryptedSecurityPasswordR1ForServer` | Master-password-derived server key | Yes。Server-visible cross-device payload, gate required。 |
| `packages/kit-bg/src/services/ServiceKeylessWallet/ServiceKeylessWallet.ts:1255` | `encryptKeylessMnemonic` -> `encryptStringAsync` | Keyless encrypted mnemonic | Mnemonic password, `KEYLESS_ENCRYPTION_ITERATIONS`, GCM + AAD | Yes。Human-entered/password-like path; preserve explicit iteration metadata in v2。 |
| `packages/kit-bg/src/services/ServiceKeylessWallet/ServiceKeylessWallet.ts:1581` | `encryptStringAsync` | Keyless backend share payload | Fixed server payload key, `KEYLESS_ENCRYPTION_ITERATIONS`, GCM + AAD | Yes for format changes。KDF hardening value depends on replacing fixed key source。 |
| `packages/shared/src/keylessWallet/keylessWalletUtils.ts:279` | `encryptAsync` | Device key pack | Runtime keyless package password | Gate if persisted/shared beyond temporary setup flow。 |
| `packages/shared/src/keylessWallet/keylessWalletUtils.ts:317` | `encryptAsync` | Auth key pack | Runtime keyless package password | Gate if persisted/shared beyond temporary setup flow。 |
| `packages/shared/src/keylessWallet/keylessWalletUtils.ts:346` | `encryptAsync` | Cloud key pack | Runtime keyless package password | Gate if persisted/shared beyond temporary setup flow。 |

### Migration、derived-key cache 和非持久化输出

| Path | Call | Classification |
| --- | --- | --- |
| `packages/kit-bg/src/migrations/v4ToV5Migration/v4local/V4LocalDbBase.ts:210` | `encryptAsync` | V4->V5 migration writes local credentials. Needs legacy read plus v2 target decision after local lazy upgrade APIs exist。 |
| `packages/kit-bg/src/migrations/v4ToV5Migration/v4local/V4LocalDbBase.ts:235` | `encryptAsync` | V4->V5 migration re-encrypts seed data. Same local migration policy as credentials。 |
| `packages/kit-bg/src/migrations/v4ToV5Migration/v4local/V4LocalDbBase.ts:238` | `encryptAsync` | V4->V5 migration re-encrypts imported credential data。 |
| `packages/kit-bg/src/migrations/v4ToV5Migration/V4MigrationForAccount.ts:776` | `encodeSensitiveTextAsync` | Migration-only password wrapping before credential writes。 |
| `packages/kit-bg/src/migrations/v4ToV5Migration/V4MigrationForSecurePassword.ts:13` | `encodeSensitiveTextAsync` | Migration-only secure password wrapping。 |
| `packages/core/src/secret/index.ts:438` | `encryptAsync` | Derived private extended key returned to caller, not directly persisted by this helper。Keep compatible with decrypt helpers。 |
| `packages/core/src/secret/index.ts:547` | `encryptAsync` | Derived private extended key returned to caller。 |
| `packages/core/src/secret/index.ts:664` | `encryptAsync` | Generated master private key returned to caller。 |
| `packages/core/src/secret/index.ts:708` | `encryptAsync` | Child private key returned to caller。 |
| `packages/core/src/base/CoreChainApiBase.ts:145` | `encryptAsync` | Exported imported private key map returned to caller。Persistence depends on caller。 |
| `packages/core/src/chains/btc/CoreChainSoftware.ts:538` | `encryptAsync` | Exported BTC private key map returned to caller。Persistence depends on caller。 |
| `packages/core/src/chains/dot/CoreChainSoftware.ts:107` | `encryptAsync` | Exported DOT derived private key returned to caller。Persistence depends on caller。 |
| `packages/core/src/chains/dot/CoreChainSoftware.ts:127` | `encryptAsync` | Exported DOT imported private key returned to caller。Persistence depends on caller。 |
| `packages/core/src/chains/ada/CoreChainSoftware.ts:57` | `encryptAsync` | Exported ADA private key returned to caller。Persistence depends on caller。 |
| `packages/kit-bg/src/webembeds/WebEmbedApiSecret.ts:27` | `encryptAsync` | Native/webembed proxy for the same core secret API。Not a separate data owner。 |
| `packages/kit/src/views/Developer/pages/Gallery/Components/stories/CryptoGallery.tsx` | `encryptAsync` / `encodeSensitiveTextAsync` | Developer test UI only。Update examples after v2 API exists。 |

## Phase 0 Performance Baseline

Baseline 需要覆盖两类成本：

- KDF latency：PBKDF2-SHA256 at legacy/current candidate iterations。
- Cipher latency：AES-CBC legacy writes、AES-GCM candidate writes、AES-GCM decrypt/tag verify，payload sizes 至少覆盖 1KB、100KB、1MB。

推荐每个平台记录：

- Device / OS / runtime：例如 Android model + API level、iPhone model + iOS version、desktop OS、browser/extension runtime。
- Crypto backend：Node crypto、WebCrypto、React Native native module、noble JS fallback、webembed proxy。
- Measurements：avg、p50、p95、round count、payload size、iterations、mode、AAD on/off。
- UX constraint：unlock path、backup/restore、cloud sync batch、Prime Transfer large payload 是否在 UI/main JS thread 上阻塞。

当前本机参考样本，不作为 mobile/web/extension 决策依据：

- Environment：macOS 26.4.1，Node v25.9.0，darwin arm64。CPU model 未记录，`sysctl -n machdep.cpu.brand_string` 在当前 sandbox 下返回 `Operation not permitted`。
- Command shape：Node `crypto.pbkdf2Sync(password, salt, iterations, 32, 'sha256')`；Node `crypto.createCipheriv('aes-256-cbc' | 'aes-256-gcm')`；fixed salt/iv/nonce/AAD；CBC/GCM encryption only。

| Operation | Avg | P50 | P95 | Rounds |
| --- | ---: | ---: | ---: | ---: |
| PBKDF2-SHA256 5,000 | 0.433ms | 0.376ms | 0.407ms | 20 |
| PBKDF2-SHA256 100,000 | 7.342ms | 7.333ms | 7.466ms | 20 |
| PBKDF2-SHA256 300,000 | 22.687ms | 22.683ms | 22.709ms | 5 |
| PBKDF2-SHA256 600,000 | 45.036ms | 45.063ms | 45.381ms | 5 |
| AES-256-CBC encrypt 1KB | 0.009ms | 0.003ms | 0.009ms | 50 |
| AES-256-GCM encrypt 1KB | 0.005ms | 0.004ms | 0.010ms | 50 |
| AES-256-CBC encrypt 100KB | 0.063ms | 0.060ms | 0.073ms | 50 |
| AES-256-GCM encrypt 100KB | 0.028ms | 0.026ms | 0.035ms | 50 |
| AES-256-CBC encrypt 1MB | 0.572ms | 0.541ms | 0.607ms | 50 |
| AES-256-GCM encrypt 1MB | 0.186ms | 0.149ms | 0.289ms | 50 |

待补测平台：

- iOS native：older supported iPhone，React Native JS fallback vs native AES-GCM。
- Android native：low-end supported Android，React Native JS fallback vs native AES-GCM。
- Desktop app：Electron main/renderer path using actual app crypto implementation。
- Web：Chrome/Safari/Firefox where supported，WebCrypto disabled/enabled path if rollout changes `ALLOW_USE_WEB_CRYPTO_SUBTLE`。
- Extension：service worker and popup unlock path，尤其关注 service worker lifetime and main-thread responsiveness。

## 按 Key Source 制定 KDF Iteration 策略

只有当 encryption secret 可能被离线猜测时，PBKDF2 iteration 升级才有价值。共享数据格式不应对每个 encrypted payload 套用同一套 iteration policy。正确策略取决于 encryption secret 的来源。

| Key source | Examples | Offline guessing risk | Recommended strategy |
| --- | --- | --- | --- |
| Human password or passcode | App password、backup password、local passcode、从用户输入派生的 master password material | High | 在 v2 中使用更强 KDF target，将 iterations 存入 envelope，按平台 benchmark，并通过兼容性 gate 控制 shared writes。 |
| Short pairing code | Prime Transfer pairing-code verification | Medium to high | 视为可猜测。优先使用 protocol rate limits 加 v2 metadata。不要假设它是 high entropy。如果仅用于 handshake verification，考虑使用 protocol-specific derivation，而不是全局默认值提升。 |
| ECDHE/session-derived secret | Prime Transfer `connectedEncryptedKey` 包含 ECDHE shared secret 和 room participants | 如果最终 secret 包含足够随机的 ECDHE entropy，则为 Low | 增加 iteration 不是主要安全收益。优先使用 HKDF 或从 shared secret 做 domain-separated key derivation，然后使用带 authenticated metadata 的 AES-GCM。为旧 peers 保留 compatibility gates。 |
| Seed-derived high-entropy key | 从 wallet seed 派生的 Keyless cloud sync encryption key | 如果 seed 强且保持私密，则为 Low | Iterations 可以保持较低，包括 `iterations: 1`，因为暴力破解 key 不现实。重点放在 AES-GCM、AAD binding、nonce uniqueness、key separation 和 format versioning。 |
| Random 128-bit or 256-bit key | 本地生成的 encryption key、per-session random key | Low | 不要仅为了强度而添加昂贵的 PBKDF2。酌情使用 HKDF 或 direct key usage，并配合显式 algorithm metadata 和 AES-GCM authentication。 |
| Fixed public constant | 标记为 fixed-key obfuscation 的 Keyless sync credential storage key | 不受 KDF secrecy 保护 | Iteration count 不提供有意义的 secret protection。将其视为 obfuscation 加 storage-layer protection。除非 key source 改变，否则不要在这里投入 KDF upgrade 的 rollout 复杂度。 |

已知共享路径的实际分类：

- Prime Cloud Sync，OneKey ID mode：使用 `securityPasswordR1` 加 account salt。除非能证明最终 sync password 是 high entropy 且无法用于离线猜测，否则应视为 password-derived shared data。对 v2 writes 加 gate。
- Prime Cloud Sync，Keyless mode：encryption key 从 wallet seed 派生，当前使用 AES-GCM 且 `iterations: 1`。从 KDF 角度看这是可接受的。重点保持在 versioning、AAD、nonce handling 和 restore compatibility。
- Cloud Backup password：用户提供的 backup password path。视为 human password。KDF upgrade 有价值，但新 backup writes 需要 backup-format version gating。
- Prime Transfer pairing verification：pairing code 是用户可见且可能较短的。不要把它归类为 high entropy。在 transfer protocol 协商支持前保持 legacy compatibility。
- ECDHE 之后的 Prime Transfer payload encryption：session secret 包含 ECDHE entropy。KDF iteration upgrade 不是主要需求。优先使用 protocol-specific key derivation，例如 HKDF 和 AES-GCM envelope versioning。
- Prime master password server payload：除非有效 encryption secret 被正式改为 high entropy random material，否则视为 human-password-derived。对 shared writes 加 gate。
- CLI BotWallet export：按导出 payload 的实际 encryption key source 分类。如果它使用 high-entropy random key，避免不必要的 PBKDF2 成本；如果它使用用户输入的 password 或 code，则使用 v2 KDF metadata。

决策规则：

- 如果 secret 是 human-entered 或 short，则升级 KDF 参数，并将其存入 v2 envelope。
- 如果 secret 是 high-entropy random、ECDHE-derived 或 seed-derived，不要为了安全强制做昂贵的 PBKDF2 iteration upgrade。优先使用 HKDF 或显式 key separation、AES-GCM、AAD、nonce discipline 和 versioning。
- 如果 secret 是 fixed public constant，不要把 PBKDF2 iterations 描述为 security hardening。应改进 key source，或依赖平台 storage protection。

## 兼容性规则

- 新客户端必须能读取 legacy CBC、legacy GCM 和 v2。
- 旧客户端无法读取 v2，除非它们已更新。对共享数据来说，这应视为 compatibility break。
- 对 local-only 数据，成功 decrypt 后写入 v2 是可接受的。
- 对 high-entropy random、ECDHE-derived 或 seed-derived keys，兼容性工作应优先关注 format versioning 和 AES-GCM support，而不是 iteration-count changes。
- 对 human passwords、passcodes、backup passwords 和 short pairing codes，KDF upgrades 仍在范围内。
- 对共享数据，写入 v2 至少需要以下之一：
  - server-side feature flag，
  - minimum client version requirement，
  - peer capability negotiation，
  - backup format version selection，
  - explicit user or rollout gate。
- 避免同时以 legacy 和 v2 双写 plaintext-equivalent secrets，除非有强产品需求。双字段会增加复杂度和 secret exposure。
- 不要在没有兼容性检查的情况下，通过后台 lazy rewrite 升级 `CloudSyncItem`、Cloud Backup、Prime Transfer 或 server master-password payloads。

## Mobile Native AES-GCM

如果 v2 默认使用 AES-GCM，移动端最终应支持原生 AES-GCM。但 rollout 顺序调整为：先跑通 non-native v2 envelope、metadata helper、本地 lazy upgrade 和 shared gates；native AES-GCM 作为后置性能优化和移动端默认切换前置条件。

实现方向：

- 为 `packages/shared/src/appCrypto/modules/aesGcm.ts` 添加 native branch。
- 保留现有 noble implementation 作为 web、desktop、extension、Jest，以及 rollout 期间可能的 native fallback。
- iOS 应使用项目最低 iOS 版本支持的 system AES-GCM implementation。
- Android 应使用 `Cipher.getInstance("AES/GCM/NoPadding")`。
- TypeScript API 应保持 platform-neutral：`{ key, nonce, data, aad }`。
- Native output 必须匹配当前 noble convention：`ciphertext || tag`。
- Decrypt input 也必须接受 `ciphertext || tag`。
- 添加 native test vectors，对比 iOS、Android、noble 和 non-native implementations。

Native support 很重要，因为更高的 PBKDF2 count 加 GCM 不应压垮低端移动设备上的 JS thread。低层 API 已默认写 v2，但移动端共享场景和大范围业务 rollout 仍不得跳过 shared compatibility gates 与 native benchmark；native GCM 完成前可以先让 web、desktop、extension、Jest 和受控 non-native flows 验证 envelope/read/write/migration 行为。

## 执行 TODO

- [x] 第一个任务：Phase 0 golden vectors。已选择先做 legacy CBC、legacy GCM 和 custom-iteration behavior 的固定向量测试，用固定 salt、iv/nonce、password、plaintext 锁定现有 payload 格式和 KDF 参数兼容性。
- [x] Phase 0 inventory。识别每一个持久化调用方：`encryptStringAsync`、`encryptAsync`、`encodeSensitiveTextAsync` 和 `encryptByInstanceId`，并按 local-only、shared/server-visible、migration/non-persistent 分类。
- [ ] Phase 0 performance baseline。记录 iOS、Android、desktop、web 和 extension 上当前 PBKDF2 与 AES operations 的性能。
- [x] Phase 1 v2 primitives。添加 v2 envelope parser/serializer、AES-GCM encrypt/decrypt support 和 metadata decrypt helper。低层 primitive 现在默认写 v2；需要旧客户端读取的共享入口必须走 shared encrypt policy。
- [x] Phase 1.5 non-native v2 write policy。底层默认写 v2 + current iterations；已知 shared/server-visible 入口已统一到 shared encrypt policy，默认 legacy，后续 gate 开启后再按 `sharedScene` 精确切 v2。Cloud Backup V1 导出会将本地 credentials 降级为 legacy，避免备份恢复旧客户端无法识别。
- [x] Phase 2 local lazy upgrade。从 `Context.verifyString` 和 `Credential` 开始实现无阻塞、幂等、transaction-safe 的本地升级；解锁成功后异步触发，使用 metadata helper 判断 legacy payload，并在重写时比较原 ciphertext，避免覆盖并发变更。每次只处理一个小批次 credential，剩余项目后续解锁继续，避免大量钱包时连续 PBKDF2/AES-GCM 压住 JS thread。分批期间用 `Context.localPasswordKdfUpgradeLastScannedCredentialId` 记录逻辑进度；它不是 IndexedDB cursor，而是基于稳定 `credential.id` 排序的跨 IndexedDB/Realm checkpoint。每条 credential 是否已升级仍由 v2 magic 精确判断。全部完成后写入 `Context.localPasswordKdfUpgraded` 持久化标记，后续解锁直接跳过空检。失败只记录聚合错误，不阻断正常解锁。
- [ ] Phase 3 shared-data gates。为 Cloud Backup、Prime Transfer、Prime Cloud Sync 和 master-password server payloads 添加兼容性 gate。
- [ ] Phase 4 gated v2 rollout。在 shared compatibility gates 准备好之后，按 Cloud Backup、Prime Transfer、Prime Cloud Sync 和 master-password server payload 的 gate 逐步启用 v2 writes；移动端全量默认 v2 仍需等待 native AES-GCM benchmark。
- [ ] Phase 5 native AES-GCM。为移动端添加 native AES-GCM support，并保留 noble fallback；移动端全量默认 v2 需等待 native benchmark 和真机验证。

### Phase 2 Implementation Notes

已实现范围：

- `packages/core/src/secret/index.ts`
  - 新增 owner-specific metadata helpers：
    - `decryptVerifyStringWithMetadata`
    - `decryptRevealableSeedWithMetadata`
    - `decryptImportedCredentialWithMetadata`
  - 普通业务读仍使用原来的 `decryptVerifyString`、`decryptRevealableSeed`、`decryptImportedCredential`。
- `packages/kit-bg/src/dbs/local/LocalDbBase.ts`
  - `verifyPassword` 成功后通过 `void this.lazyUpgradeLocalPasswordEncryptedRecords({ password })` 异步触发。
  - `Context.verifyString` 优先升级。
  - `Credential` 每次最多处理 `LOCAL_PASSWORD_KDF_LAZY_UPGRADE_CREDENTIAL_BATCH_SIZE = 3` 条候选记录。
  - 候选范围仅包括 `hd*`、`imported*` 和 Ton mnemonic credential；HyperLiquid `|HLP|` plaintext credential 和其它 credential 跳过。
  - 每条 credential 是否已升级由 payload v2 magic `1K_ENC_V2` 判断，不依赖钱包级状态。
  - 写回时比较原 ciphertext，避免覆盖并发变更。
  - 失败只记录错误，不阻塞解锁、读取、签名或交易。
- `packages/kit-bg/src/dbs/local/types.ts`
  - `IDBContext.localPasswordKdfUpgraded?: boolean`
  - `IDBContext.localPasswordKdfUpgradeLastScannedCredentialId?: string`
- `packages/kit-bg/src/dbs/local/realm/schemas/RealmSchemaContext.ts`
  - Realm schema 同步新增以上两个字段，默认分别为 `false` 和 `''`。

分批进度语义：

- `localPasswordKdfUpgradeLastScannedCredentialId` 不是 IndexedDB cursor。
- 它是跨 IndexedDB 和 Realm 通用的逻辑 checkpoint。
- 每次先取 `getAllCredentials()`，再在 JS 内按 `credential.id.localeCompare(...)` 做确定性排序，所以不依赖底层 DB 返回顺序。
- 下次从 `credential.id > localPasswordKdfUpgradeLastScannedCredentialId` 的位置继续。
- 所有候选处理完成后清空 `localPasswordKdfUpgradeLastScannedCredentialId`，并设置 `localPasswordKdfUpgraded = true`。
- `localPasswordKdfUpgraded = true` 后，后续解锁只读 `Context` 标记并直接跳过 credential 检测。

已覆盖测试：

- legacy `verifyString`、HD credential、imported credential 升级到 v2。
- `|HLP|` 跳过。
- 并发变更时不覆盖新 ciphertext。
- 单次 lazy upgrade 只处理一个小批次。
- 分批期间从 `localPasswordKdfUpgradeLastScannedCredentialId` 后继续。
- `localPasswordKdfUpgraded` 已设置时不调用 `getAllCredentials()`。

已运行验证：

- `yarn jest packages/core/src/secret/encryptors/__tests__/aes256.test.ts packages/kit-bg/src/dbs/local/LocalDbBase.test.ts`
- `yarn tsc:staged`
- `npx oxlint --tsconfig ./tsconfig.json --type-aware --fix --deny-warnings packages/core/src/secret/index.ts packages/kit-bg/src/dbs/local/LocalDbBase.ts packages/kit-bg/src/dbs/local/LocalDbBase.test.ts packages/kit-bg/src/dbs/local/types.ts packages/kit-bg/src/dbs/local/realm/schemas/RealmSchemaContext.ts`
- `git diff --check`

后续注意：

- 如果未来新增本地 password-encrypted credential 类型，必须更新 `isLocalPasswordKdfCredentialUpgradeCandidate` 和对应 decrypt/encrypt helper。
- 如果 credential id 的格式规则变更，需确认 `localeCompare` 排序仍能稳定覆盖所有候选。
- Phase 2 local lazy upgrade 的 batch size 固定为 `3`。该值已被产品/工程决策接受，不再要求低端 Android 额外 benchmark 作为阻塞项；后续只在出现真实用户体验问题时再调整。

### Golden vectors 测试基线意图

当前新增的 golden vectors 只锁定 legacy payload 的可读性和当前 legacy writer 的基线行为，不表示默认写入路径要永久停留在 legacy。

默认写入切到 v2 后，测试应保持以下约束：

- Legacy read tests 保留：直接用固定 legacy hex 调用 decrypt helper，确保老数据仍可读。
- Default write tests 改为 v2：默认 encrypt path 应断言输出 `1K_ENC_V2` envelope。
- Legacy write tests 仅在保留显式 legacy writer、兼容性 gate 或 protocol fallback 时存在，并且必须通过显式参数或专用 helper 触发。
- Shared data tests 必须验证 gate 未开启时仍写旧客户端可读格式，gate 开启或 peer/server 标记兼容后才写 v2。

## Rollout Plan

Phase 0: inventory and baselines

- 为 legacy CBC、legacy GCM 和当前 custom-iteration behavior 添加 golden vectors。
- 识别每一个持久化调用方：`encryptStringAsync`、`encryptAsync`、`encodeSensitiveTextAsync` 和 `encryptByInstanceId`。
- 记录 iOS、Android、desktop、web 和 extension 上当前 PBKDF2 与 AES operations 的性能。

Phase 1: v2 read/write primitives

- 添加 v2 envelope parser 和 serializer。
- 添加 v2 AES-GCM encrypt/decrypt support。
- 保持旧 public APIs 向后兼容。
- 添加返回 metadata 的 decrypt helper，用于迁移决策。

Phase 1.5: non-native write policy

- 添加场景化 write helper 或 policy 层，避免业务直接依赖 `format: 'v2'` 参数。
- Local-only human-password/passcode writes 默认 v2，并记录 current iterations。
- Shared/server-visible writes 统一通过 shared encrypt policy；未指定格式时默认 legacy，必须通过 compatibility gate 才能写 v2。
- Legacy writes 只允许通过显式 legacy policy、测试 helper 或 protocol fallback。
- 先覆盖 web、desktop、extension、Jest 和 native noble fallback 的 non-native path。

Phase 2: local lazy upgrade

- 从 `Context.verifyString` 和 `Credential` 开始。
- 仅在密码验证成功或 credential decrypt 成功之后升级。
- 使用 transaction-safe rewrites。
- 让升级过程 idempotent。
- 如果重写失败但 decrypt 成功，不要阻塞正常解锁。记录失败并稍后重试。

Phase 3: shared-data gates

- 为 Cloud Backup 和 Prime Transfer protocol payloads 添加显式 format version fields。
- 为 Prime Transfer 添加 capability 或 minimum-version gates。
- 为 Prime Cloud Sync 和 master-password server payloads 添加 server 或 feature-flag gating。
- 在 gate 启用前，shared writes 保持 legacy。

Phase 4: gated v2 rollout

- 通过 rollout gates 逐步启用 shared v2 writes。
- Cloud Backup、Prime Transfer、Prime Cloud Sync 和 master-password server payload 必须分别有 gate。
- 至少在一个较长 compatibility window 内保留 legacy read support。

Phase 5: native AES-GCM

- 为移动端添加 native AES-GCM support。
- 对比 native、noble fallback 和低端设备性能。
- native benchmark 通过后，移动端再进入全量 v2 写入 rollout。

## 测试要求

Crypto unit tests：

- Legacy CBC with default iterations still decrypts。
- Legacy GCM with default iterations still decrypts。
- v2 decrypts using header iterations without caller-provided iterations。
- Plain `decryptAsync` reads legacy CBC、legacy GCM and v2 without requiring callers to know the payload format。
- Metadata helpers are only used by local migration owners to decide `needsUpgrade`; shared/server-visible flows must not auto-rewrite based on metadata。
- Wrong password fails。
- Wrong AAD fails。
- Tampered ciphertext fails。
- Tampered v2 header fails because header is authenticated。
- Passing the wrong `mode` for a legacy payload fails predictably。

Migration tests：

- `Context.verifyString` legacy to v2。
- HD credential legacy to v2。
- Imported credential legacy to v2。
- Ton mnemonic credential legacy to v2。
- HyperLiquid `|HLP|` is skipped。
- Failed rewrite does not destroy the readable legacy record。

Compatibility tests：

- New client reads old local DB。
- New client reads old Cloud Backup payload。
- New client reads old Prime Cloud Sync item。
- New client receives old Prime Transfer payload。
- High-entropy shared-key paths keep decrypting when their iteration count remains intentionally low。
- Human-password shared paths read legacy data and write v2 only when their compatibility gate is enabled。
- Old client behavior is protected by gates. It should not receive v2 shared payloads unless marked compatible。

Performance tests：

- PBKDF2 target iterations on low-end Android。
- PBKDF2 target iterations on older supported iPhone。
- Extension unlock and service worker constraints。
- Web and desktop main-thread responsiveness。
- Prime Transfer and Cloud Backup encryption time for large payloads。

## 实现边界

- `packages/core` 应负责 format parsing、crypto primitives，以及无副作用的 decrypt metadata。
- `packages/shared/src/appCrypto` 应负责 platform crypto implementations 和 platform dispatch。
- `packages/kit-bg` 应负责 local DB lazy upgrade、cloud sync gating、backup protocol handling 和 transfer protocol handling。
- UI packages 不应直接解析 crypto payloads。
- Platform checks 应使用 `platformEnv` 或 platform-specific files。

## 未决问题

- Benchmark 后每个平台的最终 PBKDF2 target iterations。
- v2 应为 binary-only，还是 JSON-header 加 binary payload。
- 是否所有 v2 payloads 都应要求 AAD 中包含 `purpose` 或 `dataType`。
- Shared v2 writes 的 minimum client versions。
- AES-GCM native support 应加入现有 `react-native-aes-crypto` dependency path，还是使用 OneKey-owned native module wrapper。
- Cloud Backup 和 Prime Transfer 的 legacy write support 应保留多久。
- Prime Transfer 是否应将 ECDHE material 上的 password-style PBKDF2 替换为 HKDF-based session key derivation。
- 哪些当前 shared paths 可以在 code review 和 threat modeling 后被正式归类为 high-entropy-key encryption。

## 决策摘要

- 新 encryption format 应 versioned。
- 新默认值应使用 AES-GCM，而不是 unauthenticated AES-CBC。
- Iteration count 必须存入新的 payload metadata。
- 对 human-password 或 short-code secrets，必须升级 iteration；但对 high-entropy random、ECDHE-derived 或 seed-derived keys，不应自动要求升级。
- Legacy reads 必须继续支持。
- 本地数据可以使用 lazy upgrade。
- 共享数据需要显式 compatibility gates。
- 在 v2 成为主要写入路径前，移动端应支持 native AES-GCM。
