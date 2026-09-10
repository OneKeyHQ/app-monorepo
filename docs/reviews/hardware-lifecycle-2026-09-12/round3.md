# 第三轮：生命周期终态与边界审查

> 历史归档：当前结论、去重结果和适用边界以 [统一报告](README.md) 为准。

本轮新增 **1 项确认缺陷**；另确认 **1 项需要明确契约的行为**，不将其计为 bug。人工检查材料见 [16 类业务工作单](README.md)，前两轮见 [round1](round1.md)、[round2](round2.md)。

范围：Keystone QR 请求归属、interaction release 与在途任务；同时复查 App 创建钱包、批量账户、返回/重试、孤儿清理和删除边界。独立分工为 SDK 生命周期、App 生命周期和人工流程入口清点，主审复核证据及分类。

App HEAD `f27b196f063fa6265fbdc330bf29184626619ca2`；SDK HEAD `fb30dc9641973f130100d865a183a026dc83413b`，目录 `js-sdk-trezor-experiment`。使用本地基线；没有提交、远程评论或业务代码修改。本轮只新增审查文档，并把前两轮报告归档到同目录。

平台：Desktop/Web 的 App main/bg 是单 JS runtime；iOS/Android/extension 的 main/bg 为独立 heap，UI 状态经桥各自反序列化并独立初始化。SDK registry/queue 在后台侧；Keystone QR 本身没有持续物理连接，USB connector handle 另有所有者，扩展 offscreen 又是独立 runtime。本轮 QR 复现无原生设备资源；不能据此推断移动端 native BLE 资源是否共享。

## R3-01 [P1] [🔵 High] 旧二维码响应可以完成新导入并写入 SDK 设备表

### 定位

- [KeystoneAdapter.ts:2485](/Volumes/DevVault/Dev/Projects/OnekeyWork/js-sdk-trezor-experiment/packages/hwk-keystone-adapter/src/adapter/KeystoneAdapter.ts:2485)：QR display waiter 未提供 requestId。
- [KeystoneAdapter.ts:2498](/Volumes/DevVault/Dev/Projects/OnekeyWork/js-sdk-trezor-experiment/packages/hwk-keystone-adapter/src/adapter/KeystoneAdapter.ts:2498)：QR scan waiter 同样缺少 requestId；两者接收同类 QR response。
- [UiRequestRegistry.ts:109](/Volumes/DevVault/Dev/Projects/OnekeyWork/js-sdk-trezor-experiment/packages/hwk-adapter-core/src/utils/UiRequestRegistry.ts:109)：没有注册请求 ID 时不能按旧响应 ID 拒绝。
- [KeystoneAdapter.ts:673](/Volumes/DevVault/Dev/Projects/OnekeyWork/js-sdk-trezor-experiment/packages/hwk-keystone-adapter/src/adapter/KeystoneAdapter.ts:673)：public import 解析返回、upsert 设备记录并成功返回。
- [ThirdPartyHardwareUiStateContainer/index.tsx:969](/Volumes/DevVault/Dev/Projects/OnekeyWork/app-monorepo-fix-ledger/packages/kit/src/provider/Container/ThirdPartyHardwareUiStateContainer/index.tsx:969)：HWK QR 回包仅带 vendor 和 QR 内容，缺少原 SDK 请求的权威归属。

### 复现与实际结果

1. 旧 `importFromQr({mode: 'scan'})` 开始等待扫描响应。
2. 取消旧 waiter，待旧 public 调用结束。
3. 新 `importFromQr({mode: 'request'})` 开始等待身份导出响应。
4. 送入旧轮次有效账户 UR 的模拟响应，额外带 `requestId: 'old-ui-request'`。
5. 新 public 调用成功，真实 `_devices` map 新增旧钱包记录。

```text
PUBLIC importFromQr:
  response.success: true
  response.payload.deviceId: OLD_WALLET_FIXTURE
  response.payload.connectId: keystone:OLD_WALLET_FIXTURE
  storedWallets: [OLD_WALLET_FIXTURE]
```

期望：旧响应不能解决新 waiter、不能产生本次导入成功或写入设备表。即使 UI 尝试传旧 requestId，SDK 当前也没有对应的请求 ID 可校验。

### 证据强度与边界

执行真实 public `importFromQr`、QR helper、UiRequestRegistry、DeviceJobQueue 和 `_upsertDeviceRecord`。UR 构建/解析和身份推导使用固定夹具；没有伪造真实密码学响应，也没有验证真实设备生成的 UR。此证据证明控制流和 SDK 落表，**不声称已复现 App DB 误创建钱包或资金损失**。

App 实际 HWK QR effect 有局部 `isSettled` 防重入，`expectedState` 比较在发送后的 finally 用于避免清理新 atom。这些保护不能作为 SDK 已校验答案归属的证据；普通 UI 中精确的迟到窗口仍需 main/bg 延迟及页面切换集成验证。不能把旧 `ServiceQrWallet` 的 qrSessionId 防护套到这条 HWK 路径。

签名 UR 的 request UUID 校验与此问题分层。本次证据落在冷导入，而非绕过签名 UUID 接受另一笔签名。

### 修复方向和验收

SDK 为每次 QR display/scan 生成 requestId，登记 waiter 并放进 UI 事件；App 将这个原始 ID 随成功、取消和失败响应返回；SDK 按请求、响应类型和所属操作核对。不能提交时读取最新 ID，把旧扫码结果重新归给新请求。

至少覆盖 scan→scan、scan→display、display→scan、display→display 四种替换；每种包含旧成功、旧取消、旧异常、重复回包和新正确响应。旧响应被拒绝后，新请求仍应正常完成。

