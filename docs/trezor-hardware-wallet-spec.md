# Trezor 硬件钱包接入 SPEC

## 1. 目标和范围

这份文档描述当前 OneKey App 侧的 Trezor 接入方案。

本次改动的目标是兼容 Trezor，不是替换已有 OneKey 硬件钱包逻辑：

- HD Wallet / OneKey 硬件路径仍然是 OneKey 专用。
- HWK 是第三方硬件抽象层，面向 Trezor、Ledger，以及未来其他外部设备。
- Trezor 在能力和业务行为相同的地方按 OneKey-like 处理。
- 只有协议、固件能力、传输机制确实不同的地方，才走 Trezor 专用分支。
- Ledger 仍然有很多特殊点：需要打开链 App、按链 fingerprint、App 安装流程、Ledger BLE 行为等。

当前 App 侧 Trezor 支持范围：

- 设备发现和 DB 身份映射。
- THP 配对凭据持久化。
- Trezor passphrase / hidden wallet 流程。
- Desktop USB 到 BLE 的绑定与 fallback。
- 默认添加账户网络。
- EVM、BTC、SOL、TRON 地址和签名流程。
- 第三方硬件错误标准化和用户侧恢复逻辑。

## 2. 核心概念

- `connectId`：调用 HWK 时使用的传输句柄。Trezor USB 下是 USB 侧 id，BLE 下是 BLE 侧 id。
- `deviceId`：来自 Trezor `Features.device_id` 的稳定固件身份。我们用它确认 USB 候选和 BLE 候选是否是同一台 Trezor。
- `usbConnectId`：存储在 `IDBDevice` 上的 USB 侧 connect id。
- `bleConnectId`：绑定后存储在同一个 `IDBDevice` 上的 BLE 侧 connect id。
- `passphraseState`：Trezor 的 wallet-state 引用，用来定位 hidden wallet 状态；它不是 device setting。
- `useEmptyPassphrase`：显式声明本次使用主钱包。为 true 时，Trezor passphrase request 会自动回复空 passphrase。
- `thpCredentials`：THP 配对时生成的设备凭据，按设备保存在 Trezor device settings 内。

## 3. Vendor 能力模型

文件：

- `packages/shared/src/hardware/vendorProfile.ts`

Trezor 通过统一的 vendor profile 注册能力，避免在各业务点直接散落 `vendor === trezor` 判断。

Trezor 关键能力：

- `isThirdParty: true`
- `supportsSoftwarePin: false`
- `requiresAppOpen: false`
- `hasPersistentConnectId: true`
- `hasPersistentDeviceId: true`
- `supportsDeviceManagementDetails: true`
- `supportsDeviceSettings: true`
- `supportsPassphraseSetting: true`
- `supportsHiddenWalletCreation: true`
- `addAccountDefaultNetworkMode: 'onekeyDefault'`

原因：

- Trezor 没有 Ledger 那种按链打开 App 的要求。
- Trezor THP 的 PIN 在设备上输入，Host 不显示 PIN 矩阵。
- Trezor `Features.device_id` 稳定，除非设备被 wipe。
- Trezor hidden wallet 基于 passphrase，因此钱包 UI 可以开放 hidden wallet 创建。
- Trezor 添加账户默认网络跟 OneKey 一样使用默认四链，不走 Ledger 的 app-aware 逻辑。

## 4. 设备元数据和 DB 映射

文件：

- `packages/shared/src/utils/thirdPartyDeviceUtils.ts`
- `packages/kit-bg/src/dbs/local/LocalDbBase.ts`
- `packages/kit-bg/src/services/ServiceHardware/thirdPartyDeviceMapping.ts`

Trezor feature 持久化只保存安全、稳定、可展示的标量字段，不把 SDK raw features 整体落库。

允许保存的字段包括：

- 固件版本字段。
- `device_id`。
- firmware vendor / provider / product 信息。
- language、passphrase、safety checks、auto-lock。
- unit metadata。
- `usb_connected` / `wireless_connected` 等连接状态。

固件版本解析优先级：

1. device settings 里的 `vendorFirmwareVersion`。
2. persisted features 里的 `third_party_firmware_version`。
3. 通用 `firmware_version`。
4. `major_version.minor_version.patch_version`。
5. 空字符串。

固件类型判断保持 Trezor Suite 兼容：

