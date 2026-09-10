# 硬件钱包配置区

App 侧硬件钱包的静态策略、厂商差异和网络适配集中在本目录。
修改行为配置从这里开始，不在 `appConfig.ts`、UI、Service 或 Keyring 中另建一份默认值。

| 要修改什么 | 文件 / 入口 |
| --- | --- |
| Ledger 自动安装 App、跨链预验证开关 | `ledger.ts` → `LEDGER_CONFIG` |
| Ledger 核心 Apps 列表与顺序 | `ledger.ts` → `LEDGER_CORE_APPS` |
| 第三方钱包批量地址调用方法 | `allNetworkAddress.ts` → `getAllNetworkAddressMethod` |
| Ledger 支持的网络、设备 App 名、指纹链 | `ledger.ts` → `LEDGER_NETWORK_CAPABILITIES`、`LEDGER_BTC_FAMILY_NETWORKS` |
| Ledger 跨链指纹候选及验证顺序 | `ledger.ts` → `LEDGER_FINGERPRINT_CHAINS` |
| Trezor BLE 支持的型号名 | `trezor.ts` → `TREZOR_BLE_SUPPORTED_MODEL_NAMES` |
| OneKey / Trezor / Ledger / Keystone 的能力、身份匹配规则和账户创建默认模式 | `vendorProfile.ts` → 对应厂商 profile |
| App 侧 BLE 连接等待时限 | `connectionTimeouts.ts` |

## 默认策略

- Ledger `autoInstallApp: true`；具体操作仍可通过 `commonParams.autoInstallApp` 覆盖。
- Ledger `enableCrossChainFingerprintVerification: false`；开启时才在目标链缺少指纹时尝试其他已存链的预验证。目标链已有指纹的校验不受此开关影响。
- 这些是随代码构建发布的默认配置，不是远程配置或用户设置。改动后需要重新构建相应 App。

## 维护规则

1. 按模块直接导入本目录对应文件，不保留旧路径的兼容转发，不为每个开关新增文件。
2. Ledger 增加网络适配时，一并检查 App 名、SDK 方法、fingerprint chain、核心 Apps 列表和配置测试；App 表项不代表 SDK 已支持该链。
3. 业务执行、会话状态、DB 持久化仍归 Service / Keyring / SDK；不要把执行逻辑搬到配置区。
4. 平台 connector 装配留在 `../connector-loader/`；固件远程配置获取留在 `../firmwareConfigProvider.ts`。它们是运行逻辑，不是静态策略表。
5. SDK 内的协议常量、密码学身份路径与原始 I/O 时序由 SDK 管理，不作为 App 可调开关复制到这里。
6. 本目录属于 shared，不依赖 kit、kit-bg、components；跨运行时只共享相同版本的配置代码，不共享可变 JS 对象。

## 回归测试

配置与适配测试位于本目录的 `ledger.test.ts`、`vendorProfile.test.ts`；跨链开关的开／关行为还由 `kit-bg` 的 `ledgerFingerprintUtils.test.ts` 和 `ServiceBatchCreateAccount.trezor.test.ts` 覆盖。
