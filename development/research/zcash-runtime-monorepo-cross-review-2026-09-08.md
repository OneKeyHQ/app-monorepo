# Zcash runtime / monorepo 交叉审查报告

## 修复进展（2026-09-08）

以下问题描述、行号和评分保留为修复前证据。五项发现已实施修复，并完成两轮增量交叉复核；最终检查结果见本节更新。

1. **关闭死锁**：持有 UFVK lifecycle mutex 时直接检查未决广播；回归测试使用真实非重入锁，验证连续关闭和锁释放。
2. **共享扫描漏扫**：网络级扫描锁内重新读取稳定开启／正在开启的账户；启用 rescan 也在同一锁内排入，避免旧 scheduler 快照或并发 enable 消耗不完整账户集合的扫描区间。
3. **暂时超时永久隔离**：仅对具备真实执行完成语义的 Web/direct、Desktop Promise，在完成或失败后解除该 Promise 对应隔离；移动端／扩展 RPC 超时仍要求确认载体已终止，旧任务不能清除新隔离。
4. **金额被改写**：明确传递 `transferPayload.isMaxSend`，补齐 hook、ServiceSend prepare/build 到 Vault 的路径；普通金额保持原值。Max 和金额页额度使用相同的池／透明输入策略，池 Withdraw 显式标记 Max。
5. **WASM 种子残留**：Rust WASM 接口接收拥有所有权的种子缓冲并立即 Zeroizing；补充对 mnemonic／xprv 字符串的拥有权清理。由于上游哈希栈还会保留输入副本，keys 模块导出 linker stack bounds，host 在最外层同步调用结束后擦除该栈区，兼容重入和 memory growth。已重建相邻 runtime 的实际 `pkg-keys`；新 app 依赖该产物，旧产物缺少边界时明确拒绝加载。

验证状态：首轮应用回归 9 suites / 58 tests 通过；Rust keys 23 tests 通过；实际 WASM 合成种子清理 5 条成功／失败路径和地址 golden 验证通过。新增发送透传／并发扫描测试通过（3 suites / 11 tests，含重跑原有 ServiceZcash 8 项；合计 11 suites / 61 个不同测试）。最终改动涉及的 6 个 suite / 35 项测试已复跑通过（其中发送测试在修正 Jest mock 初始化顺序后单独重跑）。完整 `yarn agent:check --profile commit` 已全部通过，日志为 `node_modules/.cache/agent-checks/2026-09-08T02-33-57-643Z/summary.json`；`git diff --check` 与本次 Rust 源文件格式检查通过。

范围限制：未做真实资金广播、原生设备／UI 端到端验证；种子清理验证覆盖合成输入在实际 WASM 线性内存中的完整值及长后缀，不是对全部上游密码库堆内存或不可变 JS 字符串的完整清零证明。

## 审查概要

- **结论**：需修改后复审。确认 4 项 P1 功能问题、1 项 P2 内存清理问题。
- **范围**：`app-monorepo` 的 `feat/zcash-integration`，HEAD `374d620ef8`，包含当前未提交实现；对照相邻 `onekey-zcash-runtime` 源码、锁定依赖及 monorepo portal 实际加载的 WASM 产物。
- **变更规模**：相对本地 `origin/x` merge-base 的 committed diff 为 152 文件、+17,528/-61；另有工作区改动及未跟踪文件。没有拉取远端，本报告不是远端 PR 状态审查。
- **风险等级**：High。
- **涉及平台**：Desktop / Web / iOS / Android / Extension。
- **Codex 交叉验证**：已启用，两项独立子审查分别覆盖 runtime 契约、生命周期；主审对调用链和关键证据再次核对。
- **PR 评论分析**：未执行；本次按本地实现审查，没有指定 PR。
- **深审边界**：重点检查密钥/WASM 边界、PCZT 发送、透明发送、共享扫描状态、模式开关和超时恢复。没有宣称逐行审完所有 UI、构建、第三方供应链或整个 Rust 上游。

