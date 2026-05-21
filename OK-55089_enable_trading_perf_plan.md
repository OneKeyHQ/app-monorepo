# OK-55089 Enable Trading 时间优化计划（路径 A · 稳健版）

> Ticket: OK-55089
> Branch base: `x`
> Current branch: `codex/ok-55089-perps-enable-trading`
> 路线: 先把"免费午餐"和"后端可量化优化"吃光，再用日志数据决定是否做 UX-first 的 dialog-first 大改造。
> Scope: 软件钱包自动启用交易后，缩短从点击「做多/做空」到「确认订单」可见的等待时间。

## 0. 路线判断

- codex review 暴露了 dialog-first 改造的真实成本（牵连 hook 拆分 + `TradingGuardWrapper` 行为变更 + 五状态机），在缺数据的情况下做这个大动作是赌博。
- **先量化，再优化**：第一步是 P0-BENCH（dev toggle + 埋点，**不改任何业务逻辑**），跑出基线数据。
- 基线数据落地后，按数据排序决定 P0-A / P0-B / P1-B / P2-A 做的顺序与必要性；某项收益若实际不显著，可降级或不做。
- 删除 4s 硬等是免费午餐，必做（但顺序仍在 P0-BENCH 之后，避免改动污染基线）。
- `fetchUserAbstractionWithCache` + prewarm 是有上限但确定收益的项，列入本期，但优先级以数据决策为准。
- dialog-first 降级为"待评估项"，连同前置改造清单一并写入文档底部，等数据来了再决策。

### 性能优化提升预估

**P0-BENCH 实测已完成，详见 §3.5**。以下分两段：原始 pre-benchmark 估算（已被实测推翻部分）+ 实测结论。

#### Pre-benchmark 估算（保留作历史对照）

| 场景 | 当前推测 p50 | 优化后推测 p50 |
|---|---|---|
| 已激活账户（重复点击 enable）| 2~3s | 0.5~1s |
| 首次启用（未激活账户）| 3~5s | 2.5~4s |

#### Post-benchmark 实测（详见 §3.5）

| 场景 | 实测 p50 | P1-B + §3.6 后预估 |
|---|---|---|
| 重复点击 | 1.5s | 0.5s |
| 首次启用 · 内存密码 | 4.7s | ~3.7s |
| 首次启用 · 锁屏密码 | 12s | ~11s |

**关键校正**：

- 首次启用大头是 `approveAgent` 链上 confirm **2.6s 硬下限**，后端优化触不到。
- `P2-A prewarm` 实测 ~0 收益（mount 已天然预热），**降级为放弃**。
- `dialog-first（§7）`从"待评估"**升级为本期 / 下期必做** —— 数据显示首次启用 4.7~12s 的卡顿感知只能用 dialog-first 解决。
- 锁屏密码场景的 7~9s "输密码 + 思考时间"是独立的密码缓存策略议题，**不在 OK-55089 范围**。
- 新发现 mount 双触发问题（§3.6），本期合做。

---

## 1. 不可变的业务约束

- 仍然只有 `canTrade=true` 才能进入下单确认。
- 不跳过条款确认。
- 不跳过 builder fee 授权。
- 不跳过 agent 创建/有效性检查。
- 不跳过 rebate binding 检查（`checkInternalRebateBindingStatusWithCache()` 内部逻辑不动）。
- 硬件 / QR / external / watching 账户不进入自动预热路径。

**待业务决策项**（不在本期范围）：`setAbstractionWithUserWallet` 是否能延后/异步化。详见 §6。

---

## 2. 限流原则（任何只读预热必须满足）

| 条件 | 要求 |
|---|---|
| 钱包类型 | `enableTradingMode.isSoftwareAccount === true`（hd / imported） |
| 当前交易状态 | `perpsAccountStatus.canTrade === false` |
| 状态未知 | `canTrade === undefined / null` 时不预热 |
| 地址 | 必须有 `perpsAccountStatus.accountAddress` |
| 页面状态 | Perps 交易面板已渲染，且不在 select / enableTrading loading |
| 账户支持 | `accountNotSupport !== true` |
| 请求去重 | 同账户 single-flight，进行中 promise 必须能复用 |
| TTL | 短 TTL（30s）；已存在的更长 cache 保持现状 |
| 失败行为 | 静默 `console.debug`，不 toast，不阻塞点击 |

**触发位置**：仅在 **`TradingButtonGroup` 组件顶层**调用 hook，不放在 `SideButtonInternal`（非 spot 模式会渲染 2 个 SideButton，会导致 hook 双 mount → 重复触发 prewarm）。不放任何全局 effect、不在路由 mount 时触发。详细原因见 §3 P2-A。

---

## 3. 本期任务清单（按 commit 顺序）

### P0-BENCH · Benchmark 阶段（dev toggle + 埋点，不改业务逻辑）

**目标**：在不改任何业务路径的前提下，拿到 enable trading 各 step 的真实耗时基线，作为后续 P0-A / P0-B / P1-B / P2-A 优先级决策依据。

**范围明确不做**：

- 不改 `checkPerpsAccountStatus` 任何业务分支。
- 不删 `wait(4000)`。
- 不加 cache。
- 不做 prewarm。
- 不归一现有 `console.log('[OK-55089]...')`（保留作为 raw view 与 scene 日志互相印证）。

#### 子任务 1 · 新增 dev settings toggle `forcePerpsCanTradeFalse`

**位置**：
- `packages/kit-bg/src/states/jotai/atoms/devSettings.ts`（或现有 dev settings atom 文件，需先 grep 确认）：新增 boolean 字段 `forcePerpsCanTradeFalse`，默认 `false`。
- `packages/kit/src/views/Setting/pages/Tab/DevSettingsSection/index.tsx`：加一个 Switch UI（参考同文件现有 toggle 写法），开关该字段。

**语义**：

- 取值 `true` 时，**仅在 dev / debug 构建中生效**（`platformEnv.isDev` 或等价判断），强制 `canTrade` 派生值为 `false`。
- prod 构建中此 toggle 不读取、不存在 UI 入口，零业务路径影响。
- 用途：让 benchmark 测试人员每次点击 long/short 都重跑完整 enable 流程，否则首次 enable 后 canTrade=true 再点就跳过流程，无法稳定复现。

#### 子任务 2 · atom 短路点

**位置**：`packages/kit-bg/src/states/jotai/atoms/perps.ts`

