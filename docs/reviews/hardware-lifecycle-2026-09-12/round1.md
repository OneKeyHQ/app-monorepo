# JS SDK 与 monorepo：硬件 ID 生命周期审查

> 历史归档：当前结论、去重结果和适用边界以 [统一报告](README.md) 为准。

## 审查概要

- 日期：2026-09-12。只读审查，未修改业务代码、提交或发布评论。
- App：`app-monorepo-fix-ledger`，`feat/keystone-support`；本地 `origin/x...HEAD` 共 267 文件，+13611/-4470，另检查工作区 Ledger 连接页修改。
- SDK：`js-sdk-trezor-experiment`，`feat/keystone-integration`，HEAD `fb30dc964`；本地 `origin/onekey...HEAD` 共 143 文件，+19604/-1560。
- 深审集中于第三方硬件身份、连接、绑定、UI 响应与持久化调用链；不代表上述全部文件或原生 HD 协议已逐行审完。未刷新远端基线，未关联 PR。
- 规范来源：两仓 AGENTS.md、App CONTEXT.md、硬件领域审查约定。需求来源为当前连接领域 CONTEXT.md。
- 涉及平台：桌面/Web 为单 JS runtime；移动端/扩展 main 与 bg 隔离，跨边界数据各自反序列化，不能按对象引用判断归属，也不能假设 UI 已同步到后台最新状态。
- 设备通信状态归后台/connector；Electron BLE 的 Noble 和原生 BLE 资源另归 Electron main process。本文不把 Electron main process 与 App 的 main/bg JS runtime 混为一谈。
- 独立交叉审查：SDK 实现、App 持久化与主审 UI/后台边界；下述执行验证均使用合成输入。
- PR 评论分析：未指定 PR，未进行远程评论分析或发送评论。

## ID 生命周期结论

| ID | 应有用途与生命周期 | 核查结果 |
|---|---|---|
| DB device id | App 持久化记录主键 | 与 SDK 身份分离；绑定事务重新验证记录 |
| deviceId / walletId | vendor 定义的持久设备或钱包身份 | Trezor、Keystone 分策略验证；不应以 transport locator 替代 |
| chainFingerprint | Ledger 指定链的身份锚 | 已存目标链指纹会验证；首次跨链默认允许重新信任，见安全取舍 |
| connectId / usbConnectId / bleConnectId | vendor/transport 定义的定位符 | Ledger USB 空持久 connectId 保留；BLE 定位符本身不是身份证明 |
| searchTargetId | 发现结果；可复用性由 reuse policy 决定 | runtime ID 持久化入口有拦截，不能统一当长期 ID |
| interactionId | 一次业务连接上下文，可跨多个调用；结束后不可复用 | registry 有 TTL、retain、结束记录；公开并发 connect 存在漏洞 |
| connector sessionId | connector 的活跃会话 | 原生旧回调不能只按设备 id 查当前 entry，否则影响新会话 |
| bindingSessionId / selection requestId | 一次绑定会话与本轮选择 | DB 写入归属检查较完整；Ledger USB fallback 提前结束归属 |
| uiRequestId / SDK requestId | 某一次提示与其答案的关联 | 清理有保护，PIN/passphrase 响应链路未闭合 |

## 发现的问题

### 1. [P1] [🔵 High] 旧 PIN/passphrase 答案可以满足新请求【历史缺陷】

**文件**：

- [DeviceStageBurst.ts:1044](/Volumes/DevVault/Dev/Projects/OnekeyWork/app-monorepo-fix-ledger/packages/kit-bg/src/services/ServiceHardwareUI/DeviceStageBurst.ts:1044)
- [DeviceStageContainer/index.tsx:178](/Volumes/DevVault/Dev/Projects/OnekeyWork/app-monorepo-fix-ledger/packages/kit/src/provider/Container/DeviceStageContainer/index.tsx:178)
- [ServiceThirdPartyHardware/index.ts:888](/Volumes/DevVault/Dev/Projects/OnekeyWork/app-monorepo-fix-ledger/packages/kit-bg/src/services/ServiceThirdPartyHardware/index.ts:888)
- [SDK Trezor connector:821](/Volumes/DevVault/Dev/Projects/OnekeyWork/js-sdk-trezor-experiment/packages/hwk-trezor-connector/src/index.ts:821)
- [UiRequestRegistry.ts:109](/Volumes/DevVault/Dev/Projects/OnekeyWork/js-sdk-trezor-experiment/packages/hwk-adapter-core/src/utils/UiRequestRegistry.ts:109)