- `fw_vendor === 'Trezor Bitcoin-only'` => Bitcoin-only。
- `fw_vendor === 'Trezor'` => Universal。
- bootloader mode 下回退看 `unit_btconly`。
- capability list 没有 `Capability_Bitcoin_like` 时按 Bitcoin-only。

DB settings 映射规则：

- `vendorModel` 保存 Trezor internal model，例如 `T3W1`。
- `vendorModelName` 保存展示 model，例如 `Safe 7`。
- `vendorFirmwareVersion` 保存解析后的固件版本。
- 刷新第三方设备 metadata 时保留已有 settings，例如 Ledger chain fingerprints。
- `clearTrezorThpSettingsRaw` 只删除 `thpCredentials`，其他 settings 保留。

Trezor USB / BLE 身份：

- USB `connectId` 对 Trezor 是稳定的。
- BLE `connectId` 在支持平台上也是可复用的。
- 跨传输确认同一台设备时，仍以 `Features.device_id` 为准。
- Desktop BLE 创建设备记录时，Trezor 可把 firmware `device_id` 存成 `usbConnectId`。

## 5. Connector 加载和平台支持

文件：

- `packages/shared/src/hardware/connector-loader/trezor.ts`
- `packages/shared/src/hardware/connector-loader/trezor.desktop.ts`
- `packages/shared/src/hardware/connector-loader/trezor.ext-bg-v3.ts`
- `packages/shared/src/hardware/connector-loader/trezor.native.ts`
- `packages/kit-bg/src/services/ServiceHardware/adapters/thirdPartyHardwareAdapterRegistry.ts`

平台行为：

| 平台                 | Connector 文件        | 传输行为                                    |
| -------------------- | --------------------- | ------------------------------------------- |
| Web                  | `trezor.ts`           | WebUSB only                                 |
| Extension background | `trezor.ext-bg-v3.ts` | 通过 offscreen bridge 走 WebUSB             |
| Desktop              | `trezor.desktop.ts`   | 默认合并 WebUSB + BLE                       |
| Native               | `trezor.native.ts`    | Native connector；不开放 USB 到 BLE 绑定 UI |

Desktop connector 支持三种模式：

- `all`：默认，USB 和 BLE 合并。
- `usb`：仅 WebUSB。
- `ble`：仅 BLE，通过 `window.desktopApi.thirdPartyBle`。

临时调试开关：

- `localStorage.setItem('debug.trezor.transport', 'ble')`
- `localStorage.removeItem('debug.trezor.transport')`

Registry 初始化流程：

1. 懒加载平台对应的 Trezor connector。
2. 从所有 Trezor 设备 settings 中读取已保存的 THP credentials。
3. 调用 `connector.setKnownCredentials`。
4. 创建 HWK Trezor adapter。
5. 包装成 App 侧 `TrezorAdapter`。

日志行为：

- Trezor SDK log event 只订阅一次。
- Offscreen 日志通过 `hwkSdkEvent` 回传 background。
- Desktop connector 日志会过滤 credential、PIN、passphrase、nonce、packet 等敏感字段。

## 6. TrezorAdapter：UI 事件和 THP Session

文件：

- `packages/kit-bg/src/services/ServiceHardware/adapters/TrezorAdapter.ts`

`TrezorAdapter` 是 App 侧对 HWK Trezor wallet 的包装。

职责：

- 把 HWK UI event 转成 App UI atom。
- 把 Trezor features 持久化到 local DB。
- 把 THP credentials 持久化到设备记录。
- 处理 passphrase request。
- 把 Trezor button request 分发到 unlock 或 confirm-on-device UI。
- reset adapter state 和 SDK event subscription。

关键事件：

- `REQUEST_TREZOR_THP_PAIRING`：打开 Trezor THP pairing UI。
- `REQUEST_PASSPHRASE`：根据参数自动回复空 passphrase，或者打开 host passphrase UI。
- `REQUEST_BUTTON` + `ButtonRequest_PinEntry`：打开 Trezor unlock UI。
- 其他 `REQUEST_BUTTON`：走 generic confirm-on-device。
- `CLOSE_UI_WINDOW`：清理第三方硬件 UI state。
- legacy `REQUEST_DEVICE_CONNECT`：Trezor 下 suppress，不弹旧式 reconnect UI。

THP credentials 流程：