**改动**：

- 在 `perpsActiveAccountStatusAtom` 派生 `canTrade` 的计算端（或在更上层使用 status 的 atom 中），插入：
  ```ts
  if (platformEnv.isDev && devSettings.forcePerpsCanTradeFalse) {
    return { ...status, canTrade: false };
  }
  ```
- 必须**只影响 `canTrade` 派生值**，不影响底层 `status.details.*` 真实状态（否则其他逻辑会误判）。
- 必须包在 `platformEnv.isDev` 内，确保 prod bundle 通过 dead code elimination 完全剔除。

**Review 注意**：

- 找准短路位置：是 status atom 本身还是只在 `perpsShouldShowEnableTradingButtonAtom` 派生时？前者覆盖更全（所有读 canTrade 的地方都生效），后者范围小但更安全。**推荐前者**，因为我们就是要 benchmark "走 enable 流程"的完整路径。
- 写测试：toggle=false 时所有路径与无 toggle 完全等价（无副作用）。

#### 子任务 3 · 新增 scene `enableTradingTiming` + `measureStep` helper

**位置**：
- `packages/shared/src/logger/scopes/perp/scenes/enableTradingTiming.ts`（新建）
- `packages/shared/src/logger/scopes/perp/index.ts`（注册 scene）
- `packages/kit-bg/src/services/ServiceHyperliquid/ServiceHyperliquid.ts`（加 `measureStep` 内部 helper）

**`measureStep` helper**（文件内私有，不抽公共模块）：

```ts
private async measureStep<T>(
  step: string,
  fn: () => Promise<T>,
  context?: { isEnableTradingTrigger?: boolean },
): Promise<T> {
  const start = Date.now();
  let stepResult: 'success' | 'failure' = 'success';
  try {
    return await fn();
  } catch (err) {
    stepResult = 'failure';
    throw err;
  } finally {
    defaultLogger.perp.enableTradingTiming.trackStep({
      step,
      durationMs: Date.now() - start,
      stepResult,
      isEnableTradingTrigger: context?.isEnableTradingTrigger,
    });
  }
}
```

**字段口径**（与 P0-A 共享，避免两套规则）：

- Server 上报字段（`@LogToServer`）：`step`、`durationMs`、`isEnableTradingTrigger`、`stepResult`。
- **不**上报 `accountAddress / accountId`（参照 `agentLifeCycle.trackReason` 的 `void` 写法）。
- 如需 mask 后 address 用于本地调试，仅通过 `@LogToLocal` 输出。

#### 子任务 4 · 11 个 step 埋点

在 `ServiceHyperliquid.ts` 的 `checkPerpsAccountStatus` / `enableTrading` 内用 `measureStep` 包裹：

- `enableTrading.total`
- `checkStatus.userRole`
- `checkStatus.builderFee`
- `checkStatus.rebateBinding`
- `checkStatus.extraAgents`
- `checkStatus.approveBuilderFee`
- `checkStatus.approveAgent`
- `checkStatus.agentSlotRecovery`
- `checkStatus.fetchUserAbstraction`
- `checkStatus.setAbstraction`
- `checkStatus.persistStatus`

#### 子任务 5 · 跑 benchmark 并沉淀数据

**测试矩阵**：

| # | 场景 | toggle | 期望产出 |
|---|---|---|---|
| 1 | 已激活账户，正常 enable | `forcePerpsCanTradeFalse=true` | 5 轮采样，记录 each step 耗时 |
| 2 | 未激活账户（首次启用）| 不需要 toggle（首次本就 canTrade=false）| 1~2 轮采样（首次成本高，无法反复重置）|
| 3 | 已激活账户但 abstraction 不正确 | toggle=true | 5 轮采样，观察 setAbstraction 耗时占比 |
| 4 | 3 agent slot 满（人为构造）| toggle=true | 1~2 轮采样，验证 4s wait + poll 耗时 |

**沉淀位置**：在本文档新增 §3.5 节 "Benchmark 实测数据"，记录：

- 各 step p50/p95 耗时表。
- 总耗时 p50/p95。
- 占比饼图（哪几个 step 是大头）。
- 决策结论：基于数据决定 P0-A / P0-B / P1-B / P2-A 哪些做、哪些可以不做、哪些应该重新评估。

#### Commit message

`feat(perp): add dev toggle and timing diagnostics for enable trading benchmark`

涉及文件：

- `packages/shared/src/logger/scopes/perp/scenes/enableTradingTiming.ts`（新建）
- `packages/shared/src/logger/scopes/perp/index.ts`（注册）
- `packages/kit-bg/src/services/ServiceHyperliquid/ServiceHyperliquid.ts`（埋点 + helper）
- `packages/kit-bg/src/states/jotai/atoms/devSettings.ts`（toggle 字段）
- `packages/kit-bg/src/states/jotai/atoms/perps.ts`（atom 短路）
- `packages/kit/src/views/Setting/pages/Tab/DevSettingsSection/index.tsx`（UI）

---

### P0-A · 删除 OK-55089 散落的 console.log，替换为 perp scope logger

**位置**：
- `packages/kit/src/views/Perp/hooks/useEnableTradingWithDepositFallback.ts`
- `packages/kit/src/views/Perp/components/TradingPanel/TradingButtonGroup.tsx`

**改动**：

- 全部 `console.log('[OK-55089][...]')` / `console.error('[useEnableTradingWithDepositFallback] ...')` 替换为 `defaultLogger.perp.*` scene 事件。
- 参考 `packages/shared/src/logger/scopes/perp/scenes/agentLifeCycle.ts` 的范式；新建 scene **`enableTradingFlow`**（不复用 `agentLifeCycle`，避免概念污染；命名与 P1-A 的 `enableTradingTiming` 共享 `enableTrading` 前缀，便于 devtools 一次 filter）。
- 字段策略：上报到 server 的字段**不**包含 `accountAddress / accountId`（参考 `agentLifeCycle.trackReason` 的做法，在 scene 内 `void` 掉）；
  - 如果调试需要保留 mask 后的 address，**只能通过 `@LogToLocal` 输出**，server 端字段必须丢弃。
  - 因此现有 hook 里的 `maskLogValue` 可以删除，但要明确：删除的代价是 server 看不到 address，不是"走了通用 mask"。
- Server 上报字段保留：`shouldContinue`、`canTrade`、`activatedOk`、`side`。