**时序**：请求 A 超时/断连结束 → 后台开始同类型请求 B → main 仍显示 A 的输入卡 → 用户提交 A 的输入。Stage 没保留原提示的 uiRequestId，后台只按 vendor 转发，SDK PIN/passphrase waiter 未提供 requestId，registry 按类型取到 B 并接受答案。

**影响**：错误请求收到 PIN 矩阵输入或 passphrase，可能导致错误尝试、错误钱包上下文或后续身份校验失败。此处未证明资金损失，也不能假定后续校验一定绕过。

**验证**：直接加载真实 SDK registry 源码，模拟 A cancelled → B waiting → late A response。PIN 与 PASSPHRASE 的 `newRequestAcceptedOldResponse` 均为 true。未记录真实输入。

**修复建议**：SDK 为每次输入分配 requestId，逐层传至输入组件；提交、取消都携带原 requestId，并在 bg/SDK 权威状态中验证。不能在提交时读取“最新请求”并把旧输入重新归给它。只保护清理 atom 不足以保护答案和取消。

**历史定位**：App `origin/x` 与 SDK `origin/onekey` 已有同类缺口；本次 ID 改造尚未覆盖它，非新引入回归。

### 2. [P1] [🔵 High] 物理断连后旧 Noble disconnect listener 没有释放【历史缺陷，扩展影响 Ledger】

**文件**：[NobleBleHandler.ts:850](/Volumes/DevVault/Dev/Projects/OnekeyWork/js-sdk-trezor-experiment/packages/hwk-trezor-connector-electron-ble/src/NobleBleHandler.ts:850)、[NobleBleHandler.ts:1040](/Volumes/DevVault/Dev/Projects/OnekeyWork/js-sdk-trezor-experiment/packages/hwk-trezor-connector-electron-ble/src/NobleBleHandler.ts:1040)。

**时序**：连接注册 H1 → 物理断连的 cleanup 删除 entry，但保留 H1 → 同 peripheral 重连注册 H2 → 显式 disconnect 只移除 H2，原生事件仍触发 H1，再次上报 unexpected disconnect。回调只捕获设备 id，旧 peripheral 的迟到事件也可能命中同 id 的新 entry。

**验证**：真实类方法配合内存 peripheral mock：物理断连后 listener 数为 1，重连后为 2；显式断连使 unexpected 计数从 1 增至 2，预期保持 1。

**修复建议**：cleanup 同时移除 disconnectHandler；回调验证 entry identity/generation。明确的最小修改方向如下，还需覆盖迟到原生事件：

```diff
 const disconnectHandler = () => {
+  if (this._connected.get(id)?.disconnectHandler !== disconnectHandler) return;
   this._cleanupDevice(id, true);
 };

 const entry = this._connected.get(id);
 if (!entry) return;
+if (entry.disconnectHandler) {
+  entry.peripheral.removeListener('disconnect', entry.disconnectHandler);
+}
```

**历史定位**：旧 Trezor 实现已存在；此次 Ledger 复用 Noble 后扩大影响。这里的 generation 是连接资源归属，不能用稳定设备 id 代替。

### 3. [P1] [🔵 High] Ledger 在验证 USB 身份前结束 BLE 绑定会话【新增回归 / Spec】

**文件**：[LedgerAdapter.ts:2126](/Volumes/DevVault/Dev/Projects/OnekeyWork/js-sdk-trezor-experiment/packages/hwk-ledger-adapter/src/adapter/LedgerAdapter.ts:2126)、[LedgerAdapter.ts:2579](/Volumes/DevVault/Dev/Projects/OnekeyWork/js-sdk-trezor-experiment/packages/hwk-ledger-adapter/src/adapter/LedgerAdapter.ts:2579)。