平台拓扑：Desktop/Web 的 app main/bg 是单 JS 运行时；Desktop 的 Zcash Worker 是额外运行时，Web 直接执行。iOS/Android/Extension 的 app main/bg 堆隔离，服务与生命周期锁位于 bg；移动端 Zcash 位于 WebView，扩展位于 offscreen。WASM/SQLite 由对应载体持有，各 JS heap 经 RPC 获得独立反序列化结果；持久化 IndexedDB 数据库按 runtime state key 共享。没有把 main/bg 初始化或载体 ready 当成同步成立的前提。

## 评分

| 维度 | 得分 | 说明 |
|---|---:|---|
| 🔒 安全性 | 7/10 | 广播不确定态有保守处理，但 WASM seed 输入仍残留 |
| 💎 代码质量 | 4/10 | 死锁、永久隔离及金额改写已确认 |
| 🏛️ 架构合理性 | 6/10 | 屏蔽扫描的账户集合与全局进度模型不一致 |
| ✅ 完整性 | 5/10 | 现有测试通过，但遗漏真实锁、多账户回填和恢复场景 |
| **总分** | **5.7/10** | **⚠️ 需修改后复审** |

评分是本次审查范围内的判断，不是安全审计认证。

## Codex 交叉验证摘要

| 发现 | Primary | 独立复核 | 状态 |
|---|---|---|---|
| 关闭模式重复获取同一锁 | Yes | Yes | 调用链交叉验证；真实 mutex 最小复现 |
| 单账户启用推进共享扫描进度 | Yes | Yes | app → runtime → SQLite 队列交叉验证 |
| 暂时超时后永久隔离 | Yes | Yes | 调度器与载体恢复契约交叉验证 |
| 金额被单个屏蔽池余额截断 | Yes | Yes | 提取实际 app 方法复现，runtime 选币语义复核 |
| WASM seed 输入残留 | Glue code confirmed | 实际 WASM 复现 | 合成 seed；无真实钱包数据 |

## 发现的问题

### [P1] [🔵 High] 关闭 Privacy Mode 会重复获取同一个非重入锁

**文件**：[ServiceZcash.ts:261](/Volumes/DevVault/Dev/Projects/OnekeyWork/app-monorepo/packages/kit-bg/src/services/ServiceZcash.ts:261)

**类型**：运行时 / 并发。**平台**：全部支持平台。

正常开启账户已有 UFVK metadata。`disablePrivacyModeImpl` 在 244 行取得该 UFVK 的 lifecycle mutex，并在 `runExclusive` 内调用 `zcashAssertNoUnresolvedBroadcastWithLifecycleLock`；[Vault.ts:529](/Volumes/DevVault/Dev/Projects/OnekeyWork/app-monorepo/packages/kit-bg/src/vaults/impls/zcash/Vault.ts:529) 再次获取同一个 mutex。外层等待内层，内层等待外层释放，因此关闭永远不完成，后续同账户模式操作也被堵住。开启状态下删除本地隐私数据复用这一关闭路径。

真实 `async-mutex` 最小复现得到 `{locked:true, innerRan:false}`。`ServiceZcash.test.ts` 将锁 mock 成直接调用 callback，无法暴露此问题。

**Auto-fix（建议，未应用）：**

```diff
-      await vault.zcashAssertNoUnresolvedBroadcastWithLifecycleLock(accountId);
+      await vault.zcashAssertNoUnresolvedBroadcast(accountId);
```

此处已经持锁；其他未持锁调用者仍需要带锁包装器。

### [P1] [🔵 High] 启用一个账户会漏扫其他已开启账户的历史收款

**文件**：[ServiceZcash.ts:205](/Volumes/DevVault/Dev/Projects/OnekeyWork/app-monorepo/packages/kit-bg/src/services/ServiceZcash.ts:205)

**类型**：跨仓一致性 / 余额与历史。**平台**：全部支持平台。

启用 B 的首轮 `syncGroup` 只传 `[B]`。[Vault.ts:1089](/Volumes/DevVault/Dev/Projects/OnekeyWork/app-monorepo/packages/kit-bg/src/vaults/impls/zcash/Vault.ts:1089) 将其转为唯一的 `activeUfvks`。runtime [sync.rs:217](/Volumes/DevVault/Dev/Projects/OnekeyWork/onekey-zcash-runtime/crates/zcash-runtime/src/sync.rs:217) 仅生成这些账户的扫描密钥，但扫描区间来自共享数据库队列；[sync.rs:479](/Volumes/DevVault/Dev/Projects/OnekeyWork/onekey-zcash-runtime/crates/zcash-runtime/src/sync.rs:479) 写回后，[SQLite scanning.rs:480](/Volumes/DevVault/Dev/Projects/OnekeyWork/onekey-zcash-runtime/vendor/zcash_client_sqlite-0.22.0/src/wallet/scanning.rs:480) 把整个区间标为 `Scanned`，并不按账户记录扫描覆盖率。