**风险**：无；纯日志归一。

**已知澄清**（codex review 提出）：

- `agentLifeCycle.trackReason` 当前直接 `void accountAddress; void accountId`，不是通用 mask helper。新 scene 必须明确选择"丢弃"还是"local-only mask 输出"，不能写"沿用脱敏约定"。

**Devtools filter 约定**（与 P1-A 共享）：

- 所有 OK-55089 enable trading 相关 console 输出走 logger 的统一前缀格式：`perp => enableTradingFlow => <method> :` 和 `perp => enableTradingTiming => <method> :`（见 `packages/shared/src/logger/base/logFn.ts:60`）。
- devtools / 终端按 `perp => enableTrading` filter 即可同时撩出业务流 + 耗时事件；按 `perp => enableTradingFlow` 或 `perp => enableTradingTiming` 可单独看。
- 不再使用 `[OK-55089][PerpsAutoEnableTrading]` / `[OK-55089][PerpsEnableTradingFlow]` 等私有前缀。

**Commit message**：`chore: replace OK-55089 console.log with perp scope logger`

---

### P0-B · 删除 agent slot recovery 的 4s 硬等

**位置**：`packages/kit-bg/src/services/ServiceHyperliquid/ServiceHyperliquid.ts` 的 `checkAgentStatus()`，约 line 2227 处。

**改动**：

- 删除 `removeAgent` 之后的 `await timerUtils.wait(4000)`。
- 直接进入既有轮询（max 10s / 500ms 间隔）。
- 可选小改：第一次 poll 失败再 wait 500ms，命中即出（保持轮询本身节奏不变）。

**风险**：

- 极小：轮询本身已是 removal 完成的 ground truth；4s 是凭直觉加的"等 server 同步"，但 server 没同步时轮询本来就会再试。
- 唯一影响：第一次 poll 立刻请求时如果 server 还没同步 → 多 1~2 次 poll，整体仍远低于原 `4s + poll`。

**验证**：

- 单测：在 3-agent-slot-满的 mock 上跑 enable，断言无前置等待、轮询到 removal 完成。
- 手动：找一个真实 3 个 agent 都占满的账户测一次。

**Commit message**：`perf: drop fixed 4s wait in hyperliquid agent slot recovery`

---

### P1-A · 分段耗时日志（已并入 P0-BENCH，本节保留作字段口径参考）

> **状态**：已合并到 P0-BENCH 子任务 3+4 中实现。本节保留作为 scene 字段口径与埋点定义的引用，**不再单独 commit**。

**位置**：`packages/kit-bg/src/services/ServiceHyperliquid/ServiceHyperliquid.ts`

**新增 scene**：`defaultLogger.perp.enableTradingTiming.*`。

**字段口径**（与 P0-A 严格一致，避免两套规则）：

- Server 上报字段（`@LogToServer`）：`step`、`durationMs`、`isEnableTradingTrigger`、`slowThreshold`、`stepResult`（success / failure / skipped）。
- **不**上报 `accountAddress / accountId`（参照 `agentLifeCycle.trackReason` 在 scene 内 `void` 掉的做法）。
- mask 后的 address 如调试需要，仅通过 `@LogToLocal` 输出，server 端字段必须丢弃。

**埋点阶段**：

- `enableTrading.total`
- `checkStatus.userRole`
- `checkStatus.builderFee`
- `checkStatus.rebateBinding`
- `checkStatus.extraAgents`
- `checkStatus.approveBuilderFee`
- `checkStatus.approveAgent`
- `checkStatus.agentSlotRecovery`
- `checkStatus.fetchUserAbstraction`
- `checkStatus.setAbstraction`
- `checkStatus.persistStatus`

**实现要点**：

- 用一个文件内 `measureStep(name, fn)` helper 包住 await，不抽公共模块、不引入新抽象。
- 不打印私钥、签名原文、完整地址。
- release 模式下控制量级（一次 enable 11 个事件如果都上报到 server 会噪音过大）；优先 dev-only，或者只上报 total + 慢于阈值的 step。

**为什么前置**：

- 后续 P2-A prewarm 落地后，需要这些日志验证收益。
- 未来若考虑 dialog-first，也要靠这套日志判断剩余瓶颈到底在网络还是签名。

**Commit message**：`chore: add enable trading timing diagnostics via perp scope`

---

### P1-B · `userAbstraction` raw 请求 single-flight + 不缓存 undefined

**位置**：`packages/kit-bg/src/services/ServiceHyperliquid/ServiceHyperliquid.ts`

**关键约束**（codex review 指出）：

- ❌ **不能直接包 `fetchUserAbstraction()`**。该函数在 3 种情况下会返回 `undefined`：
  - 入口 active account 与传入 address 不匹配（line 1762-1767）；
  - 异步请求后再次 alignment check 失败（多处 re-check）；
  - 请求失败 + 无本地 SimpleDb 缓存（line 1819）。
- 若直接缓存，prewarm A 账户期间切到 B → A 的 in-flight 因 alignment fail resolve 为 undefined → undefined 被写入 A 的 cache key → 30s 内切回 A 点击 enable → 误判 abstraction 缺失 → **多触发一次 `setAbstractionWithUserWallet` 签名 prompt**。

**改造方案**：拆 raw 层与 fallback 层。

#### 新增 raw cache（只缓存成功的 net 请求结果）

```ts
fetchUserAbstractionRawWithCache = cacheUtils.memoizee(
  async ({ accountAddress }: { accountAddress: IHex }): Promise<string> => {
    const { infoClient } = hyperLiquidApiClients;
    const lowerAddress = accountAddress.toLowerCase() as IHex;
    const mode = await infoClient.userAbstraction({ user: lowerAddress });
    // 若 mode 为 falsy（API 可能返回空串/null），抛错防止 memoizee 缓存
    if (!mode) {
      throw new Error('userAbstraction empty result, skip cache');
    }
    return mode;
  },
  {
    max: 20,
    maxAge: timerUtils.getTimeDurationMs({ second: 30 }),
    promise: true,
    // 必须显式 normalizer：cacheUtils.memoizee 默认 normalizer 是
    // fast-json-stable-stringify(args)，对 args 直接序列化，
    // 0xABC 和 0xabc 会落到不同 cache key。函数体里 toLowerCase 改变不了
    // memoizee 的 key，invalidate 时 .delete({ accountAddress }) 也命中不到。
    normalizer: ([{ accountAddress }]) => accountAddress.toLowerCase(),
  },
);
```