**时序**：为已知设备 A 等待 BLE 绑定 → 插入 USB B → 自动 USB fallback 清 selectedConnection/pending binding，发 cancelled → 随后指纹验证发现 B 不匹配 → 因当前 transport 已变 USB，直接抛 DeviceMismatch。

**影响**：原绑定 UI 已结束，用户不能留在原 bindingSession 继续扫描并选择 A，必须重启操作。身份校验仍会拒绝 B；不是错设备签名绕过。

**规则出处**：App CONTEXT.md 明确要求 USB identity mismatch 后，用户可在 active session 中继续扫描和选择。Trezor 对应逻辑先验证候选，mismatch 时释放并继续，Ledger 不一致。

**修复建议**：USB 验证成功前保留 provisional binding 上下文；错误候选加入排除集合、释放连接并继续原会话，成功后再结束绑定 UI。当前结论来自完整静态调用链，未做真机插拔验证。

### 4. [P1] [🔵 High] 公开 Ledger connectDevice 并发可绕过单会话淘汰【SDK 历史缺陷】

**文件**：[LedgerAdapter.ts:481](/Volumes/DevVault/Dev/Projects/OnekeyWork/js-sdk-trezor-experiment/packages/hwk-ledger-adapter/src/adapter/LedgerAdapter.ts:481)、[LedgerAdapter.ts:682](/Volumes/DevVault/Dev/Projects/OnekeyWork/js-sdk-trezor-experiment/packages/hwk-ledger-adapter/src/adapter/LedgerAdapter.ts:682)、[LedgerAdapter.ts:726](/Volumes/DevVault/Dev/Projects/OnekeyWork/js-sdk-trezor-experiment/packages/hwk-ledger-adapter/src/adapter/LedgerAdapter.ts:726)。

**时序**：并发 connect(A)、connect(B) 均在 session 写入前执行 eviction → A/B 各自连接完成 → 两者都写入 session 并创建有效 interaction。`_stateGeneration` 覆盖 reset，不区分这两个 acquire；公开 connectDevice 未经设备任务队列。

**验证**：真实 LedgerAdapter 与 InteractionRegistry，connector 使用 deferred Promise。最终 sessions 同时包含 USB A、B，两个 interaction 都 resolve 成功，后一次选择没有结束前一次 interaction。

**影响与边界**：SDK 所声明的 USB 单会话和“新选择结束旧交互”约束可被公开 API 并发调用破坏。尚未证明普通用户 UI 必然触发该并发，也未证明设备间错误签名。

**修复建议**：将公开 acquire/connect 的淘汰、连接、发布整体串行化，或使用 acquire generation 拒绝并释放过期结果。不要仅给最终 Map.set 加锁。

## 安全取舍：Ledger 缺失链指纹仍默认重新建立信任

[ledger.ts:18](/Volumes/DevVault/Dev/Projects/OnekeyWork/app-monorepo-fix-ledger/packages/shared/src/hardware/config/ledger.ts:18) 默认关闭跨链身份验证；[ledgerFingerprintUtils.ts:283](/Volumes/DevVault/Dev/Projects/OnekeyWork/app-monorepo-fix-ledger/packages/kit-bg/src/vaults/base/ledgerFingerprintUtils.ts:283) 和 `:302` 使 `allowFingerprintBootstrap:false` 也不能在该配置下禁止无锚调用。

已有钱包 A 只有 EVM 指纹时，换成设备 B 首次添加 BTC，可以接受 B 的 BTC 结果并记录 B 的 BTC 指纹。SDK 的 interaction 固定的是本次连接，knownConnections 是定位提示，都不能证明它与已有 EVM 身份属于同一 seed。

当前测试明确认可默认只建立目标链指纹，因此这是有意的行为取舍，不应描述为误写分支。但 UI 中“同一钱包”的含义与这个信任模型存在差距。建议已有钱包扩链前验证任一已存身份锚；至少让显式 `allowFingerprintBootstrap:false` 保持硬约束。未修改该产品决策。

