# 设备定位字段：按厂商速查

改动或新增厂商前先看这张表。三个字段长得像，含义不一样，写错的后果是「连不上」或「重复设备」。

## 字段

| 字段 | 含义 |
| --- | --- |
| `usbConnectId` | USB 通道的定位值 |
| `bleConnectId` | BLE 通道的定位值 |
| `connectId` | **遗留字段**。老记录里可能是 USB 也可能是 BLE，取决于当初从哪个通道 onboard；Keystone 例外，见下 |

## 按厂商

| 厂商 | `connectIdRole` | 新记录写什么 | 说明 |
| --- | --- | --- | --- |
| OneKey | `transportLocator` | 三个字段维持原有行为 | 不在本次治理范围内 |
| Ledger | `transportLocator` | 只写 `bleConnectId`（USB 句柄是临时的，不存） | USB 无持久定位是设计常态，空值正常 |
| Trezor | `transportLocator` | 只写 `usbConnectId` / `bleConnectId` | USB 是序列号，BLE 是绑定后的地址 |
| Keystone | `walletIdentity` | `connectId` = `keystone-wallet:<walletId>`，**是身份不是定位**；USB 序列号另写进 `usbConnectId` | 它没有 BLE |

## 规则

1. **不要直接读 `device.connectId` 当定位值。** 用 `thirdPartyTransportLocators()`（`kit-bg/src/vaults/base/thirdPartyHardwareCommonParams.ts`），它会把老记录的遗留值按 `connectIdRole` 和平台折进正确的通道。
2. **写入侧**：`connectIdRole === 'transportLocator'` 的第三方厂商不再写 `connectId`。判断在 `LocalDbBase.createHwWallet` 的 `usesTransportLocatorConnectId`。
3. **不迁移老数据。** 老记录原样保留，靠读取侧归位。更新既有记录时 `item.connectId = compatibleConnectId || item.connectId` 保证不会被清空。
4. **设备去重不受影响**：`LocalDbBase` 找已有设备时 `connectId` / `usbConnectId` / `bleConnectId` 三个字段都比对，两种形态都能匹配上。
5. **Keystone 的 `connectId` 永远不要当定位用**，也不要被「归位」逻辑挪走——`thirdPartyConnectionContextFromDevice` 里那个 `connectIdRole` 判断就是拦这件事的。