`memoizee` 在 `promise: true` 模式下，promise reject 时**不会缓存**，因此空值/错误都不会污染。

#### `fetchUserAbstraction()` 内部改造

仍保留 alignment check + SimpleDb fallback，只把 `infoClient.userAbstraction` 改为 `fetchUserAbstractionRawWithCache`：

- 入口 alignment check 不变。
- 原 `infoClient.userAbstraction(...)` → `this.fetchUserAbstractionRawWithCache({ accountAddress: userAddress })`。
- 后续 re-check alignment / 写 atom / 写 SimpleDb 逻辑不变。
- error 分支的 SimpleDb fallback 不变。

#### `checkPerpsAccountStatus` 内调用点

- 早期 fire-and-forget（line 1899）→ 保持调 `fetchUserAbstraction`，但因为 raw 层已 cache，重复调用不重发 net。
- agent 拿到后的 mode 读取（line 1954）→ 同上。
- `setAbstractionWithUserWallet` 成功后（line 1967 附近）→ **必须 invalidate raw cache 的该 key**（`fetchUserAbstractionRawWithCache.delete({ accountAddress: accountAddress.toLowerCase() as IHex })`，依赖示例中显式的 lowercase normalizer），再走一次拿新值。

#### 账户切换处理

- 找 `perpsActiveAccountAtom` 变更的 subscriber/effect 接入点，账户切换时调用 `fetchUserAbstractionRawWithCache.clear()`。
- raw cache 不存任何 undefined，因此即使 in-flight 在切换中 resolve 为 reject（被 alignment guard 拦截后抛错），也不污染 cache。

#### Review 注意

- cache key 通过示例中的 **`normalizer: ([{ accountAddress }]) => accountAddress.toLowerCase()`** 强制 lowercase；不要依赖函数体内 toLowerCase（那只影响 net 请求 payload，不影响 memoizee key）。
- `.delete(...)` 必须传与 normalizer 同样格式的 args，否则命不中。建议封装一个 `invalidateAbstractionCache(addr)` 私有 helper，集中处理 toLowerCase。
- `fetchUserAbstraction` 内已有 alignment check，cache 在 **raw 层**意味着 alignment check 在 cache **之外**仍然每次跑，这是有意为之 — 安全性优先。
- raw 抛错的 try/catch 不能吞掉真错误：业务调用方仍要处理 net error 走 SimpleDb fallback。

#### 验证

- 单测：同账户连续 3 次调用，net 请求只发 1 次。
- 单测：raw 请求返回 empty string / null → 不缓存，下次调用重发。
- 单测：`fetchUserAbstraction` 因 alignment fail 返回 undefined → raw cache 内**无** undefined（因为 raw 不感知 alignment）。
- 单测：`setAbstractionWithUserWallet` 后再 fetch 不命中旧 cache（验证 invalidate）。
- 单测：accountAddress 大小写不同命中同一 cache key。
- 单测：账户切换后 raw cache 被清理。
- 单测：prewarm A → 切到 B → 切回 A 点击 enable，不会多触发 `setAbstractionWithUserWallet`。

**Commit message**：`perf: cache hyperliquid userAbstraction raw request safely`

---

### P2-A · 软件钱包 prewarm（按 §2 限流原则）

**新增 background method**：`ServiceHyperliquid.prewarmEnableTradingReadiness()`

逻辑：

1. 读 active account；非 hd / imported 直接 return。
2. 读 loading info；`selectAccountLoading` / `enableTradingLoading` 任一为 true → return。
3. 读 status；`accountNotSupport === true` → return；`canTrade !== false` → return。
4. 进入 cache-backed 内部方法 `prewarmEnableTradingReadinessWithCache({ accountAddress, accountId })`：
   - `Promise.allSettled` 触发（共 4 项，**不含 userRole**，见 P2-B 决策）：
     - `getUserApprovedMaxBuilderFeeWithCache`（依赖 `getBuilderFeeConfig().expectBuilderAddress` 有值）
     - `checkInternalRebateBindingStatusWithCache`
     - `fetchExtraAgentsWithCache`
     - `fetchUserAbstractionRawWithCache`（来自 P1-B）
   - 全部 `{ promise: true }`，确保点击瞬间复用 in-flight。
5. **绝不**签名、写状态、调用 approve/set 类方法、改变 `canTrade`。

**新增 UI hook**：`packages/kit/src/views/Perp/hooks/usePrewarmEnableTradingReadiness.ts`

```ts
const shouldPrewarm =
  enableTradingMode.isSoftwareAccount &&
  perpsAccountStatus.canTrade === false &&
  !!perpsAccountStatus.accountAddress &&
  !perpsAccountStatus.accountNotSupport &&
  !perpsAccountLoading.selectAccountLoading &&
  !perpsAccountLoading.enableTradingLoading;
```

**触发策略**（与 codex 原方案不同）：

- ❌ codex 原方案的 600~1000ms `setTimeout` 防抖：对"打开就点"的快用户无效。
- ✅ **`shouldPrewarm` 翻 true 立即触发**，由 `{ promise: true }` cache + 30s TTL 兜底，避免重复请求。
- 依赖变化时清理；最坏情况是请求继续跑，但 UI 不消费结果。

**接入位置**：**`TradingButtonGroup` 组件顶层**调用 hook，不是 `SideButtonInternal`（codex review 指出）。

- 原因：非 spot 模式下 `TradingButtonGroup` 会渲染 **2 个 `SideButton`**（long + short，见 `TradingButtonGroup.tsx:893-915`）。若把 hook 放在 `SideButtonInternal`，两个按钮各 mount 一次 hook → 两次 background ipc 往返，依赖底层 single-flight 兜底。
- 把 hook 上移到 `TradingButtonGroup` 顶层，long/short 共用同一个 hook 实例，从源头保证只 fire 一次。
- 单测必须覆盖：long + short 同时 mount → 只产生一组 network prewarm（即使内部 single-flight 失效也不会泄漏）。

**关键 Review 注意**：

