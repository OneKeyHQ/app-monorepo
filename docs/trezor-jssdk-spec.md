# Trezor JSSDK 接入 SPEC

## 1. 目标和边界

这份文档描述当前 JSSDK 分支 `/Users/smallraw/Development/OnekeyWork/js-sdk-trezor-experiment` 里的 Trezor 实现。

本次 SDK 侧目标是让 HWK 能兼容 Trezor，而不是替换 OneKey 原有 HD Wallet：

- HD Wallet 仍然是 OneKey 自有设备专用路径。
- HWK 是第三方硬件抽象层，当前覆盖 Trezor、Ledger，未来可以接其他外部设备。
- Trezor 行为和 OneKey 接近时，应抽象成通用能力或 wallet-state 流程。
- Ledger 的特殊点继续留在 Ledger adapter，例如按链 App、App 安装、按链 fingerprint。
- 只有协议、固件能力或传输机制确实唯一时，才用 Trezor / Ledger 专门判断。

## 2. 包结构

JSSDK Trezor 相关包：

- `packages/hwk-adapter-core`：HWK 公共类型、错误码、事件、响应结构。
- `packages/hwk-trezor-adapter`：面向 App/调用方的 Trezor `IHardwareWallet` 实现。
- `packages/hwk-trezor-connector`：设备发现、连接、method dispatch、UI request、THP credentials 管理。
- `packages/hwk-trezor-core`：Trezor v1/THP 协议、session、passphrase、PIN、pairing 状态机。
- `packages/hwk-trezor-connector-webusb`：WebUSB connector。
- `packages/hwk-trezor-connector-electron-ble`：Desktop BLE connector。
- `packages/hwk-trezor-connector-rn-ble`：RN BLE connector。
- `packages/hwk-trezor-protocol` / `packages/hwk-trezor-transport` / `packages/hwk-trezor-protobuf`：底层协议、传输、protobuf 定义。

分层边界：

- adapter 负责 HWK API、队列、passphraseState 缓存、错误转 `Response`。
- connector 负责把 method 分发到设备或 chain handler，并把错误序列化成跨进程安全数据。
- core 负责实际协议交互，不理解 App 的 wallet 记录和业务身份。
- chain handler 只做参数解析和 protobuf message 映射。

## 3. 公共参数和命名标准

公共调用参数定义在 `packages/hwk-adapter-core/src/types/wallet.ts`：

- `autoInstallApp`：Ledger 类能力保留；Trezor 调用会剥离，不进 protobuf。
- `passphraseState`：Trezor wallet-state 引用。
- `useEmptyPassphrase`：调用方显式声明本次使用 standard wallet / 空 passphrase。

当前 `passphraseState` 的真实含义：

- 它不是 Trezor 旧 protobuf 里的 deprecated passphrase state。
- 它也不是 4 字节 XFP。
- 当前实现用 `btcGetPublicKey` 派生 `m/44'/0'/0'` 的 compressed public key。
- 这么做是为了避免 4 字节 fingerprint 碰撞，同时不走 OneKey 旧的 Testnet GetAddress 方案。

大数和 HEX 命名约定：

- 跨进程传输时，超出安全整数范围的金额优先用 decimal string。
- 真正要发给设备时，再按 Trezor protobuf 要求转成 hex bytes、decimal string 或 number。
- 字段若语义是 HEX，后续新字段建议显式带 `Hex` 后缀。
- 字段若语义是 JS number，后续新字段建议显式带 `Number` 或更具体单位后缀。

当前已落地的例子：

- TRON `amount` 走 decimal string，避免 `number` 超过 `2^53` 后精度丢失。
- TRON `feeLimit`、`expiration`、`timestamp` 等 protobuf number 字段会拒绝 unsafe integer。
- BTC / EVM `PaymentRequest.amount` 使用 decimal string，再编码成设备需要的小端 bytes hex。

## 4. Adapter 行为

文件：`packages/hwk-trezor-adapter/src/adapter/TrezorAdapter.ts`

