# JS SDK 与 monorepo：第二轮 ID 生命周期审查

> 历史归档：当前结论、去重结果和适用边界以 [统一报告](README.md) 为准。

## 审查概要

- App HEAD：`f27b196f063fa6265fbdc330bf29184626619ca2`。
- SDK HEAD：`fb30dc9641973f130100d865a183a026dc83413b`，路径为 `js-sdk-trezor-experiment`。
- 两仓代码与上一轮一致。App 原有 Ledger 连接页工作区改动仍在，SDK 工作区干净；未修改业务代码。
- 本轮深入取消目标解析、硬件命令派发、Trezor 绑定失败出口，以及扩展 offscreen reset；新增确认 4 项问题。
- 平台：Ledger/Trezor adapter 问题适用于对应 SDK 消费端；桌面/Web 单 JS runtime，移动端/扩展 main/bg 堆隔离。扩展 reset 问题另涉及 service worker 与持有 USB handle 的 offscreen document，两者有独立对象和初始化生命周期。
- 基线使用本地 `origin/x` / `origin/onekey`。未关联 PR、未发送评论；未进行真机操作。
- 独立审查分工：Ledger queue/session、Trezor binding/passphrase、App bridge/reset；全部新发现经过真实源码与合成依赖的内存执行验证。

## 发现的问题

### 1. [P1] [🔵 High] 有目标的旧 interaction cancel 被错误扩大到当前所有 session

**位置**：[LedgerAdapter.ts:1433](/Volumes/DevVault/Dev/Projects/OnekeyWork/js-sdk-trezor-experiment/packages/hwk-ledger-adapter/src/adapter/LedgerAdapter.ts:1433)、[LedgerAdapter.ts:1445](/Volumes/DevVault/Dev/Projects/OnekeyWork/js-sdk-trezor-experiment/packages/hwk-ledger-adapter/src/adapter/LedgerAdapter.ts:1445)、[LedgerAdapter.ts:1475](/Volumes/DevVault/Dev/Projects/OnekeyWork/js-sdk-trezor-experiment/packages/hwk-ledger-adapter/src/adapter/LedgerAdapter.ts:1475)。

**时序**：interaction A 已结束 → B 开始设备操作 → A 的调用方迟到执行 `cancel(A)`。

SDK 在验证 A 是否仍有效之前就取消整个 UI registry。解析 A 失败后将 `resolvedConnectId` 设为 undefined，再进入“取消全部当前 session”的分支，还会 abort 当前连接 controller。与此同时队列按 A 的 key 取消，B 的 job signal 仍未取消，导致队列和真实设备操作状态不一致。

**执行证据**：真实 LedgerAdapter.cancel、InteractionRegistry 和 DeviceJobQueue，合成 connector：

```text
currentJobSignalAborted: false
rawCancels: ["session-B"]
uiCancels: 1
newConnectAborted: true
```

**影响边界**：SDK 公开 API 的过期目标隔离被破坏；不需要指纹匹配失败即可影响其他操作。未证明普通 App UI 必然传入过期 interaction，也未证明资金损失。此项与上一轮“UI 未携带请求 ID”不同：即便调用方正确传回旧 interaction ID，SDK 仍不能安全拒绝它。

**修复建议**：先解析并验证显式目标，再做任何取消副作用。已结束/不存在的显式 interaction 应返回或报告已结束；只有真正无参数的 `cancel()` 才可取消全局。有效目标也必须限制 UI request、binding、连接 controller 与 queue job 的归属。

**来源**：相对 `origin/onekey`，interaction 解析失败后降级为 undefined 的分支属于本次改动。

### 2. [P1] [🔵 High] signal 已取消仍派发 installApp，调用者却收到取消错误

**位置**：[LedgerAdapter.ts:2251](/Volumes/DevVault/Dev/Projects/OnekeyWork/js-sdk-trezor-experiment/packages/hwk-ledger-adapter/src/adapter/LedgerAdapter.ts:2251)、[LedgerAdapter.ts:2812](/Volumes/DevVault/Dev/Projects/OnekeyWork/js-sdk-trezor-experiment/packages/hwk-ledger-adapter/src/adapter/LedgerAdapter.ts:2812)。

