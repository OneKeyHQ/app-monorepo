# DeFi Tab 工程化 Review 报告

## 运行拓扑

Desktop/Web 是单 JS runtime；iOS/Android/extension 是 main/background 两个隔离 JS heap，`ServiceDeFi` 在 background，通过 AppEventBus bridge 向前台发 `DeFiPositionRefreshed`。位置结果在 bg 处理，传到 main 时是序列化后的另一个 JS 对象副本，不能假定两个 runtime 共享 repository/Promise/abort controller。SimpleDB 底层 native storage 可以共享，但 JS 缓存对象不共享，main/bg 初始化独立。Portfolio header 的 `DeFiListBlock` 与真正 DeFi tab 各自拥有独立 `ProviderJotaiContextDeFiList`，列表 protocols/state 不共享，只共享部分全局 overview atom。

## 当前数据链路

### 单链

`DeFiListBlock` 的 `usePromiseResult` 负责 enabled-network 查询、abort 前台请求、SimpleDB cache key 判定、`fetchAccountDeFiPositions(saveToLocal:true)`、协议/overview/state 写入和 polling。另一个 `initDeFiData` effect 独立 hydrate SimpleDB，Portfolio cache-only 实例又有一套 header 读缓存逻辑。结果是 cache hydrate、网络 fetch、polling、事件刷新四条并行写入路径。

### All Networks

先等待 token refresh，再进入 `useAllNetworkRequests`：15 秒 accounts cache、DeFi enabled map、cache probe、跨网络 fan-out，DeFi 自己用 `deFiDataRef` 与 1 秒 throttle 做冷路径合并，最后又由 `allNetworksResult` effect 全量替换。冷缓存和暖缓存的发布语义不一致，settled 与 authoritative result 也不是同一个提交事务。`TokenListBlock` 调用该 hook 时传 `onRequestSettled`/`onResultPublished` 并开启 `clearRetainedResultOnAcceptedRun`（`TokenListBlock.tsx:1968-1980`）；baseline 的 DeFiListBlock 调用（`DeFiListBlock.tsx:948-976`）没有传 `onRequestSettled`、`onResultPublished` 或 retained-result 选项。临时诊断期间加入的 `onResultPublished` 仅用于 telemetry，不能算生产提交门。

iOS 旧观察把这个风险落到了可观测 UI 时序：15 个 DeFi-enabled fan-out 请求均成功，其中 5 个返回协议（合计 13 个），但协议卡保持空态；临时日志的 fresh active run 则记录 `onFinished → result-resolved(15) → result-published(15) → consumer(hasResult=true, 15)`。源码和单测进一步确认，fan-out 期间 queued rerun 会让 `resolveAllNetworkPublishedResult` 在 DeFi baseline 缺少 retained-result 选项时返回 `undefined`，即使当前 fan-out 成功；当 `allNetworkDataInit=true` 时 warm path 又跳过 `deFiDataRef` 累加，结果只能依赖 `allNetworksResult` effect 发布。该 effect 未提交时，UI 保持清空后的空态。切回单链会走另一条单链提交路径并立即恢复。

`onFinished` 的时序结论只适用于 accepted fan-out。stale-owner、disabled、已有请求、缺少 owner 或非 All Networks 的 early return 在 `try/finally` 前直接返回 `undefined`，不会发出 settled 回调；但 `usePromiseResult` 仍可能接收并写入这个 `undefined`。因此 telemetry 必须记录 skip reason，不能只用“缺少 onFinished”判断结果丢失。

### 交易事件

Action success、`LocalPendingTxConfirmed`、History classified completion 都能触发同一个 ServiceDeFi immediate force refresh；其中 `DeFiListBlock` 的 action-success 还先通过 `AccountDataUpdate` 触发 tab polling/fan-out，再直接调用 force refresh。40/80 秒 timer 已按 account/network 合并并重置，但 immediate 请求尚未去重。`DeFiPositionRefreshed` payload 没有 owner generation/fetchedAt；tab polling、All Network fan-out 和事件回写可能乱序。

## 主要工程问题

1. **所有权没有成为提交契约。** 单链 fetch 的 finally 直接 settled；All Network callbacks 接收 hook 的数据但不校验 generation。账号/网络切换时旧响应仍可能写当前 atom。
2. **空态是状态推导副作用。** `protocols=[]` 是清理、未完成、真空三种含义，但 EmptyDeFi 只用长度和 loading flag 推断，造成 63710 窗口。
3. **缓存 owner 不完整。** ServiceDeFi `_localDeFiOverviewCache` 只按 networkId，3 秒 debounce flush 使用最后一次 account address/xpub；注释已承认 foreground/background 并发会覆盖。单网 cache hydrate 后续 overview 写入也缺少完整 seq guard。
4. **取消不完整。** 单链通过 `abortFetchAccountDeFiPositions` 清理 controller；All Network 配置没有把 `abortAllNetworkRequests` 传入，旧 fan-out 可继续跑。controller 数组只在全量 abort 时清空，正常 settle 不移除。
5. **读模型分散。** Portfolio header 是 cache-only 路径，不会发 positions live 请求；DeFi tab 与 Desktop WebAccountPanel 分别拥有 live fan-out，WebAccountPanel 当前是 EVM-only 且 `abortable:false` 的 best-effort 查询。它们不能共享 in-flight promise、TTL 或一次 materialized result，存在同 owner 重复读取的条件，但不能把 header cache read 也算成重复 HTTP 请求。
6. **事件契约含糊。** generic action 已把 pending/undefined 过滤在 `onSuccess` 之外；Borrow helper 的 `handleBorrowSuccess` 却因 `waitForFinalStatus` 默认关闭而可能在 undefined 后继续 `onSuccess`。两套契约使 pending、confirmed 和 history 刷新的边界难以统一，`onSettleResult` 的注释和实际触发语义也需要统一。