adapter 的职责：

- 实现 HWK `IHardwareWallet`。
- 每台设备一个 `DeviceJobQueue`，同设备请求串行。
- 维护 `connectId -> sessionId`。
- 维护 `(connectId, passphraseState) -> thpSessionId`。
- 在 chain call 前剥离公共参数，避免 `passphraseState` / `useEmptyPassphrase` 进入 protobuf。
- 在 `REQUEST_PASSPHRASE` UI request 上补充 `passphraseState` / `useEmptyPassphrase` 上下文。
- 把 connector error 转成标准 `Response.failure`。

队列规则：

- 所有普通 chain call 都用 `rejectIfBusy: true`。
- `getPassphraseState` 也进入同设备队列，避免和 chain call 交错导致 THP nonce 或 app session 错乱。
- `cancel(connectId)` 会取消 adapter UI waits、connector UI waits，并 force cancel 当前队列任务。

重试规则：

- `DeviceDisconnected` 会清理 session 和 app session，最多重连重试一次。
- stale THP app session 会删除对应 `(connectId, passphraseState)` 缓存，最多重建重试一次。
- stale 判断读取 `error.code`，也读取 Trezor Failure 里的 `response.message.code`，因为跨 connector 序列化后字符串 code 可能不在顶层。

## 5. Connector 行为

文件：`packages/hwk-trezor-connector/src/index.ts`

connector 的职责：

- 发现设备。
- 创建 byte transport。
- 创建 `TrezorDeviceSession`。
- 管理 THP known credentials。
- 把 SDK method dispatch 到 device method 或 chain handler。
- 把 UI request 转给 host。

设备连接流程：

1. `resolveDevice(deviceId)` 找到 scan 到的设备，或用 transport 支持的 unlisted connectId。
2. `createByteTransport(device)` 建立底层传输。
3. `new TrezorDeviceSession({ transport, thp })`。
4. `deviceSession.initialize()` 做 v1/THP 协议探测。
5. 保存 session，发出 `device-connect` 和 `DEVICE.FEATURES`。

known credentials：

- connector 持有一个内部数组。
- `setKnownCredentials()` 是替换数组内容，不替换数组引用。
- pairing 产生新 credentials 后先 merge 到内存，再发 `DEVICE.TREZOR_THP_CREDENTIALS_CHANGED` 给 host 持久化。
- credential 按设备返回的 `credential` blob 去重。

method scope 当前只有两类：

- `device`：设备管理能力，不进入 wallet state。
- `walletState`：地址、签名、链上钱包态能力，需要 `withDeviceState`。

当前 dispatch：

- `getFeatures`、`deviceSettings`、`setBrightness`、`changePin`、`wipeDevice` 是 device scope。
- `btc*`、`evm*`、`sol*`、`tron*` 链方法是 walletState scope。
- 不支持但属于钱包态的 `btcSignPsbt`、`solSignMessage`、`tronSignMessage` 也显式包进 walletState，再抛 `MethodNotSupported`。

## 6. Core 协议状态机

文件：`packages/hwk-trezor-core/src/index.ts`

协议初始化：

1. 先用 v1 发送 `Cancel` 清理旧消息。
2. 如果设备返回 `Failure_InvalidProtocol`，切到 THP。
3. 否则继续 v1 `Initialize`。
4. THP 下创建 channel、handshake、pairing，然后 `GetFeatures`。

THP pairing：

1. `ThpCreateChannelRequest` 建 channel。
2. `ThpHandshakeInitRequest` 做握手初始化。
3. 如果 known credentials 可用，走 autoconnect。
4. 否则进入 pairing phase。
5. 当前优先 CodeEntry；host 通过 `REQUEST_TREZOR_THP_PAIRING` 收用户输入。
6. 成功后 `ThpCredentialRequest` 获取 credentials。
7. `ThpEndRequest` 结束 pairing。

PIN：