`_callConnector` 先执行 `connector.call()`，随后才通过 `_abortable()` 检查 signal。auto-install 确认之后会同步发布 progress=0 事件；如果 SDK 消费方在该回调中取消，随后依然派发安装命令。此前的取消发生时，新安装操作尚未注册，无法撤销这个后发命令。

**执行证据**：真实 `_runConnectorCall` 的 AppNotInstalled 分支、真实 `_callConnector`，替换 connector、确认结果和 UI listener：

```text
btcSignPsbt: alreadyAborted=false
installApp: alreadyAborted=true
reportedError: UserAborted during install progress UI
```

**影响边界**：已证实命令在取消后被派发，未连接硬件验证安装最终是否完成。App 当前是否存在同步取消该 progress 事件的 listener 未证明；这是可由 SDK 消费方触发的取消契约漏洞。

**Auto-fix 方向**：在派发入口先检查 signal，不能把已经开始执行的 Promise 交给 abort 包装器来代替派发前检查。

```diff
 ): Promise<unknown> {
+  if (signal) LedgerAdapter._throwIfAborted(signal);
   this._assertConnectorReady(method);
```

**来源**：先派发再检查的顺序在 `origin/onekey` 已存在；本轮新增发现，不是本轮代码新引入回归。

### 3. [P1] [🔵 High] Trezor 隐藏钱包流程失败后，BLE 绑定停留在 verifying

**位置**：[SDK TrezorAdapter.ts:1397](/Volumes/DevVault/Dev/Projects/OnekeyWork/js-sdk-trezor-experiment/packages/hwk-trezor-adapter/src/adapter/TrezorAdapter.ts:1397)、[App ServiceThirdPartyHardware:658](/Volumes/DevVault/Dev/Projects/OnekeyWork/app-monorepo-fix-ledger/packages/kit-bg/src/services/ServiceThirdPartyHardware/index.ts:658)、[ThirdPartyDeviceSelectionDialog.tsx:80](/Volumes/DevVault/Dev/Projects/OnekeyWork/app-monorepo-fix-ledger/packages/kit/src/components/Hardware/ThirdPartyDeviceSelectionDialog.tsx:80)。

**实际入口**：ServiceAccount 添加隐藏钱包 → hardwarePassphraseState → getTrezorPassphraseState，传入 expectedDeviceIdentity 和本机连接记录。

**时序**：已有 Trezor 钱包但本机没有 BLE 绑定 → 选择身份匹配的 BLE 设备 → 在设备上取消 PIN，或口令处理失败。

`_resolvePassphraseState()` 将异常转成 `Response.failure`，上层 finally 只释放 provisional connection，没有发出该 selectionRequestId 的 failed/cancelled 终态。真实 disconnect 事件只清 session/device 缓存，普通 CLOSE_UI_WINDOW 清的也不是 BLE binding atom。App 绑定弹窗因此仍处于 verifying。

**执行证据**：真实 SDK discover mode，模拟设备 PIN 取消，并由 mock disconnect 向 SDK 发送实际同形断开事件：

```json
{
  "success": false,
  "code": 10401,
  "explicitDisconnectEvents": 1,
  "statuses": ["verifying"],
  "remainingSessions": 0,
  "remainingDevices": 0
}
```

这证明连接资源清理成功并不意味着绑定 UI 生命周期结束。

**修复建议**：覆盖所有未完成保存的返回/抛错出口，按原 selectionRequestId 发 failed/cancelled，再清理连接；已成功保存的绑定不得被迟到错误改回失败。

**来源**：该 BLE 选择及 provisional cleanup 为相对 `origin/onekey` 的新增路径。

### 4. [P1] [🔵 High] 扩展 reset 后复用已清除事件监听的 Trezor connector

**位置**：[OffscreenApiThirdPartyHardware.ts:222](/Volumes/DevVault/Dev/Projects/OnekeyWork/app-monorepo-fix-ledger/packages/kit-bg/src/offscreens/OffscreenApiThirdPartyHardware.ts:222)、[同文件 getConnector:56](/Volumes/DevVault/Dev/Projects/OnekeyWork/app-monorepo-fix-ledger/packages/kit-bg/src/offscreens/OffscreenApiThirdPartyHardware.ts:56)、[SDK Trezor connector reset:717](/Volumes/DevVault/Dev/Projects/OnekeyWork/js-sdk-trezor-experiment/packages/hwk-trezor-connector/src/index.ts:717)。