1. Connector 发出 `DEVICE.TREZOR_THP_CREDENTIALS_CHANGED`。
2. App adapter 按 `deviceId`、`connectId`、mapped `featuresDeviceId` 缓存 credentials。
3. 如果 DB 设备记录已经存在，立即持久化。
4. 如果 pairing 发生在 wallet/device record 创建前，先 buffer。
5. wallet 创建后调用 `persistTrezorThpCredentials` flush。
6. credentials 存在该设备 settings 中，删除设备时自然一起删除。

## 7. Passphrase 和 Hidden Wallet

文件：

- `packages/kit-bg/src/vaults/base/thirdPartyHardwareCommonParams.ts`
- `packages/kit-bg/src/services/ServiceThirdPartyHardware/index.ts`
- `packages/kit-bg/src/services/ServiceAccount/hardwarePassphraseState.ts`
- `packages/kit/src/provider/Container/ThirdPartyHardwareUiStateContainer/utils.ts`
- `packages/kit/src/views/AccountManagerStacks/components/WalletEdit/WalletEditButtonUtils.ts`

Passphrase 是 wallet state 相关，不是 device setting。

硬件调用只透传两个字段：

- `passphraseState`
- `useEmptyPassphrase`

主钱包逻辑：

- 调用方需要显式传 `useEmptyPassphrase: true`。
- HWK 发出 `REQUEST_PASSPHRASE` 且 `useEmptyPassphrase` 为 true 时，adapter 回复：
  - `RECEIVE_PASSPHRASE { value: '' }`

Hidden wallet 逻辑：

- 没有显式 `useEmptyPassphrase` 时，`REQUEST_PASSPHRASE` 打开 Trezor passphrase UI。
- Host 输入响应：
  - `{ value: passphrase, passphraseOnDevice: false, save }`
- 设备输入响应：
  - `{ value: '', passphraseOnDevice: true, save }`
- `passphraseState` 解析走 `ServiceThirdPartyHardware.getTrezorPassphraseState`，因为 OneKey core SDK 不拥有 Trezor THP session。

UI 规则：

- Trezor 允许创建 hidden wallet。
- Ledger 仍不显示 hidden wallet 创建入口。
- OneKey 既有行为仍由 vendor profile 控制。

## 8. Desktop USB 到 BLE 绑定

文件：

- `packages/shared/src/utils/thirdPartyDeviceUtils.ts`
- `packages/kit/src/views/DeviceManagement/pages/DeviceDetailsModal/utils.ts`
- `packages/kit/src/components/Hardware/TrezorBleBindingDialog.tsx`
- `packages/kit/src/components/Hardware/trezorBleBindingUtils.ts`
- `packages/kit-bg/src/services/ServiceThirdPartyHardware/index.ts`
- `packages/kit-bg/src/vaults/base/trezorTransportUtils.ts`

平台规则：

- BLE binding 只在 `thirdPartyDeviceUtils.isTrezorBleBindingSupportedPlatform(platformEnv)` 为 true 时开放。
- 该 helper 优先看 `platformEnv.isSupportDesktopBle`。
- Web、Extension、Android、iOS，以及不支持 Desktop BLE 的平台：
  - 不显示绑定入口。
  - 不请求绑定弹窗。
  - 不使用已保存的 `bleConnectId` fallback。

设备规则：

- 必须是 Trezor。
- 必须有 `connectId` 和稳定 `deviceId`。
- 不能已经有 `bleConnectId`。
- 型号必须被 HWK Trezor BLE model helper 认为支持 BLE。

为什么 scan 阶段不能直接确认 BLE 设备：

- Trezor 没有稳定的 `ble_name`。
- Host 只能在连接 BLE candidate 后读取 `Features.device_id`。
- 所以 UI 只能先列出 BLE candidates，再由 service probe 选中的 candidate。

绑定流程：

1. Device Details 或业务 fallback 请求 `requestTrezorBleConnectIdForDevice`。
2. Service 检查平台支持和必要 id。
3. UI 打开 `TrezorBleBindingDialog`。
4. Dialog 使用 `waitForAllTransports: true` 扫描 Trezor 设备。
5. Candidate list 只保留 BLE 设备，并排除已知 USB connect id。
6. 用户选择 BLE candidate。
7. Dialog 停止扫描，释放 BLE transport。
8. `bindTrezorBleConnectId` 连接 candidate。
9. 如果 candidate 触发 THP pairing，说明不是同一台设备，直接 cancel 并视为 mismatch。
10. 如果 candidate `deviceId` 等于 USB 已知 `featuresDeviceId`，把 `bleConnectId` 写入同一个 DB device。
11. UI promise resolve `bleConnectId`。
12. 如果 mismatch 或连接失败，UI 标记该 candidate rejected，并恢复扫描。