- v1 PIN 由设备在业务调用中发 `PinMatrixRequest`。
- THP locked 设备在 handshake 阶段可能只阻塞，不主动发 UI request。
- core 遇到 `ThpDeviceLocked` 时，合成一次 `ButtonRequest_PinEntry` 给 host，并用 `tryToUnlock=1` 重试。
- 重试后仍 locked，则抛 `Device_InitializeFailed`。

## 7. Passphrase 详细流程

THP 和 V1 的差异：

- THP：passphrase 在 `ThpCreateNewSession` 之前由 host 主动提供。
- V1：设备在业务调用过程中主动发 `PassphraseRequest`，host 再回复 `PassphraseAck`。
- 两者都汇聚到同一个 `REQUEST_PASSPHRASE` UI request。
- 两者都支持 host 输入和设备输入。

THP app session：

- `createThpAppSession()` 先生成新的 THP session id。
- 如果 `features.passphrase_protection === true`，调用 `onPassphraseRequest()`。
- 如果 passphrase 选择设备输入，发送 `{ on_device: true }`。
- 否则发送 `{ passphrase: value ?? '' }`。
- 然后调用 `ThpCreateNewSession`。
- 如果设备返回 `ButtonRequest`，core 会用通用 call loop 发送 `ButtonAck`。

standard wallet：

- 对普通 device scope 方法，例如 `getFeatures`、`deviceSettings`，不会进入 `withDeviceState`，也不会主动创建 passphrase session。
- 对 walletState 方法，如果没有传 `passphraseState`，THP 会在第一次真正 wallet call 前通过 `withDeviceState` 自动创建一个 app session。
- 如果设备没有打开 passphrase protection，创建 session 时使用空 passphrase，不弹 passphrase 输入。
- `getPassphraseState()` discover 模式会先创建 session、派生 state、fresh `GetFeatures`，然后如果 `passphrase_protection !== true` 返回 `null`。

hidden wallet：

- `getPassphraseState(connectId)` discover：
  1. 确保 session。
  2. `__thpCreateSession`。
  3. `btcGetPublicKey("m/44'/0'/0'")` 派生 state。
  4. `getFeatures({ refresh: true })`。
  5. passphrase protection 为 true 时缓存 `(connectId, state) -> thpSessionId` 并返回 state。
  6. 否则返回 `null`。

- `getPassphraseState(connectId, passphraseState)` verify：
  1. 如果缓存存在，先 `__thpSelectSession`。
  2. 重新派生 state。
  3. 匹配则成功。
  4. 不匹配则删除缓存并重新创建 session。
  5. 新 session 派生结果仍不匹配，抛 `PassphraseStateMismatch`。

- wallet-bound call 带 `passphraseState`：
  1. call 进入队列。
  2. adapter 设置 passphrase request context。
  3. `_alignAppSession` 选择或创建对应 THP app session。
  4. 每次都重新派生 state 验证，不信任缓存。
  5. 验证成功后才执行真实 chain method。

设备输入 passphrase：

- host UI 回复 `RECEIVE_PASSPHRASE { value: '', passphraseOnDevice: true }`。
- connector 转成 core 所需 `{ on_device: true }`。
- THP 走 `ThpCreateNewSession` 的 on-device passphrase。
- V1 走 `PassphraseAck { on_device: true }`。

## 8. Chain 方法

### BTC

文件：`packages/hwk-trezor-connector/src/chains/btc.ts`

支持：

- `btcGetAddress`
- `btcGetPublicKey`
- `btcGetMasterFingerprint`
- `btcSignMessage`
- `btcSignTransaction`

实现细节：

- coin name 做别名归一，例如 `btc -> Bitcoin`、`tbtc -> Testnet`。
- script type 可从 BIP32 purpose 推导。
- change output 使用 `PAYTO*`，input 使用 `SPEND*`。
- `btcSignTransaction` 按 Trezor Suite 的 multi-step `TxRequest` 流程实现。
- `PaymentRequest.amount` 是 decimal string，编码成固定字节长度的小端 hex。

风险：