另有“同链指纹并发首次写入缺少 CAS”的潜在问题；尚缺具体 App 并发入口证明，未列为确定 finding。

## 跨仓联动检查

- Runtime ID 与 DB 身份分离：检查到持久化入口拒绝 runtime ID 的保护；定向测试覆盖。
- Ledger USB 空持久 connectId：保留，没有套用 Trezor 模型强制要求非空。
- Trezor 设备身份与 passphrase 参数：调用仍向 SDK 传递持久 deviceId 与 passphrase 上下文。
- BLE binding 保存：验证 vendor、identity strategy、目标 DB record，并在事务内二次验证和检查当前绑定归属。
- UI 请求生命周期：绑定选择有 requestId；PIN/passphrase 响应和取消链路仍缺失，见 finding 1。
- SDK 同版本接口：App root/CLI 的受审 SDK pin 均为 1.2.3-alpha.1；本地安装声明包含 binding 新接口。未验证发布包远端内容、供应链发布时间或完整打包产物。
- 真机验证：未连接或修改硬件。移动端 BLE、Electron 原生插拔、扩展跨进程时序仍需集成验证。

## Standards / Spec

- Standards：旧请求归属、原生监听释放、公开 acquire 原子性仍有缺口；不把风格或命名偏好列作缺陷。
- Spec：Ledger USB fallback 的会话结束时机与当前 CONTEXT.md 不符。

## 评分（仅本次硬件生命周期审查范围）

| 维度 | 得分 | 说明 |
|---|---:|---|
| 安全性 | 6/10 | 响应归属缺失；跨链首次信任取舍需明确 |
| 代码质量 | 6/10 | 原生监听与 acquire 竞态已复现 |
| 架构合理性 | 8/10 | 身份、locator、interaction 分层总体清楚 |
| 完整性 | 6/10 | DB 防护较好，UI/原生生命周期覆盖不足 |
| 加权总分 | 6.4/10 | 需修改后复审；不是整仓可合入结论 |

## 修改清单与测试建议

| 优先级 | 项目 | 建议验证 |
|---|---|---|
| P1 | UI 请求全链路 correlation | A 超时/取消后 B 等待；迟到 A 输入和取消均不能影响 B |
| P1 | Noble listener cleanup 与 generation | 物理断连、同 peripheral 重连、显式断连、旧 peripheral 迟到事件 |
| P1 | Ledger USB fallback 验证顺序 | BLE 选择中插入错误 USB；原会话保持可继续选择 |
| P1 | Ledger 公开 acquire 串行化 | 两个 deferred connect 逆序完成；过期 interaction 不可用且旧资源释放 |
| 决策项 | 已有钱包缺失链指纹 | A 已存 EVM、B 首次 BTC；明确预期拒绝还是允许重新信任 |

## 验证结果

真实源码内存验证确认：PIN/passphrase 迟到响应被新 waiter 接收；Noble disconnect listener 累积及异常断连误报；Ledger 并发 USB connect 留下两个有效 interaction。

App 定向 Jest：5 个测试套件、59 项全部通过（205.13 秒）：

- `registerBleBindingUi.test.ts`：26 项。
- `LocalDbBase.verifiedBinding.test.ts`：10 项。
- `LocalDbBase.hardwareRuntimeId.test.ts`：3 项。
- `ledgerFingerprintUtils.test.ts`：14 项。
- `ConnectionFlowLedger.test.tsx`：6 项。

现有测试通过不覆盖上面新增的跨请求/原生事件时序，也不把跨链首次信任的有意行为变成安全证明。未运行全量 lint/TypeScript、PR readiness 或真机验证；没有修改业务代码。

## 工具限制

一条读取仓库元信息与配置的命令被本机自动审批规则拦截：路径被判定可能涉及机密，确认窗口随后超时。未重试该命令，已通过源代码继续审查；不影响上述已给出代码和执行证据的 findings。