业务 fallback 流程：

1. Keyring 先用 primary `usbConnectId || connectId` 调用。
2. 成功则直接返回。
3. 失败不是 `DeviceDisconnected` 或 `DeviceNotFound`，直接返回原失败。
4. 平台不支持 Trezor BLE binding，直接返回原失败。
5. 已有 `bleConnectId` 且不同于 primary，则用 BLE 重试。
6. 没有 `bleConnectId`，设备支持 BLE，且调用方提供 binding requester，则打开绑定 UI。
7. 用户绑定成功后，用新的 BLE id 重试同一个硬件调用。
8. 用户取消或绑定失败，返回原失败。

## 9. 默认添加账户和 All-Network

文件：

- `packages/shared/src/hardware/vendorProfile.ts`
- `packages/kit-bg/src/services/ServiceAccount/defaultNetworkAccountsConfig.ts`
- `packages/kit-bg/src/services/ServiceBatchCreateAccount/thirdPartyAllNetworkParams.ts`
- `packages/kit-bg/src/services/ServiceBatchCreateAccount/thirdPartyAllNetworkErrors.ts`
- `packages/kit-bg/src/services/ServiceBatchCreateAccount/ServiceBatchCreateAccount.ts`
- `packages/kit-bg/src/vaults/impls/trezorAllNetworkParams.test.ts`

默认网络：

- Bitcoin-only firmware 只创建/添加 BTC。
- Trezor 第三方 add-account 使用 OneKey 默认四链：
  - BTC
  - EVM
  - TRON
  - SOL
- Ledger 第三方 add-account 仍然 app-aware，尊重显式选择的网络。

All-network address params：

- EVM：
  - `{ network: 'evm', path, showOnOneKey: false, chainName }`
- BTC：
  - 使用 account xpub path，移除最后两个 path segment。
- SOL：
  - `{ network: 'sol', path, showOnOneKey: false }`
- TRON：
  - `{ network: 'tron', path, showOnOneKey: false }`

Bundle normalize 规则：

- 补 method name。
- 补 `showOnDevice`。
- EVM 补 numeric `chainId`。
- request-level common params 不进入单个 bundle item：
  - `passphraseState`
  - `useEmptyPassphrase`
  - `autoInstallApp`
- Ledger fingerprints 只给 Ledger attach，Trezor 不使用 Ledger chain fingerprints。

Install cancel 归一化：

- 如果 all-network 至少有一个 item 成功，则部分 install/app cancel 可以标记为噪音。
- 如果没有任何 item 成功，用户取消类失败保留。

## 10. 各链 Keyring 细节

### 10.1 EVM

文件：

- `packages/kit-bg/src/vaults/impls/evm/KeyringHardwareTrezor.ts`

地址：

- 调用 `adapter.hw.evmGetAddress(connectId, deviceId, params)`。
- verify address 时 `showOnDevice: true`。
- verify address 时传 numeric `chainId`。
- 透传 passphrase params。
- 全部包在 BLE fallback 中。

交易签名：

- 通过 `buildHardwareEvmTransaction` 转换 OneKey encoded tx。
- 传给 Trezor/HWK 的是 flat tx fields，不是 Ledger 的 `serializedTx` 或 `transaction`。
- 支持 legacy gas price、EIP-1559、access list、payment request、static Ethereum definitions。
- 用 HWK 返回的 `{ v, r, s }` 重建 signed raw transaction。

消息签名：

- `personal_sign`：
  - UTF-8 转 hex。
  - `0x` hex 去掉 prefix。
  - 统一传 `hex: true`。
- `eth_sign`：
  - `ThirdPartyMethodNotSupported`。
- `typed_data_v1`：
  - `ThirdPartyMethodNotSupported`。
- typed-data v3/v4：
  - 传 parsed data。
  - 传 `metamaskV4Compat`。
  - 传 domain separator hash。
  - 有 message hash 时传 message hash。
  - 传 numeric chain id。

### 10.2 BTC

文件：

- `packages/kit-bg/src/vaults/impls/btc/KeyringHardwareTrezor.ts`