触发场景：A 正在历史回填，开启 B；B 首轮消耗了含 A 收款的历史区间，而 A 不在解密集合中。之后调度器即使恢复 A+B，该区间也已经完成，A 的余额/历史会缺失，需重新扫描恢复。此项是源码调用链确认，没有执行真实收款实验。

反证检查：开启前的 `queueRescanFrom` 发生在该轮扫描之前；正常 A 的 birthday 未变化，不满足现有“birthday 变早”的自动修复条件。

**修复建议**：启用首轮应纳入同一 runtime group 的全部已开启账户，加上正在开启的目标；或者只做目标注册，让持有完整 active 集合的调度器扫描。共享队列推进必须与本轮完整授权扫描集合一致。

### [P1] [🔵 High] Web 暂时超时后即使扫描完成也不会恢复调度

**文件**：[ServicePrivacyChain.ts:874](/Volumes/DevVault/Dev/Projects/OnekeyWork/app-monorepo/packages/kit-bg/src/services/ServicePrivacyChain.ts:874)

**类型**：运行时 / 恢复。**平台**：Web，以及 Desktop 退回进程内实现时。

超时后将该组放入 `quarantinedSyncs`，仅当 `recoverFromTimeout()` 返回 true 才解除。Web 的恢复函数返回 false；Desktop 进程内 fallback 的 reset 抛错。原始同步 Promise 随后真实完成时没有解除隔离，因此 722 行永久过滤该组，余额与历史停止更新，直到重新加载。

**修复建议**：区分实际执行 Promise 完成与 RPC 代理超时。对 Web/direct、Desktop/in-thread 能确认写者已结束的完成事件解除隔离并重新调度。不能简单对所有载体 `finally(clearQuarantine)`，因为代理超时并不证明远端执行已经停止。

### [P1] [🔵 High] 发送金额被错误改成屏蔽池 Max，透明输入偏好也被提前阻断

**文件**：[Vault.ts:3132](/Volumes/DevVault/Dev/Projects/OnekeyWork/app-monorepo/packages/kit-bg/src/vaults/impls/zcash/Vault.ts:3132)

**类型**：交易金额 / 跨仓选币。**平台**：全部支持平台。

`amount >= poolsDetail[spendSource].spendable` 就进入 Max 分支，并将金额改为该屏蔽池余额减手续费。它没有区分用户明确填写金额和 Max，也未把 `spendTransparent=true` 允许的输入计入可用额度。

runtime [send.rs:345](/Volumes/DevVault/Dev/Projects/OnekeyWork/onekey-zcash-runtime/crates/zcash-runtime/src/send.rs:345) 的 `with_transparent(any_account_addr())` 允许透明输入覆盖付款和手续费；锁定 backend 的 proposal 会把透明输入纳入余额计算。app 却可能在调用 runtime 前就拒绝或改小金额。

提取当前真实 `buildEncodedTx` 方法、仅替换外部读取/报价依赖的最小验证：

| 屏蔽余额 | 请求 | 透明优先 | 实际结果 |
|---:|---:|---|---|
| 1 ZEC | 2 ZEC | false | 被改成 0.9999 ZEC（假定手续费 0.0001） |
| 0 ZEC | 1 ZEC | true | `INSUFFICIENT_FUNDS`，报价调用次数为 0 |
| 1 ZEC | 0.5 ZEC | false | 保留 0.5 ZEC |

第一种可由页面余额读取后下降、invoice/prefill 等导致请求超过当前余额。第二种即使透明输入足额，也会提前失败。最终确认页可能展示改写后的金额；这里不声称绕过用户签名确认。

**修复建议**：显式传递 send-max 意图；普通金额不改写，让实际 proposal 判断是否足额。Max 计算必须匹配同一 `spendSource/spendTransparent` 策略，并同步核对金额页的额度来源。

