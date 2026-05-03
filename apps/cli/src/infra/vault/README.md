# Bot Wallet CLI Vault ADR

## Status

Accepted for Story 1.2 skeleton.

## Context

1. CLI 是 single-shot Node 进程。
2. 高频 `onekey sign` 可能由 bot 并发启动多个进程。
3. BotWallet PoC 需要跨 CLI 调用复用远程密钥取回结果。
4. 复用必须受 1h sliding TTL 与 24h absolute cap 约束。
5. 本地持久化不得暴露助记词、seed、明文 token 或 keyBase64。
6. 旧 `wallet:default/*` keychain path 与新路径必须隔离。
7. 新路径只允许使用 `bot-wallet/master-key` 这一条 master key entry。
8. vault 文件必须是唯一持久化文件：`vault.enc`。
9. vault 文件必须整体加密，不能拆成多个明文状态文件。
10. 并发读改写必须用文件锁保护，避免 lost-update。

## Decision

1. 建立 `apps/cli/src/infra/vault/` 作为 CLI vault 边界。
2. vault 模块只提供小而稳定的 public API。
3. 命令层不直接读写 `vault.enc`。
4. signer 层不直接访问 keychain。
5. key service HTTP 访问收敛在 service client。
6. 加密、codec、lock、cache decision 分文件维护。
7. 所有文件名使用 kebab-case 或既有 lower-case TypeScript 文件名。
8. 常量集中在 `constants.ts`。
9. 路径集中在 `paths.ts`。
10. 类型集中在 `types.ts`。

## One-Way Dependency Graph

单向依赖规则：上层命令可以调用 signer 和 vault，vault 不反向调用命令、输出层或 UI。

```text
commands/auth/login
commands/auth/logout
commands/auth/status
commands/sign
commands/get-address
        |
        v
signer/base/SignerBase
        |
        v
infra/vault/client
        |
        +--> infra/vault/codec
        +--> infra/vault/crypto
        +--> infra/vault/invariants
        +--> infra/vault/lock
        +--> infra/vault/cache
        +--> infra/vault/service-client
        |
        v
core / shared primitive utilities
```

## Public Contract

### VaultClient.atomicMutate

1. Acquires the vault lock.
2. Reads master key through the existing keychain abstraction.
3. Derives the vault key through HKDF.
4. Deserializes and validates vault plaintext.
5. Runs one caller-provided mutation.
6. Serializes with AES-GCM and atomically writes back.
7. Always releases lock and wipes sensitive buffers.

### VaultClient.readOnly

1. Acquires the vault lock for a consistent snapshot.
2. Reads and decrypts the vault.
3. Validates runtime invariants.
4. Lets the caller inspect metadata or cache.
5. Never writes vault state.

### VaultClient.destroy

1. Deletes `bot-wallet/master-key`.
2. Deletes `vault.enc`.
3. Deletes stale lock material when present.
4. Clears process-local secure cache through the caller path.
5. Does not read or migrate legacy credentials.

## File Granularity

1. `index.ts` is the public barrel.
2. `client.ts` owns vault read/write orchestration.
3. `crypto.ts` owns HKDF and AES-GCM primitives.
4. `codec.ts` owns binary layout, AAD, and JSON parsing.
5. `invariants.ts` owns runtime corruption checks.
6. `lock.ts` owns proper-lockfile integration.
7. `service-client.ts` owns key service calls.
8. `cache.ts` owns TTL decision logic.
9. `constants.ts` owns fixed TTL, version, and magic values.
10. `paths.ts` owns filesystem and keychain account paths.
11. `types.ts` owns vault data shapes.

## Cross-Boundary Forbidden Matrix

| From | Forbidden dependency | Reason |
|---|---|---|
| `commands/*` | direct `fs.readFile(VAULT_FILE)` | Commands must use `VaultClient` so lock and invariant checks are never skipped. |
| `commands/*` | direct `wallet:default/*` reads | New BotWallet path must not silently migrate legacy credentials. |
| `signer/*` | direct keychain access | Signer must not know master-key storage details. |
| `infra/vault/*` | React, UI, or command output | Vault must remain headless and testable. |
| `infra/vault/*` | direct OneKey component imports | CLI infra cannot depend on UI packages. |
| `service-client.ts` | vault file writes | Remote key fetch and local persistence must stay separate. |

## Naming Notes

1. File names stay lower-case and kebab-case where a separator is needed.
2. Type names use PascalCase and avoid an `I` prefix.
3. Error codes use SCREAMING_SNAKE_CASE without an `ERR_` prefix.
4. The keychain account is exactly `bot-wallet/master-key`.
5. HKDF info strings follow `bot-wallet/<purpose>/<version>`.
6. CLI subcommands use kebab-case.
7. Cache keys use the canonical `walletId:keyId` string.

## Security Notes

1. The master key is only a key-encryption root, not an AES-GCM key.
2. `deriveVaultKey` must use HKDF-SHA-256 with zero salt and purpose-bound info.
3. AES-GCM nonce must be random and unique for every write.
4. AAD must bind magic, version, and schema version.
5. `VaultPlaintext.records` is schema-ready for many records.
6. Runtime invariants for PoC still require records size to be at most one.
7. Cache entries must only contain the bounded sliding TTL fields.
8. `logout` deletes new path first, then best-effort legacy entries.
9. Automatic migration from legacy path is forbidden in this PoC.
10. Any corruption must fail secure and require explicit re-login.