- `accountUtils.isHdAccount({ accountId })` 不接受 `indexedAccountId`。**必须复用 `perpsActiveAccountEnableTradingModeAtom` 同款 isSoftwareAccount 判断**，否则前端 UI 判定 isSoftware=true 但 background 判定 false，预热静默失败。建议：把判断函数从 atom 里抽 helper 给 service 复用。
- `getBuilderFeeConfig()` 会静默触发 `/utility/v1/perp-config`，但有 10 分钟 cache；spot check 不会绕过缓存。
- `Promise.allSettled` 最多并发 4 个 GET（已删除 userRole，见 P2-B 决策）；确认 HL info endpoint 限流可承受。
- prewarm 触发时刻：`shouldPrewarm` 翻 true 立即 fire，不加 setTimeout 防抖。

**验证**：见 §4 测试矩阵。

**Commit message**：`perf: prewarm software wallet enable trading readiness`

---

### P2-B · `userRole` 不做 TTL cache（决策：删除）

**codex review 关键发现**：

- 当前代码（ServiceHyperliquid.ts:1864, 1894）只缓存 `activatedUser[address] = true` 这一**正结果**；
- 未激活账户的 `userRole` 结果（`role === 'missing'`）**故意不缓存**，因为该状态随时可能因 deposit 完成而翻转；
- 我前一版 plan 写的 `fetchUserRoleWithCache` 会把 missing 也缓存 30s → **用户 deposit 完成后 30s 内仍被判未激活 → 错误弹 deposit modal**，体验回退。

**决策**：

- ❌ **不引入 `fetchUserRoleWithCache`**。
- 现有 `hyperLiquidCache.activatedUser` 已经是正确的 single-flight + 正结果缓存策略，无需重复造轮子。
- prewarm 路径里**也不**主动调用 `userRole`。理由：
  - 已激活账户：`activatedUser[address] === true` 短路，本来就不发 userRole 请求 → prewarm 无收益。
  - 未激活账户：prewarm 调 userRole 拿 missing 结果也没意义（不能 cache，也不影响 enable 路径的实时查询）。
- 如果未来想做 single-flight（防止同 tick 多次发 userRole），可以单独 PR 实现一个不 TTL 的 in-flight dedupe，但本期不做。

**Action**：

- 从 P2-A 的 `prewarmEnableTradingReadinessWithCache` task 列表中**移除** `fetchUserRoleWithCache` 调用。
- P2-A commit 不再涉及 userRole 改造。
- 文档备注：该决策来自 codex review，避免未来再次被提议。

---

## 3.5 Benchmark 实测数据（2026-05-21 / 2026-05-22 采样）

P0-BENCH 落地后用 dev toggle + reset 按钮跑出的真实数据，覆盖 3 个场景。

### 3.5.1 三场景 total p50 / p95

| 场景 | 样本数 | total p50 | total p95 | 大头 baseline |
|---|---|---|---|---|
| **重复点击（无签名）** | 4 | **1.5s** | 5.9s | abstraction × 2 (~1s) |
| **首次启用 · 内存有密码** | 3 | **4.7s** | 4.75s | approveAgent 2.6s + abstraction 0.8s + 只读链 0.7s |
| **首次启用 · 锁屏需输密码** | 2 | **12s** | 13.2s | approveAgent 9.5~12s（含 ~9s 输密码 + 思考） |

### 3.5.2 逐 step baseline（合并 3 场景）

| Step | 重复点击 | 内存密码首次 | 锁屏密码首次 | 备注 |
|---|---|---|---|---|
| `userRole` | 0 (cache hit) | 270~370ms | 0 (cache hit) | `hyperLiquidCache.activatedUser` 短路 |
| `rebateBinding` | 0~7ms | 0~7ms | 0 (cache hit) | 现有 cache 起效 |
| `builderFee` | 0~1ms | 272~329ms | 0 (cache hit) | 10min cache |
| `extraAgents` | 0ms | 302~385ms | 0 (cache hit) | 2min cache |
| `fetchUserAbstraction` #1 | 316~5838ms | 273~1532ms | 1089~1532ms | **每轮固定 2 次** |
| `fetchUserAbstraction` #2 | 423~5801ms | 277~513ms | 281~293ms | P1-B 可砍 |
| **`approveAgent`** | 不触发 | **2406~2655ms** | **9479~11949ms** | 内存密码 baseline 收敛在 2.4~2.7s |
| `setAbstraction` | 不触发 | 不触发 | 不触发 | 当前账户 abstraction 已 UNIFIED |
| `approveBuilderFee` | 不触发 | 不触发 | 不触发 | 当前账户 builderFee 已 approve |
| `agentSlotRecovery` | 不触发 | 不触发 | 不触发 | agent slot 未满 3 个 |
| `persistStatus` | 0~1ms | 0ms | 0ms | atom 写入，无开销 |

### 3.5.3 关键发现

1. **approveAgent 内存密码 baseline ≈ 2.6s**（3 样本一致：2406 / 2563 / 2655ms）—— **HL 链上 approve 的硬下限，任何后端优化都触不到**。
2. **锁屏 vs 内存密码：approveAgent +7~9s 全是 UI 体验成本**（密码弹窗 + 用户输入 + 思考），属于密码缓存策略议题，不在 OK-55089 范围。
3. **`fetchUserAbstraction` 每轮固定 2 次** —— P1-B 一轮去重收益已被 3 场景完全验证。
4. **页面 mount check 链全部 × 2** —— 独立问题，详见 §3.6。
5. **`P2-A` prewarm 在所有场景几乎 0 收益** —— 因为页面 mount 期间已经天然预热所有只读 cache（userRole / builderFee / extraAgents / abstraction）。只有 cache TTL 过期且用户停留 > TTL 才有意义，**降级为放弃**。
6. **`P0-B` 删 4s 硬等当前账户 0 收益**（agent slot 未满），但对长尾 slot-full 用户仍 -4s。顺手做。

### 3.5.4 优化潜力重排（实测驱动）

| 方案 | 重复点击 (1.5s) | 内存密码 (4.7s) | 锁屏密码 (12s) | 决策 |
|---|---|---|---|---|
| **dialog-first（§7）** | 中 | 大 | **巨大**（按钮卡 12s → dialog 内 spinner） | **升级 P0，本期/下期必做** |
| **P1-B** abstraction 一轮去重 | **-1s (-67%)** | -500ms (-10%) | -300ms (-2%) | **本期 P0** |
| **P0-B** 删 4s 硬等 | 0 | 0 | 0 | 顺手做（长尾用户 -4s） |
| **P0-A** 日志归一 | 0 | 0 | 0 | 后置（纯工程）|
| **§3.6 Mount 双触发修复** | mount 阶段 -50% (~2~3s) | mount 阶段 -50% | mount 阶段 -50% | **本期合做**，不单独 ticket |
| **P2-A** prewarm | ~0 | 0 | 0 | **放弃** |
| **P2-B** userRole cache | 0 | 0 | 0 | 放弃（决策保持）|
| 密码缓存策略 | 0 | 0 | **-9s** | **独立议题**，不在 OK-55089 |