- `btcSignTransaction` 注释标记 pending real-device verification。
- typed `TxAck*` 现代流程已实现，legacy 单 `TxAck` wrapper 没接。

### EVM

文件：`packages/hwk-trezor-connector/src/chains/evm.ts`

支持：

- `evmGetAddress`
- `evmSignMessage`
- `evmSignTransaction`
- `evmSignTypedData`

实现细节：

- legacy 和 EIP-1559 分开签。
- 大 calldata 通过 `EthereumTxRequest` / `EthereumTxAck` 分块。
- 支持 Trezor Ethereum definitions 请求，尝试从 `https://data.trezor.io` 获取 network/token definitions。
- typed data 支持 hash mode 和 full mode。
- Trezor One 对 typed data 走 hash mode fallback。

风险：

- definitions fetch 依赖网络，失败会降级为空 definitions。
- legacy `v` 会按 EIP-155 重建；EIP-1559 保留 y_parity。

### Solana

文件：`packages/hwk-trezor-connector/src/chains/sol.ts`

支持：

- `solGetAddress`
- `solSignTransaction`

不支持：

- `solSignMessage`

实现细节：

- `serializedTx` 去掉 `0x` 后传 `SolanaSignTx`。
- SPL token additional info 支持 `tokenAccountsInfos` 和 `encodedToken`。
- 如果没有传 `encodedToken`，会尝试从 Trezor definitions 服务获取 token definition。

### TRON

文件：`packages/hwk-trezor-connector/src/chains/tron.ts`

支持：

- `tronGetAddress`
- `tronSignTransaction`

不支持：

- `tronSignMessage`

实现细节：

- 先发 `TronSignTx` header。
- 设备返回 `TronContractRequest` 后，再发具体 contract message。
- 支持 transfer、trigger smart contract、freeze/unfreeze v2、vote witness、withdraw unfreeze。
- 地址要求 `41 + 20 bytes` hex。
- `amount` 使用 decimal string 或 safe integer，最终按 protobuf uint64 string 传。
- host 端 best-effort 重建 raw_data；失败时仍返回 signature。

风险：

- `tronSignTransaction` 注释标记 pending real-device verification。
- raw_data 只覆盖当前 host 能重建的 contract 类型。

## 9. All Network

adapter 的 `allNetworkGetAddress` 负责把 bundle 拆成多个单链 call：

- top-level `passphraseState` / `useEmptyPassphrase` 会合并到每个 item。
- BTC item 自动补 Trezor coin name。
- 如果 item 或入参带 device id，会 fresh 读取 Trezor `device_id` 校验。
- 返回 payload 会附加：
  - `deviceIdentity: { vendor: 'trezor', type: 'deviceId', value }`
  - `chainFingerprint`
  - `chainFingerprintChain`

Trezor 使用全局 `device_id` 做身份，不像 Ledger 按链 fingerprint。

## 10. BLE Connector

Desktop BLE：

- 文件：`packages/hwk-trezor-connector-electron-ble/src/TrezorElectronBleConnector.ts`
- connection type 是 `ble`。
- chunk size 使用 `TREZOR_BLE_PACKET_SIZE`。
- scan 结果保存完整 BLE descriptor 到 `raw.descriptor`。
- `persistentDeviceIdentity: false`，跨传输身份最终依赖 connect 后的 `Features.device_id`。

RN BLE：

- 文件：`packages/hwk-trezor-connector-rn-ble/src/TrezorRnBleConnector.ts`
- 只保留 `isTrezorSafe7BleDescriptor` 匹配的设备。
- connectId 由 `resolveTrezorBleConnectId` 解析。
- scan raw 同样保存在 `raw.descriptor`。

当前产品边界：

- BLE pairing / binding UI 只应在 Desktop 暴露。
- Web、Extension、Android、iOS 当前不提供 USB 到 BLE 绑定入口，因为它们没有同时可用的双传输能力。
- SDK connector 可以存在 RN BLE 能力，但 app 侧不等于要开放绑定 UI。