相对 SDK 本地 `origin/onekey`（`9fe52e6e9f93cfdcfe5ae4800512a2e97b931408`），KeystoneAdapter 尚不存在，因此属于新增 HWK Keystone 栈；不声称由最近的 Ledger 提交引入。与 R1-01 同属 UI 请求归属缺口，但首次确认了独立 QR 实现和 public 导入落表路径。

## D02 [🟠 Medium / 契约决策] release 已结束 interaction，在途 QR 签名仍可成功

### 已确认行为

[KeystoneAdapter.ts:517](/Volumes/DevVault/Dev/Projects/OnekeyWork/js-sdk-trezor-experiment/packages/hwk-keystone-adapter/src/adapter/KeystoneAdapter.ts:517) 显式结束 interaction；QR 没有 USB session 时，`:532` 返回而不取消等待的 job/UI。路由在 await 前解析，之后 public 签名主要检查 signal 和签名 UUID：[KeystoneAdapter.ts:943](/Volumes/DevVault/Dev/Projects/OnekeyWork/js-sdk-trezor-experiment/packages/hwk-keystone-adapter/src/adapter/KeystoneAdapter.ts:943)。

执行 public `evmSignMessage` → 等待 QR → public `releaseInteraction` → 确认 registry 已结束 → 送入匹配签名 UUID 的夹具响应：

```text
Interaction state before response: Hardware interaction has ended (explicit)
PUBLIC evmSignMessage after release:
  { success: true, payload: { signature: '0x11221b' } }
```

这是生命周期结果验证，签名字节是合成夹具，不是有效签名证明。App release 入口为 [ServiceThirdPartyHardware:1121](/Volumes/DevVault/Dev/Projects/OnekeyWork/app-monorepo-fix-ledger/packages/kit-bg/src/services/ServiceThirdPartyHardware/index.ts:1121)；尚未证明普通 UI 存在「未结束 QR job 时 release」的稳定路径。

### 为什么不算确定 bug

[SDK decisions.md:45](/Volumes/DevVault/Dev/Projects/OnekeyWork/js-sdk-trezor-experiment/docs/architecture/decisions.md:45) 明确 cancel 中止当前 job 而不隐式结束 interaction；release 结束 interaction。文档没有明确 release 是否必须拒绝已经开始的 job 的最终结果。禁止用已结束 ID 发起新调用，不自动等于禁止旧调用完成。

人工需要选定一种契约并验证三家实现：

- **允许已有任务完成**：release 只禁止新调用，在途任务可完成；明确 owner 何时应 cancel 后再 release，以及 UI 已关闭后如何处理结果。
- **立即失效**：release 也结束所属等待，或至少在返回/提交结果前拒绝已结束 interaction；只清本次任务，不影响新操作。

不要仅给 release 添加全局 cancel；这会重现跨操作取消归属问题。此项不计入本轮新增确认缺陷。

## App 生命周期复查：保留为人工场景

未新增达到 High 的 App 确认缺陷。以下有明确代码交错点，但普通用户流程的并发可达性尚未证明：

| 编号 | 静态观察 | 必测时序与判定 |
|---|---|---|
| C01 | [FinalizeWalletSetup.tsx:1106](/Volumes/DevVault/Dev/Projects/OnekeyWork/app-monorepo-fix-ledger/packages/kit/src/views/Onboardingv2/pages/FinalizeWalletSetup.tsx:1106) retry 清 in-flight guard；`:1006` finally 读取共享 active interaction ref | A 未结算时错误→Retry B→A finally；A 不得 release B。目前相关错误入口主要在 HD 路径，第三方同页重入缺稳定复现 |
| C02 | [ServiceBatchCreateAccount.ts:372](/Volumes/DevVault/Dev/Projects/OnekeyWork/app-monorepo-fix-ledger/packages/kit-bg/src/services/ServiceBatchCreateAccount/ServiceBatchCreateAccount.ts:372) 新流程重置服务级取消 flag；`:1735` cancel 也改同一 flag | A 取消→B 启动→A 晚到；检查 A 是否恢复写库/进度，旧 finally 是否清 B。没有计入确定 finding |

人工清单还覆盖首次导入部分落库、Ledger 空钱包回收、隐藏钱包切换、删除时迟到结果、batch 缺项、不可重放操作、reset barrier 及平台资源所有权。仅清点不等于已证明这些路径没有问题。

## Standards / Spec

- Standards：QR waiter 与 UI 返回缺失权威关联，属于跨异步请求的正确性问题。
- Spec：interaction 与 job 的结束语义需要补充；遵守严格路由不代表 release 的在途结果语义已定义，不能用推测替代需求。
- 跨仓：R3-01 从 SDK public 返回追到 App HWK QR UI 发回链；明确区分局部组件清理与 bg/SDK 权威验收。

评分仍为已审硬件生命周期范围的 **6.4/10**（安全性 6、代码质量 6、架构 8、完整性 6，与前两轮口径一致）。未修复的既有问题仍在，此分数不是全仓或 PR 可合入判断。

## 验证与限制

本轮主审再次运行 [只读复现脚本](/tmp/onekey-hardware-lifecycle-round3-repro.js)，两组结果与上述一致：

```sh
node /tmp/onekey-hardware-lifecycle-round3-repro.js /Volumes/DevVault/Dev/Projects/OnekeyWork/js-sdk-trezor-experiment
```

脚本直接 transpile 当前 SDK 源码，替换 UR/密码学依赖为明确夹具；没有连接设备或写 App 数据。脚本位于本机临时目录，长期复测应将该时序转为相应 SDK 测试。

第一轮 App 定向 Jest 为 5 suites / 59 tests 全通过，代码未变，本轮未重复运行。未执行全量 lint、TypeScript、PR readiness、打包或真机验收。本轮文档链接及工作区范围另行检查；修复后仍需运行规范要求的验证。