### 3.5.5 软件钱包 enable trading 体验绝对下限

实测推出的"理论最快体验"：

| 场景 | 当前 p50 | P1-B + 3.6 全做完 | dialog-first 后用户感知 |
|---|---|---|---|
| 重复点击 | 1.5s | 0.5s | 立即（dialog 出现）|
| 内存密码首次 | 4.7s | ~3.7s | 立即弹 dialog + 内部 spinner 2.6~3.7s |
| 锁屏密码首次 | 12s | ~11s | 立即弹 dialog + 内部 spinner（含输密码体验）|

**结论**：后端优化的天花板是 ~1s（重复场景）/ ~1s（首次场景）；dialog-first 才能解决"卡顿感知"的核心痛点。

---

## 3.6 PerpsGlobalEffects 双触发（本期合做，方案 B）

### 3.6.1 现象

进入 Perps 详情页时，`checkPerpsAccountStatus` 被调用 2 次 —— `userRole / rebateBinding / builderFee / extraAgents / fetchUserAbstraction / persistStatus` 每个 step 都跑 2 份（见 §3.5 日志样本）。

### 3.6.2 根因

`packages/kit/src/views/Perp/components/PerpsGlobalEffects.tsx` 内 `useHyperliquidGlobalActiveAccount` hook：

- line 373-376：`checkPerpsAccountStatus` callback
- line 408-430：`selectPerpsAccount` callback，内部串行调 `changeActivePerpsAccount` + `checkPerpsAccountStatus`
- line 445-451：`useEffect([selectPerpsAccount])` 触发 selectPerpsAccount

`selectPerpsAccount` 的依赖数组有 **6 个 unstable 引用**：
- `actions`
- `activeAccount.account?.address`
- `activeAccount.account?.id`
- `activeAccount?.wallet?.id`
- `activeAccount?.indexedAccount?.id`
- `checkPerpsAccountStatus`
- `globalDeriveType`（异步 resolve）
- `activeAccountRefreshHook`

mount 时的真实执行序：

```
mount
  ├─ selectPerpsAccount v1（globalDeriveType=undefined）→ early return
  ├─ globalDeriveType resolve → selectPerpsAccount v2 → 跑 check ①
  └─ activeAccount.address resolve → selectPerpsAccount v3 → 跑 check ②
```

`selectPerpsAccount` 内部**无任何去重**，每次依赖变化都老老实实重跑 `changeActivePerpsAccount` + `checkPerpsAccountStatus`。

### 3.6.3 修复方案（B：语义去重）

在 `useHyperliquidGlobalActiveAccount` 内新增 ref 记录"上次成功跑完 selectPerpsAccount 时的实际语义参数"：

```ts
const lastSelectParamsRef = useRef<string | null>(null);

const selectPerpsAccount = useCallback(async () => {
  if (!globalDeriveType) {
    return;
  }
  const params = JSON.stringify({
    indexedAccountId: activeAccount?.indexedAccount?.id || null,
    accountId: activeAccount?.account?.id || null,
    walletId: activeAccount?.wallet?.id || null,
    deriveType: globalDeriveType,
  });
  if (lastSelectParamsRef.current === params) {
    return;
  }
  lastSelectParamsRef.current = params;

  noop(activeAccountRefreshHook);
  noop(activeAccount.account?.address);
  await actions.current.changeActivePerpsAccount({ ... });
  await checkPerpsAccountStatus();
}, [...同原 deps]);
```

**Review 注意**：

- 必须用 JSON.stringify 标准化所有参数，避免 ref 比较失误。
- `activeAccountRefreshHook` 变化仍要触发（用户手动刷新场景）—— 把它单独加入 params 字符串。
- 账户切换路径必须验证：`indexedAccountId / accountId / walletId / deriveType` 任一变化都要触发新 check。
- 解锁后的 `useHyperliquidScreenLockHandler` 独立调 `checkPerpsAccountStatus`，不走 `selectPerpsAccount`，不受此修改影响。

### 3.6.4 收益预估

- mount 阶段 net cost 砍 50%
- 实测 3 场景 mount 阶段总和约 4~7s，去重后省 2~3s
- 重复点击场景 / enable trading 主流程不受影响（不动 `checkPerpsAccountStatus` 内部）

### 3.6.5 测试矩阵

| 场景 | 期望 |
|---|---|
| 初次进入 perp 页 | 只触发 1 次 check |
| 切换账户（hd → imported） | 触发 1 次 check |
| 切换链上 deriveType | 触发 1 次 check |
| 手动 refresh hook 触发 | 触发 1 次 check（如果纳入 params 字符串）|
| 离开 perp 页再回来 | 不再触发（语义参数无变化）|
| 解锁后 | `useHyperliquidScreenLockHandler` 路径仍然触发 1 次 check |

### 3.6.6 提交

合入 P1-B commit 同一个 PR（语义相关 — 都是"减少 perp check 的重复调用"），但拆成两个独立 commit：

- `perf(perp): dedupe selectPerpsAccount calls in PerpsGlobalEffects`（§3.6）
- `perf: cache hyperliquid userAbstraction raw request safely`（P1-B）

---

## 4. 测试矩阵

### 4.1 单元测试

| 用例 | 期望 |
|---|---|
| `removeAgent` 路径无 4s 前置等待 | 直接进入轮询并能成功完成 |
| `fetchUserAbstractionRawWithCache` 同账户连续 3 次调用 | 仅 1 次 net request |
| raw 请求返回 empty / null | 不缓存，下次调用重发 |
| `fetchUserAbstraction` alignment fail 返回 undefined | raw cache 内无 undefined（因 raw 不感知 alignment）|
| `setAbstractionWithUserWallet` 后再 fetch | raw cache 已 invalidate，重新发请求 |
| accountAddress 大小写不同 | 命中同一 cache key |
| 账户切换后 | raw cache 被清理 |
| prewarm A → 切到 B → 切回 A 点击 enable | **不会**多触发 `setAbstractionWithUserWallet` |
| `prewarmEnableTradingReadiness` 7 条限流条件 | 任一不满足时 return，不触发请求 |
| `prewarmEnableTradingReadiness` 连续两次同账户 | 仅 1 个 in-flight |
| **long + short 同时 mount**（非 spot 模式） | 只产生一组 prewarm 调用 |
| `enableTradingMode.isSoftwareAccount` 判定一致性 | UI hook 与 background prewarm 同结果 |
| deposit 完成后立即点 enable | 不被旧 userRole=missing 误判（验证 P2-B 决策）|