## 11. 错误和日志

标准错误：

- HWK 标准错误码定义在 `packages/hwk-adapter-core/src/types/errors.ts`。
- Trezor adapter 最终返回 `Response<T>`，失败为 `{ success: false, payload: { code, error } }`。
- `ThpPairingFailed` 会映射成 `HardwareErrorCode.ThpPairingFailed`。
- passphrase mismatch 会映射成 `HardwareErrorCode.PassphraseStateMismatch`。
- 已知 Trezor unsupported script type 会映射成 `MethodNotSupported`。

当前风险：

- Trezor `Failure_*` 还没有完整映射表，未知 Failure 仍可能落到 `UnknownError`。
- 这比误映射更安全，但 QA 需要覆盖常见拒绝、取消、固件不支持、设备锁定、pairing 失败。

日志安全：

- adapter 日志会 redacted `credential`、`credentials`、`host_static_key`、`passphrase`、`passphraseState`、`pin`、`trezor_static_public_key`。
- core THP module 日志会 redacted credential、key、nonce、packetHex、PIN、passphrase。
- debug logging 不允许影响协议执行。

## 12. Review 发现和已修项

已修：

- `passphraseState` 注释从 XFP/8 hex 改为当前真实实现：固定路径 compressed public key。
- `getPassphraseState` 文档改清楚：standard wallet discover 会返回 `null`，但 SDK 可能会创建一次 THP app session 和派生 state，用于解锁后 fresh `GetFeatures`。
- stale THP app session retry 现在会读取 `response.message.code`，避免跨 connector 序列化后字符串 code 不在顶层导致无法重建 session。
- 新增回归测试覆盖 `response.message.code = ThpUnallocatedChannel`。

仍需真机确认：

- BTC typed `TxAck*` 签名完整流程。
- TRON 多 contract raw_data 重建和设备返回。
- Trezor Safe 7 THP stale session 的真实错误 code。
- 设备输入 passphrase 在 THP 与 V1 下的完整 UI 行为。
- 设备 locked 时 THP retry 的用户体验和错误 code。

## 13. 回归清单

Passphrase：

- Trezor passphrase protection off：普通地址获取不弹 passphrase。
- Trezor passphrase protection off：`getPassphraseState()` 返回 `null`。
- Trezor passphrase protection on：`getPassphraseState()` 弹 passphrase，返回 state。
- 带 `passphraseState` 的 getAddress/sign 每次都验证 state。
- 输入错误 passphrase 返回 `PassphraseStateMismatch`，真实 chain op 不执行。
- THP 选择设备输入 passphrase 能走通。
- V1 选择设备输入 passphrase 能走通。
- `useEmptyPassphrase: true` 时 UI 自动回复空 passphrase。

THP / pairing：

- 首次 Safe 7 连接触发 CodeEntry pairing。
- credentials 持久化后下次连接走 autoconnect。
- pairing 输错 code 返回标准 `ThpPairingFailed`。
- 设备 locked 时出现 PIN on-device 提示，并且解锁后继续连接。
- stale app session 后能删除缓存、重建 session、重试一次。

设备管理：

- `getFeatures` 不触发 passphrase session。
- `deviceSettings` 不触发 passphrase session。
- `changePin` / `wipeDevice` 走 device scope。

链方法：

- BTC getAddress / getPublicKey / signMessage。
- BTC signTransaction，包含 refTx、change output、payment request。
- EVM getAddress / signMessage / legacy tx / EIP-1559 tx / typed data。
- Solana getAddress / signTransaction / token additional info。
- TRON getAddress / transfer / trigger smart contract / freeze / vote。
- Solana/TRON message signing 返回 `MethodNotSupported`。

BLE：

- Desktop USB scan。
- Desktop BLE scan。
- Desktop USB + BLE 合并列表。
- Desktop USB 绑定 BLE 后保存 BLE connectId。
- Web/Extension/Native 不显示 USB 到 BLE 绑定入口。