**已确认入口**：扩展开发工具清除/破坏 THP 状态 → `disposeTrezorAdapterCache()` → SDK dispose → bridged reset → offscreen connector.reset。之后 App 重建 adapter 并重新配对。

offscreen 的 reset 仅调用 cached connector.reset，不移除缓存，也不重新订阅。Trezor connector.reset 清空 eventHandlers。下一次 getConnector 返回同一对象，跳过 subscribeConnectorEvents；连接调用可以继续，但 PIN/THP UI 请求与断开事件不再转发给后台。

**执行证据**：真实 App offscreen 类及 SDK TrezorConnectorBase 的 on/reset/emit，替换设备发现与实例工厂：

```json
{
  "creations": 1,
  "forwardedBeforeReset": 1,
  "forwardedAfterReset": 0,
  "remainingEventTypes": 0
}
```

**影响边界**：确认影响扩展中上述开发工具恢复路径；未证明所有普通重连会触发 dispose/reset。不能把“App adapter 重建”误认为“offscreen 原生资源与 connector 已重建”。

**修复建议**：明确 reset 后 connector 是否可复用：若可复用，重新建立转发订阅；若重建，应失效缓存并串行完成旧实例释放、重新创建与订阅。跨进程 reset 应有完成确认，避免新连接先于 reset 完成。

**来源**：App reset/getConnector 的问题在本地 `origin/x` 已存在，本轮首次确认。

## 上轮问题复核

- Noble 旧 disconnect listener、Ledger USB fallback 验证前结束绑定：没有发现推翻原结论的证据。
- PIN/passphrase 旧响应归属、公开 Ledger connectDevice 并发：两仓代码未变，原执行证据仍适用于本轮 HEAD。
- Ledger 跨链首次指纹信任：仍为当前明确配置与测试认可的行为取舍，未当作误写分支重复报告。

## Standards / Spec 与跨仓联动

- Standards：取消必须先验证目标归属；abort 之后不得新增派发；运行时缓存与资源订阅必须一起失效。
- Spec：binding session 在成功、取消、失败等出口必须有可观察终态，Trezor failure 返回路径未满足。
- App 与 SDK 联动：Trezor failure→binding atom、offscreen reset→connector listener 两条均追到具体 App 入口；Ledger 两项已确认 SDK 公开契约问题，普通 UI 触发范围明确保留限制。
- 本轮无依赖修改、DB schema 修改或翻译修改；未执行供应链/远端发布内容验证。

## 评分（仅已审硬件生命周期范围）

| 维度 | 得分 | 说明 |
|---|---:|---|
| 安全性 | 6/10 | 请求与取消归属尚有缺口 |
| 代码质量 | 6/10 | 四条失败/取消/reset 时序已复现 |
| 架构合理性 | 8/10 | ID 分层总体明确，跨 runtime 资源生命周期未闭合 |
| 完整性 | 6/10 | 成功路径覆盖较好，失败出口仍缺失 |
| 加权总分 | 6.4/10 | 需修复后复审；不是整仓合入评估 |

## 修改清单与验证建议

| 优先级 | 修改 | 必要回归场景 |
|---|---|---|
| P1 | stale targeted cancel 不得变为 global cancel | A 已结束，B job/连接/UI 等待，cancel(A) 不得影响 B |
| P1 | 派发前检查 signal | 安装确认后取消，connector 不得收到新的 installApp |
| P1 | Trezor 绑定失败终态 | 选择 BLE 后 PIN 取消、钱包状态不匹配、通信失败；连接释放且弹窗退出 |
| P1 | offscreen reset 恢复转发 | reset→重新配对；UI request/disconnect 能继续到达后台 |

## 验证结果与限制

本轮执行 4 类真实源码内存模拟，均复现上述问题。没有修改业务文件、操作硬件或发送外部评论。上轮 5 套 59 项 Jest 测试因相关代码未变而未重复运行；它们不是本轮新增时序的覆盖证明。本轮未运行全量 lint、TypeScript、打包或真机测试。