### 4.2 手动验证矩阵

| 场景 | 预期 |
|---|---|
| hd/imported，`canTrade=true` | 不触发 prewarm，点击直接弹确认订单（原行为）|
| hd/imported，`canTrade=false`，停留 1s 后点击 | prewarm 已完成，点击后少发重复只读请求 |
| hd/imported，刚进入页面立刻点击 | enable 与 prewarm 复用 in-flight |
| hd/imported，3 agent slot 满 | 触发 removeAgent + 直接 poll，无 4s 空等 |
| hd/imported，abstraction 不正确 | 仍触发第二次签名（业务约束未变）|
| 快速切账户 | 旧账户 prewarm 不污染新账户 status |
| hw/qr/external | 不触发 prewarm，保持原 Enable Trading 卡片 |
| watching | 不触发 prewarm，不可交易 |
| Hyperliquid read-only 失败 | 无 toast；点击 enable 时走原错误处理 |

### 4.3 Network 验证

- prewarm 仅在 `canTrade=false` 软件钱包发生。
- `canTrade=true` 用户不出现额外 `userRole / maxBuilderFee / extraAgents / userAbstraction` 请求。
- 一次 enable 内 `userAbstraction` 不重复请求。
- 全局进入 Perps 页面**没有**批量 HL 只读请求。

### 4.4 量化指标（依赖 P1-A 日志）

P0-A + P1-B + P2-A 落地前后对比：

| 指标 | 优化前基线 | 优化后期望 |
|---|---|---|
| `enableTrading.total` p50 | 待测 | 下降 1~2s（cache + prewarm 命中）|
| `enableTrading.total` p95 | 待测（含 agent slot 满）| 下降 4~6s（主要来自 P0-A）|
| `checkStatus.fetchUserAbstraction` 一次 enable 调用次数 | 2~3 | 1 |
| `checkStatus.agentSlotRecovery` 触发时耗时 | 4s + poll | poll only |
| 一次 enable 总 net request 数 p50 | 待测 | 下降 1~2 |

**这套基线数据是后续决定是否做 dialog-first 的依据**。

---

## 5. Review 自查清单

落地前自审，落地后请第三方过：

1. 非软件钱包是否可能进入 prewarm？
2. `canTrade=true / undefined / null` 是否被预热？
3. `{ promise: true }` cache 是否真能复用 in-flight（用单测验证，不靠看代码）？
4. `setAbstractionWithUserWallet` 后 raw abstraction cache 是否失效？
5. 账户切换是否清理所有账户绑定的 cache？
6. **abstraction raw cache 是否绝不缓存 undefined / empty / error**？（codex review 关键检查项）
7. **是否引入了 `fetchUserRoleWithCache` 等会缓存负结果的 cache**？（必须为否）
8. **prewarm hook 是否放在 `TradingButtonGroup` 顶层而不是 `SideButtonInternal`**？（必须为是）
9. **所有新增 `cacheUtils.memoizee` 是否显式声明 `normalizer`（统一 lowercase）**？默认 normalizer 是 `fast-json-stable-stringify(args)`，大小写敏感；不显式声明会让 `0xABC` 与 `0xabc` 落到不同 key，`.delete()` 也命不中。
10. 是否引入任何新 toast / 全局 effect / 全局预热？
11. 是否记录敏感信息（私钥/签名原文/完整地址）？
12. `enableTradingMode.isSoftwareAccount` 在 UI 和 background 的判定一致？
13. 4s 删除后，3-agent-slot-满 场景下 enable 仍能成功？
14. 日志埋点 release 模式下量级可控？
15. **新 scene（含 P0-A `enableTradingFlow` 和 P1-A `enableTradingTiming`）的 `accountAddress / accountId` 字段是否被 server 上报丢弃**（参照 `agentLifeCycle.trackReason`）？两套 scene 字段口径必须一致。
16. **两个新 scene 是否共享 `enableTrading` 前缀**（devtools 可一次 filter `perp => enableTrading` 撩出全部）？scene 名不应再带 `OK-55089` 或 `Auto` 等冗余词。

---

## 6. 待业务决策项（不在本期范围）

### `setAbstractionWithUserWallet` 是否能延后/异步化？

**当前行为**：自动 enable 路径下，若 abstraction 不正确，串行触发**第二次用户签名**（在 approveAgent 签名之后）。

**三个候选方案**：

1. **保持现状**：体验差 1 次额外签名 prompt，但保证下单时 abstraction 已是 unifiedAccount / portfolioMargin。
2. **延后到下单后**：自动 enable 不强制切 abstraction；用户首次下单 success 后用一个 background banner 提示"建议升级账户为 unified"。
3. **首次显式预告**：在条款 dialog 同一步说明"将请求 2 次签名"，用户预期降低，体验观感改善但实际耗时不变。

**Action**：

- 本期实现按方案 1（不变）。
- 单独开 ticket 和产品/HL 业务方对齐再决定。
- P1-A 日志数据落地后，可量化 `setAbstraction` 在 total 里的占比，作为讨论输入。

---

## 7. 待评估项：dialog-first UX 改造（本期不做，等数据决策）

### 7.1 为什么放后面

- codex review 已证明：dialog-first 在当前代码结构下牵连 hook 拆分 + `TradingGuardWrapper` 行为变更 + 五状态机（terms / deposit / close / account switch / guard），不是单点改动。
- 当前没有数据证明剩余瓶颈在感知层而不是网络/签名层。
- 等 P0-A + P1-A + P1-B + P2-A 落地后用 §4.4 的量化指标判断：
  - 如果 `enableTrading.total` p50 已降到 < 1s → 感知问题大概率已缓解，dialog-first 不做。
  - 如果 p50 仍 > 2s 且主要来自签名 prompt → dialog-first 仍有必要，按 §7.2 启动。

