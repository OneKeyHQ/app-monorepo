# OneKey CLI BotWallet PoC Conventions

## 命名约定

1. 文件名使用 kebab-case 或既有 lower-case 模式。
   - 示例：`service-client.ts`
   - 示例：`cli-bot-wallet-payload.ts`

2. TypeScript 类型使用 PascalCase，且不使用 `I` 前缀。
   - 示例：`VaultPlaintext`
   - 示例：`VaultCacheEntry`

3. 常量使用 SCREAMING_SNAKE_CASE。
   - 示例：`SLIDING_TTL_MS`
   - 示例：`MASTER_KEY_ACCOUNT`

4. CLI 子命令使用 kebab-case。
   - 示例：`get-address`
   - 示例：`auth login`

5. 错误码使用 SCREAMING_SNAKE_CASE，不加 `ERR_` 前缀。
   - 示例：`VAULT_CORRUPT`
   - 示例：`LOCK_TIMEOUT`

6. Keychain account 固定使用 `bot-wallet/master-key`。
   - 示例：`keychainStorage.get('bot-wallet/master-key')`
   - 示例：`keychainStorage.delete('bot-wallet/master-key')`

7. HKDF info 使用 `bot-wallet/<purpose>/<version>` 格式。
   - 示例：`bot-wallet/vault/v1`
   - 示例：`bot-wallet/audit-log/v1`

## ASCII 单向依赖图

```text
commands
  |
  v
signer
  |
  v
infra/vault
  |
  v
core
```

依赖只能沿图中方向向下流动。`core` 不知道 vault，`infra/vault` 不知道 commands，commands 不直接跨过 vault 操作本地持久化文件。

## 跨边界禁止矩阵

| From | Forbidden | Reason |
|---|---|---|
| `commands/*` | 直接 `fs.readFile(VAULT_FILE)` 或 `fs.writeFile(VAULT_FILE)` | 必须经过 `VaultClient`，否则会跳过锁、AAD、codec 和 invariant。 |
| `commands/*` | 读取 `wallet:default/*` legacy keychain entry | PoC 禁止静默 migration，旧路径只能在 logout cleanup 中 best-effort 删除。 |
| `signer/*` | 直接调用 keychain storage | signer 只能通过 vault API 获取 active credential，不拥有 master-key 生命周期。 |
| `infra/vault/*` | 导入 React、OneKey components、command output 或 UI 包 | vault 层必须保持 headless，便于单元测试和跨平台 CLI 打包。 |

## 适用范围

本文件只约束 `apps/cli` 内 BotWallet PoC 接收链路相关代码。
旧 CLI 登录与普通钱包路径可以继续遵守原有约定，但不得反向污染 `infra/vault`。