## 性能判断

一次桌面手动刷新实际观察到 51 个 positions 请求，全部 `isForceRefresh:true`；这只能证明该次 fan-out 的基数，不能在没有 requestId/owner/reason 关联前直接称为 51 个重复请求。全网功能本身需要覆盖当前 owner 的 DeFi-enabled networks，但 action success 叠加 immediate force refresh、history refresh、local confirmation refresh 会放大请求数和服务端限流风险。应区分 cache read、普通 polling、用户显式 refresh、交易确认 refresh 四种意图，并让同一 owner/network 在短窗口内共享请求。请求预算应以 unique eligible owner/network 数为基线，另外记录同 key 的额外请求数、峰值并发、终态耗时、stale commit 拒绝数及 rate-limit 次数。

## 已有防护与待验证边界

当前已有全网 ownerKey、run generation、重复 run gate、focus gate、手动强刷最短 15 秒/每日 50 次配额、native fan-out 并发限制和 40/80 秒 fallback；这些应保留并复用。`useAllNetworkRequests` 的 generation 目前没有被 DeFi consumer 用于每次 atom commit；ServiceDeFi 的 `isSameAllNetworksAccountData` 读取的是请求开始时捕获的 current owner，不足以证明响应完成时 owner 仍相同。

本报告是源码 review 加 Desktop/iOS 运行观察。旧的一次 iOS Ethereum → All Networks 观察中，19 个选中网络里 15 个 DeFi-enabled 网络的 positions 请求均返回 `ok=true`，其中 5 个返回协议（合计 13 个），但协议卡持续为空，切回 Ethereum 立即恢复；这把问题收窄到 warm aggregate/result publication，而不是 transport 失败。临时日志补齐后的 fresh active run 已记录 `onFinished → result-resolved(15) → result-published(15) → consumer(hasResult=true, 15)` 并正常渲染，摘录在 `.tmp/defi-ios-audit/result-publication-trace-v3.txt`，因此该竞态不是每次运行必现，仍需在同一次空态复现中区分 lastPublishedResult/undefined、queued rerun 或 owner guard。iOS main/bg 的序列化成本、JS heap 增长与取消行为也需在重构阶段补验。

63712 已在 Desktop 受控复现：六协议账户从顶部点击最后 Ethena chip 后，主滚动容器为 `scrollTop=3060.89/scrollHeight=3955/clientHeight=894`；sticky host bottom `166.60` 加 chip strip height `48.61` 得 sticky line 约 `215.20`，Ethena anchor `top≈362.29` 仍在其下方，Spark `top≈107.79` 被保留为 active。截图/几何 JSON 在 `/tmp/defi-investigation-evidence/63712-desktop-click.json` 与 `.png`。iOS 使用原生协议列表，截图能滚到 Ethena，但没有 Desktop sticky chip，不能把该 DOM 问题外推到 iOS。

补充的 iOS 复核显示列表确实能完整滚到最后 Ethena；点击其右侧箭头时打开 BTC 资产弹窗，属于另一个点击命中候选，当前没有证据把它与 63712 的 Desktop sticky 缺陷归为同一问题。截图保存在 `.tmp/defi-ios-audit/63712-ethena-open.png`。

该路径同时出现 `Cannot update a component (BasicPageFooter) while rendering a different component (PageFooterContext)`。它应作为独立的 iOS 页面渲染候选跟踪，不能充当 63710/63711/63712 的根因证据。

iOS 还完成了 Morpho withdraw 的只读链路验证：详情页 → Withdraw 表单 → Redeem confirmation → Cancel。该路径使用 `source.type='defi'` 的 generic action submit，和 Borrow `source.type='borrow'` 分支分离；因为未广播交易，不能替代 63711 的 pending/confirmed runtime 验收。

## Review 结论

当前设计有不少局部防护（ownerKey、run generation、并发限制、focus gating、40/80 秒 indexer-lag retry），但这些防护没有贯穿到每一个 state commit；因此它在正常数据下工作，在切 owner、空结果、交易 pending、全网聚合边界下会出现可见竞态。建议先做三条 issue 的小修，再做统一 repository/state machine，避免继续在各个 effect 上叠加补丁。