地址和 xpub：

- 使用 `btcGetPublicKey`，路径是 account xpub path。
- 根据 address encoding 转 BTC fork xpub。
- P2TR 账户额外调用 `btcGetMasterFingerprint`。
- P2TR descriptor 使用设备 master fingerprint，不使用 `passphraseState`。
- `batchGetAddresses` 调 `btcGetAddress`，路径是完整 receive path，并传 `scriptType`。

Script type 只看 purpose path segment：

- `44'` => `p2pkh`
- `49'` => `p2sh`
- `84'` => `p2wpkh`
- `86'` => `p2tr`

交易签名：

- PSBT 请求显式不支持：
  - stock Trezor firmware 没有 SignPsbt message。
  - host-side PSBT decode -> SignTx -> re-embed 尚未实现。
- 非 PSBT 使用 Trezor SignTx 结构化字段：
  - `coin`
  - `version`
  - `locktime`
  - fork fields：`timestamp`、`expiry`、`versionGroupId`、`branchId`
  - structured inputs
  - structured outputs
  - payment requests
  - ref txs
- input amount 使用 decimal string：`BigNumber(...).toFixed()`。
- change output 带 path 和 script type。
- OP_RETURN output 使用 hex data，amount 为 `0`。
- SLIP-24 payment request 和 original transaction metadata 透传。
- 如果 structured `origRefTx` 已覆盖同一个 txid，则跳过 raw prev tx parsing。

消息签名：

- BIP322-simple 不支持，抛 `ThirdPartyMethodNotSupported`。
- ECDSA message 转 hex 并传 `hex: true`。
- DApp/Electrum 风格请求传 `noScriptType: true`。

### 10.3 SOL

文件：

- `packages/kit-bg/src/vaults/impls/sol/KeyringHardwareTrezor.ts`

地址：

- 调用 `solGetAddress`。
- verify address 控制 `showOnDevice`。
- 透传 passphrase params。
- 包在 BLE fallback 中。

交易签名：

- 解析 encoded Solana transaction。
- 序列化 message bytes 为 hex。
- 调用 `solSignTransaction`，参数包括：
  - `path`
  - `serializedTx`
  - 可选 `additionalInfo.encodedToken`
  - 可选 `additionalInfo.tokenAccountsInfos`
- ATA 映射：
  - `owner` => `baseAddress`
  - `programId` => `tokenProgram`
  - `mintAddress` => `tokenMint`
  - `associatedTokenAddress` => `tokenAccount`
- 返回的 hex signature 写回 native transaction。
- `txid` 是 base58 signature。
- `rawTx` 是 base64 serialized transaction。

消息签名：

- Trezor 不支持 Solana message signing，抛 `ThirdPartyMethodNotSupported`。

### 10.4 TRON

文件：

- `packages/kit-bg/src/vaults/impls/tron/KeyringHardwareTrezor.ts`

地址：

- 调用 `tronGetAddress`。
- verify address 控制 `showOnDevice`。
- 透传 passphrase params。
- 包在 BLE fallback 中。

交易签名：

- 每笔 TRON 交易只支持一个 contract。
- 必须存在 `owner_address`。
- 地址保持 TRON hex 形式，即 `41` prefix，不转 base58。
- 支持的 contract：
  - `TransferContract`
  - `TriggerSmartContract`，但 `call_value` 必须为空或 0
  - `FreezeBalanceV2Contract`
  - `UnfreezeBalanceV2Contract`
  - `VoteWitnessContract`
  - `WithdrawExpireUnfreezeContract`
- 不支持的 contract 抛 `ThirdPartyMethodNotSupported`。
- multi-contract transaction 抛 `ThirdPartyMethodNotSupported`。
- 如果 Trezor 返回 `serializedTx`，最终 raw tx 使用它。
- 否则保留原始 `raw_data_hex`。

消息签名：

- Trezor firmware 没有 TRON message signing，抛 `ThirdPartyMethodNotSupported`。

## 11. 错误处理

文件：

- `packages/shared/src/errors/utils/thirdPartyDeviceErrorUtils.ts`
- `packages/kit-bg/src/services/ServiceBatchCreateAccount/thirdPartyAllNetworkErrors.ts`

规则：