### [P2] [🔵 High] 清空 JS seed 后仍留下 WASM 输入副本

**文件**：[bindgen.rs:98](/Volumes/DevVault/Dev/Projects/OnekeyWork/onekey-zcash-runtime/crates/zcash-keys-runtime/src/bindgen.rs:98)

**类型**：安全 / 内存生命周期。**平台**：所有加载 keys WASM 的载体。

`seedFingerprint`、`ufvkFromSeed`、`pcztSignWithSeed` 等 Rust 边界接收 `&[u8]`；生成 glue 会通过 `passArray8ToWasm0` 把 seed 复制到 WASM。app [keys.ts:48](/Volumes/DevVault/Dev/Projects/OnekeyWork/app-monorepo/packages/core/src/chains/zcash/sdkZcash/impl/keys.ts:48) 的 `seed.fill(0)` 只擦除了 JS 数组，释放 WASM 分配块不等于清零。

独立复核在全新实际 WASM 实例中使用合成 64 字节 seed：`seedFingerprint` 返回并清空 JS 数组后，仍能从 WASM memory 找到完整 seed；UFVK 派生及 PCZT 签名错误路径保留连续 56 字节尾部。未读取真实 seed，未发现网络外传，也未证明远程利用。

**修复建议**：让 Rust 边界拥有可擦除输入并在成功和错误返回时 zeroize，重新生成 glue/WASM；避免仅擦除一个额外复制出的 Rust buffer 而遗漏原始 bindgen 输入。

## 修改清单

| 优先级 | 置信度 | 位置 | 修改目标 | Auto-fix |
|---|---|---|---|---|
| P1 | 🔵 High | ServiceZcash 关闭路径 | 已持锁时使用无锁内部检查 | 建议 diff |
| P1 | 🔵 High | ServiceZcash 启用 / runtime sync | 完整 active 集合推进共享队列 | — |
| P1 | 🔵 High | ServicePrivacyChain 超时 | 确认真实完成后恢复调度 | — |
| P1 | 🔵 High | Vault buildEncodedTx | 保留普通金额，正确处理 Max 来源 | — |
| P2 | 🔵 High | keys runtime bindgen | 擦除 WASM seed 输入副本 | — |

## 验证与测试建议

已完成：

- `yarn agent:check --profile commit` 全部通过，包括仓库 lint、格式、背景 API 契约、TypeScript 检查。该脚本内含 `oxlint --fix` 和 `oxfmt`，执行时带有自动修复/格式化行为；本次未手动应用业务逻辑修复。
- 8 个定向 Jest suites，58/58 测试通过：send、keys、wallet、desktop carrier、Vault transparentMode、Vault privacyData、ServiceZcash、SimpleDbEntityZcash。
- 真实 async-mutex 的嵌套获取复现；提取实际 app 方法的金额分支复现；实际 WASM 的合成 seed 残留复现。
- portal 实际 wallet/keys WASM 的 Ironwood prove/sign 与 transparent V6 API 存在，接口/报告版本与当前源码一致；未重建，所以不声称二进制可复现性已验证。
- 已排除 Orchard UA / Ironwood 不匹配的误报：锁定 backend 在对应升级后允许 Orchard receiver 路由到 Ironwood bundle。

需要补充：

1. 使用真实 mutex 测试开启→关闭→再次开启，以及开启状态删除本地隐私数据，操作须在有限时间内完成。
2. A 回填中开启 B，在 A 的历史区间放入已知收款，验证 A+B 都能发现；暂停/恢复也覆盖完整 active 集合。
3. Web/direct 的扫描超过 watchdog 后成功或失败结束，应恢复下一轮；移动端代理超时仍需证明旧载体已终止。
4. 普通金额大于当前单池余额、页面余额变化、invoice/prefill、透明足额且屏蔽为零、不同输入策略下 Max 的一致性。
5. WASM 成功/错误路径均验证输入清理。

没有进行真机 UI 验证、真实转账广播或全量 Rust/跨平台构建。

## GH 评论操作

以上五项达到 review 技能的评论阈值。此次为本地实现审查，未获得向外部 PR 发消息的明确授权，因此未发送 GitHub 评论。