### 7.2 前置改造清单（如果决定做 dialog-first）

#### 7.2.1 拆 `useEnableTradingWithDepositFallback`

当前 hook 把 terms / enable / deposit 三件事拼在一起，且 deposit modal 是 hook 内部副作用，调用方拦不住。

拆成 3 个职责单一的 hook：

- `useConfirmHyperliquidTerms(): () => Promise<boolean>` — 只弹条款，return 是否接受。
- `useRequestEnableTrading(): () => Promise<EnableTradingResult>` — 只调 `serviceHyperliquid.enableTrading()`，return status，**不弹任何 modal**。
- `useHandleEnableTradingPostStatus(): (status) => Promise<void>` — 接 status 决定要不要弹 deposit；由调用方触发，可被 cancel。

`TradingGuardWrapper` 和 `PerpTradingButton` 现有调用方需要同步改造为"组合调用"模式。

#### 7.2.2 改 `TradingGuardWrapper` 行为

当前 `TradingGuardWrapper` 在 `isAgentReady === false` 时强制渲染 Enable Trading 按钮替代 children。dialog-first 需要它支持"pending 期间显示 disabled confirm + spinner"。

候选实现：

- 新增 `bypassGuard` prop：传入时跳过 `shouldShowEnableTrading` 判定。
- 新增 `prepareTradingPromise` prop：pending 时显示 disabled + spinner，resolve 后按 status 决定渲染 children 或 enable 按钮。
- 二选一，建议后者（语义更清晰）。

#### 7.2.3 handlePress 新流程

```
1. 跑前置校验（trigger / TP/SL / 价格 / margin）
2. await useConfirmHyperliquidTerms() — 未接受 return
3. 立即弹 OrderConfirmDialog，注入:
   - prepareTradingPromise = useRequestEnableTrading()
   - bypassGuard 或同等机制
4. dialog 消费 promise:
   - status.canTrade === true → enable Confirm 按钮
   - status.activatedOk === false → 关 dialog，调用方触发 deposit modal
   - 其他失败 → 关 dialog
5. dialog 关闭 / 账户切换 → 设置 cancel 标志
   promise resolve 时检查 cancel：
   - 若已 cancel：不触发 deposit、不更新 UI
   - 已发出的签名 prompt 不可撤销，但后续副作用必须停
```

#### 7.2.4 五状态机的状态矩阵

| terms | enable | deposit needed | dialog open | account switched | 期望行为 |
|---|---|---|---|---|---|
| accepted | pending | - | yes | no | dialog 显示 spinner |
| accepted | success canTrade | - | yes | no | enable Confirm |
| accepted | success !canTrade !deposit | - | yes | no | 关 dialog |
| accepted | success activatedOk=false | - | yes | no | 关 dialog → 弹 deposit |
| accepted | success activatedOk=false | - | no（用户已关）| no | 不弹 deposit |
| accepted | success activatedOk=false | - | yes | yes | 不弹 deposit，不污染新账户 |
| accepted | failure | - | yes | no | 关 dialog，原错误处理 |
| rejected terms | - | - | - | - | 不进入 dialog |
| accepted | pending | - | yes | yes | 取消 promise 结果消费 |

#### 7.2.5 skipOrderConfirm=true 路径处理

`perpsCustomSettings.skipOrderConfirm === true` 时：

- 沿用原 await enable 路径，不走 dialog-first。
- 用户既然选了"跳过确认"，就接受沉默等待。
- 未来若考虑改进，单独设计 loading toast + 自动下单。

#### 7.2.6 Review 必查

- dialog 关闭后是否还会弹 deposit modal？
- 账户切换后旧 promise 是否被 cancel？
- pending 期间用户多次点击同一按钮是否触发多个 promise？
- `TradingGuardWrapper` 改动是否影响其他调用方（grep `<TradingGuardWrapper`）？
- terms 接受状态在 hook 拆分后仍持久化到 simpleDb？

---

## 8. 不在本次范围

- dialog-first UX 改造（见 §7，待数据决策）。
- abstraction 二次签名延后/异步化（见 §6，待业务决策）。
- 按钮 / Toast "准备账户中..." 文案（业务决定不做）。
- 硬件钱包的 enable trading 流程优化。
- `skipOrderConfirm=true` 路径的 loading 提示。

---

## 9. 提交拆分总览

基于 §3.5 实测数据重排后的 commit 顺序：

| # | Commit message | 内容 | P 级 |
|---|---|---|---|
| 1 | `feat(perp): add dev toggle and timing diagnostics for enable trading benchmark` | dev toggle `forcePerpsCanTradeFalse` + reset 按钮 + 新 scene `enableTradingTiming` + `measureStep` + 11 个 step 埋点 + enableTrading 返回时 dev 模式还原 canTrade；**不改任何业务路径** | P0-BENCH ✅ 已完成 |
| 2 | `perf(perp): dedupe selectPerpsAccount calls in PerpsGlobalEffects` | §3.6 mount 双触发修复（方案 B：语义参数去重） | P0 |
| 3 | `perf: cache hyperliquid userAbstraction raw request safely` | raw 层 cache + invalidate，不缓存 undefined（P1-B） | P0 |
| 4 | `perf: drop fixed 4s wait in hyperliquid agent slot recovery` | 删 wait(4000)（P0-B） | P1 |
| 5 | `chore: replace OK-55089 console.log with perp scope logger` | hook + button 日志归一，新 scene `enableTradingFlow`（与 P0-BENCH `enableTradingTiming` 共享前缀） | P2 |
| 6 | **dialog-first 改造** | 见 §7（需先完成 §7.2.1 hook 拆分 + §7.2.2 TradingGuardWrapper 改造 + §7.2.4 五状态机） | **P0**（本期 / 下期必做，详细设计见 §7） |

**已不做**：

- ~~P2-A prewarm~~ — 实测 ~0 收益，**降级为放弃**（详见 §3.5）
- ~~P2-B userRole cache~~ — 决策保持不做（避免缓存负结果）

**Commit 顺序逻辑**：

1. P0-BENCH（已完成）—— 拿到实测数据基础
2. §3.6 + P1-B + P0-B —— 后端 perf 三件套，互不依赖可并行 review
3. P0-A 日志归一 —— 纯工程清理，放最后
4. dialog-first —— 体验改造重头戏，按 §7 详细计划独立 PR 推进
