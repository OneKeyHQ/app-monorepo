# Pro 2 Passphrase 与钱包会话

## 1. 范围

本文记录 App 对 OneKey Pro 2 Protocol V2 钱包会话的调用约束。它覆盖标准钱包、Host 输入隐藏钱包、设备输入隐藏钱包、Attach PIN、会话恢复，以及后续地址派生和签名调用。

Protocol V1 和第三方硬件继续使用原有 passphrase 流程，不得根据设备名称、PID 或型号推断 Protocol V2。App 只能使用 SDK 已协商并返回的 `protocol`。

## 2. 钱包选择入口

App 的 `ServiceHardware.getPassphraseStateBase()` 按协议分流：

- Protocol V2 调用 `openWalletSession()`；
- 标准钱包使用 `{ mode: 'standard' }`；
- 隐藏钱包选择使用 `{ mode: 'select-hidden' }`；
- Protocol V1 保留 `getPassphraseState()`；
- 已确认是 Protocol V2，但运行时 SDK 没有 `openWalletSession()` 时必须抛错，禁止退回 Protocol V1 或把结果当作标准钱包。

Protocol V2 的一次选择只能返回以下三种结果之一：

- `{ passphrase }`：Host 输入；
- `{ passphraseOnDevice: true }`：设备输入；
- `{ attachPinOnDevice: true }`：Attach PIN。

App 不得在同一响应中同时设置两个选择字段，也不得用空 Host passphrase 表示标准钱包。标准钱包只能通过显式的 `mode: 'standard'` 打开。

## 3. Host 输入边界

Protocol V2 Host passphrase 在提交前执行 NFKD 规范化，并满足：

- 非空；
- 不包含 NUL；
- 不包含孤立 UTF-16 surrogate；
- NFKD 后最多 50 UTF-8 字节；
- Unicode 合法，字节长度不能用 JavaScript `string.length` 代替。

Protocol V1 和第三方硬件仍保留各自的 ASCII 兼容规则。共享表单只有在 UI 事件来源为 `wallet-session-coordinator` 时启用 Protocol V2 UTF-8 规则。

## 4. 会话恢复

地址派生或签名方法携带钱包保存的 `passphraseState`。SDK 检测到当前设备会话与预期钱包不一致时，恢复流程必须：

1. 明确标记 `reason: 'session-recovery'`；
2. 将 `expectedPassphraseState` 传给 App；
3. 禁止空 Host 提交；
4. 恢复后比较设备返回的钱包标识；
5. 标识不一致、取消、超时或断连时失败，不执行原业务命令；
6. 只有恢复成功后才允许继续地址派生或签名。

App 不保存明文 passphrase。钱包数据库只保存 `passphraseState`，业务调用通过 `deviceCommonParams` 传递：

```ts
{
  passphraseState: wallet.passphraseState,
  useEmptyPassphrase: !wallet.passphraseState,
  connectProtocol
}
```

SDK 对标准钱包和隐藏钱包都会返回设备生成的 `passphraseState`。App 不得再用
`passphraseState` 是否为空推断钱包类型：`openWalletSession()` 的 `walletType` 是唯一分类依据。
为保持现有数据库语义，标准钱包的设备状态只用于当前 SDK 会话，不写入隐藏钱包字段；只有
`walletType: 'hidden'` 的非空 `passphraseState` 才保存到钱包记录。

## 5. 链调用约束

所有 OneKey Hardware Keyring 的地址派生、交易签名、消息签名和 Typed Data 签名，都必须把 `deviceCommonParams` 传入 Hardware SDK。批量建账户的 `allNetworkGetAddress()` 也遵守相同约束。

隐藏钱包状态不得在链实现中被删除、改为空字符串或静默替换为 `useEmptyPassphrase: true`。设备重置、物理身份变化或钱包被标记为废弃后，App 必须停止使用旧钱包会话。

## 6. 日志与错误处理

- 禁止记录 passphrase、`passphraseState`、`expectedPassphraseState` 或完整 Hardware UI payload；
- Hardware UI 日志只能记录事件类型、设备类型、来源、原因和选择能力等白名单字段；
- 取消、超时、断连、会话失效、恢复钱包不匹配均向上返回错误；
- 不得自动重放可能产生副作用的签名命令；
- 不得把 SDK API 不可用、协议未知或设备状态读取失败解释为标准钱包。

## 7. 验收矩阵

发布前至少验证：

- 标准钱包；
- Host 输入：ASCII、Unicode、NFKD 等价输入、50 字节边界、51 字节拒绝、NUL 拒绝；
- 设备输入；
- Attach PIN 存在与不存在；
- 创建隐藏钱包与恢复已有隐藏钱包；
- 错误 passphrase 导致钱包标识不匹配；
- 用户取消、输入超时、原子会话请求失败；
- USB/BLE 断连与重连；
- 同设备并发请求和不同设备隔离；
- 恢复失败后业务命令没有重放；
- Protocol V1 行为保持不变；
- SDK 缺少 Protocol V2 API 时失败关闭；
- 日志中不存在 passphrase 或钱包会话标识。