- 第三方错误 code 先 normalize，numeric string 会转 number。
- invalid firmware metadata response 映射为 network error。
- `DeviceNotFound` 打开 hardware troubleshooting dialog，并关闭 auto toast。
- all-network 部分成功时，install cancel 噪音可以被过滤。
- device out-of-memory 即使已有部分账户成功，也保留为 genuine failure。
- 重复 out-of-memory toast 会折叠。
- `autoToast: false` 的错误不会走 generic toast。
- Trezor 不支持的方法使用 `ThirdPartyMethodNotSupported`，不要直接抛 SDK 原始字符串。

## 12. UI 入口

Device Details：

- 文件：`packages/kit/src/views/DeviceManagement/pages/DeviceDetailsModal/utils.ts`
- Trezor 显示：
  - device settings
  - passphrase settings
  - device connection
- Trezor 不显示 OneKey support/about/firmware update 区块。
- BLE binding row 仅在支持平台、支持型号、且未绑定 `bleConnectId` 时显示。

Connection Flow：

- 文件：`packages/kit/src/views/Onboardingv2/pages/ConnectionFlowTrezorUtils.ts`
- Extension UI 在 listing 前请求 WebUSB permission。

Third-party UI Container：

- 文件：`packages/kit/src/provider/Container/ThirdPartyHardwareUiStateContainer/index.tsx`
- 处理：
  - install app
  - permission
  - Trezor THP pairing
  - Trezor passphrase
  - Trezor BLE binding
  - unlock
  - confirm-on-device
  - generic cancel

## 13. 回归清单

改 Trezor/HWK 逻辑时至少回归这些点：

1. 设备发现
   - USB Trezor 正确映射 `connectId` 和 firmware `deviceId`。
   - BLE Trezor 保留 BLE `connectId`，同时 firmware `deviceId` 不丢。
   - Ledger mapping 不受影响。

2. THP credentials
   - 首次 pairing 产生 credentials。
   - device record 创建后 credentials 能持久化。
   - adapter 下次初始化能 warm-load credentials。
   - 删除设备会清掉 credentials。

3. Passphrase
   - 主钱包传 `useEmptyPassphrase`，不弹 passphrase UI。
   - Hidden wallet 弹 passphrase UI。
   - 设备输入 passphrase 返回 `passphraseOnDevice: true`。
   - `passphraseState` 通过 Trezor service 获取，不走 OneKey core SDK。

4. BLE binding
   - Desktop Mac/Win 可把 Safe 7 USB 绑定到 BLE。
   - 非支持平台不显示绑定入口。
   - 非支持平台 fallback 不请求绑定弹窗。
   - 非支持平台不使用已保存的 `bleConnectId`。
   - 选错 BLE candidate 会 rejected 并恢复扫描。
   - 选中正确 BLE candidate 会持久化 `bleConnectId`。

5. All-network 创建账户
   - Trezor 默认 BTC/EVM/TRON/SOL。
   - Bitcoin-only firmware 只创建 BTC。
   - Ledger 仍然 app-aware。
   - Trezor 不接收 Ledger chain fingerprints。

6. 各链签名
   - EVM legacy、EIP-1559、payment request、typed-data v4 都正常。
   - BTC SignTx 保留 version、locktime、fork fields、ref txs、change path、OP_RETURN、SLIP-24 metadata。
   - BTC PSBT 仍显式不支持。
   - SOL token metadata 能映射到 `additionalInfo`。
   - SOL message signing 仍显式不支持。
   - TRON multi-contract 和 unsupported contract 会拒绝。
   - TRON 在 Trezor 返回 `serializedTx` 时优先使用。

7. 错误
   - `DeviceNotFound` 打开 troubleshooting dialog。
   - 不支持的方法使用标准 third-party unsupported error。
   - all-network 部分安装取消不会产生多余 toast。

## 14. 当前测试覆盖策略

当前测试保留在容易回归的边界上：

- shared vendor/profile 和 device metadata helper。
- DB settings 映射。
- Adapter event routing 和 THP credential persistence。
- Service 级 BLE binding 和 direct request guard。
- Transport fallback 行为。
- 各链 keyring 参数 builder。
- all-network 参数 normalize。
- UI utility 行为。
- 错误 normalize 和 toast filtering。

新增测试时优先遵循：

- 一个真实分支只保留一条单元测试。
- 跨层行为保留一个 contract-level 测试，再保留一个 integration-style caller 测试。
- 不要为了覆盖率在 helper、service、UI 三层重复证明同一件事。
