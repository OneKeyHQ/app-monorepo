# OK-63710 / OK-63711 / OK-63712 根因报告

调查日期：2026-09-21。实现基线：`origin/x`，本地分支：`codex/fix-OK-63710-63711-63712`。三个 Jira 都是 App-6.6.0 待办，没有文字验收条件，视频/截图是主要证据。本轮在调查结论基础上保留了最小可 review 修复，当前只留本地未提交 diff。

## 证据等级和边界

- **源码事实（L1）**：通过当前分支代码、调用关系和状态 reducer 复核，可证明存在的路径和时序。
- **附件事实（L2）**：Jira 视频/截图中实际出现的 UI 时间线；只能证明用户可见结果，不能单独证明某个请求或事件是唯一触发源。
- **Desktop 运行证据（L3）**：开发环境 CDP/network 观察到的请求数量和页面状态；当前运行账号与附件账号/排序不完全一致，因此不能当作三个 issue 的完整同账号复现。
- **iOS 运行证据（L4）**：已获得可用 DeFi 账户的受控复现，但不是完整验收。Ethereum 单链可见 Morpho/Pendle/Aave；旧的一次 All Networks 观察出现协议卡空态，但当时没有 active-tab 的结果发布日志。补加临时计数日志后的 fresh run 已捕获 active tab 的 `15 requests → onFinished → result-resolved(15) → result-published(15) → consumer(hasResult=true, 15)`，说明该竞态不是每次运行必现，精确失败分支仍未唯一归因。63711 还完成了 Wallet → DeFi → Morpho → Withdraw → Redeem confirmation 的只读路由验证并在签名前取消；这确认 iOS 走 generic `source.type='defi'` 路径，但没有提交真实交易，因此 pending→history 刷新行为仍未验收。63712 的 iOS 原生列表可滚到最后协议，没有 Desktop sticky chip。

工作区中的 `[DEFI-DIAG]` 日志用于补齐触发源、请求参数和提交时序，日志默认仅在非 production 输出且不记录地址、tx hash 或敏感数据；临时诊断代码已移除。若没有对应的完整日志时间线，结论中的“高置信”只表示源码机制置信度，不表示某次录屏已被单次运行日志唯一归因。

## 结论

| Issue | 结论 | 置信度 |
|---|---|---|
| OK-63711 | 录屏走的是 Home 的 Morpho generic position action。当前代码已经保证确认页在 pending/undefined 关闭时不会调用 generic `onSuccess`（历史 commit `4441d61` 已引入该 guard）；但 `AccountDataUpdate` 触发的 tab refresh、action-success force refresh、local-confirm 和 history classification 仍可在短时间内分别发起请求。请求没有按 owner/network/transaction 合并，也没有 event generation/LWW 提交保护，因而在 indexer 尚未物化时显示旧持仓，或由旧响应覆盖较新结果。iOS 已验证同一 generic route 到签名前，但未提交真实交易。 | 源码机制高；录屏单次触发和 iOS pending 行为未闭环 |
| OK-63710 | All Networks 切换先清空列表；聚合 flush/`onFinished` 的 settled 提交早于 authoritative result 发布，`protocols=[] + initialized=true + loadedOwnerKey=当前 owner` 会满足 EmptyDeFi 条件。更具体地，fan-out 期间若 `runWithQueue` 设置 `hasQueuedRerun=true`，`resolveAllNetworkPublishedResult` 在 baseline `clearRetainedResultOnAcceptedRun=false` 下会返回 `publishedResult=undefined`；`onFinished` 仍已在 `finally` 执行。现有单测 `allNetworkRunResultUtils.test.ts:43-55` 明确覆盖“first run superseded → does not publish”。旧观察中 15 个请求均成功（13 个返回协议，10 个返回 0）但协议卡为空；fresh active run 无 queued rerun 时正常发布 15 条。 | 源码/单测根因高；旧空态与 queued-rerun 的运行关联仍未用同一轮日志闭环 |
| OK-63712 | Desktop 已受控复现：点击最后一个 Ethena chip 后滚动容器到 `maxScroll≈3061`，Ethena anchor 仍在 sticky line 下方（top≈360，sticky line≈215；sticky host bottom≈166 加 chip strip≈49），scroll-spy 继续把 Spark 判为 active；pin lock 释放后用户看到最后协议不可选中。根因是目标滚动被 clamp 到 maxScroll，但内容底部没有为最后 anchor 留出 sticky offset。 | Desktop 运行根因高；iOS 是原生列表路径，未发现同构 sticky 问题 |

## OK-63711：交易后资产滞后

录屏 7.13.18 的可见事实是：Withdraw 1 USDC 后约 3.3 秒显示“交易已提交”，关闭后列表仍显示旧的 6.0029 USDC；约 15 秒再次打开时输入框仍预填旧数量。录屏后半切换页面/再次操作后才出现 5.0029 USDC，不能把后半段归因到某一个刷新源。

本轮 iOS 只读验证从 Wallet → DeFi → Morpho 进入 Withdraw 表单，再进入 Redeem confirmation，确认页展示 network/account/asset delta/contract/fee，随后在签名前取消。截图在 `.tmp/defi-ios-audit/63711-ios-*.png`。这证明 iOS 的 Morpho 入口复用 generic DeFi action contract；因为没有广播交易，不能把该次路由验证当作 63711 的 pending-refresh 复现。

代码链路如下：

1. 录屏中的 sectioned Morpho 行由 `ProtocolSectionedPositionTable.tsx:178-191` 渲染 `ProtocolPositionActionButton`；默认 `preferLendingDialog=false`，进入 generic `useProtocolPositionActionSubmit`/`ProtocolPositionActionDialog`，不是 Borrow hook。`defiActionUtils` 的 Morpho fixture 也验证了 Withdraw action resolver。
2. `ProtocolPositionActionDialog.tsx:1057-1087` 只有 `finalStatus === Success` 才执行 `onSuccess`；这条 pending/undefined guard 已存在，不应重复作为本 issue 的新修复。`DeFiActionTxConfirmResult` 在用户点 Done 关闭 pending 页时返回 `undefined` 并中止继续等待，因此“交易已提交”这一刻不会触发 generic success refresh。
3. 之后 `ServiceDeFi.ts:478-501` 的 `LocalPendingTxConfirmed` 会立即 `_runDeFiForceRefresh` 并安排 40s/80s fallback；generic action 最终 Success 后，`DeFiListBlock.tsx:976-984` 先发 `AccountDataUpdate`（由同文件 `:1288-1304` 触发 tab run/all-network fan-out），再调用 `refreshAccountDeFiPositionsAfterAction` 立即强刷；`TxHistoryContainer.tsx:511-525` 的历史分类确认又可触发同一刷新。
4. 这些入口都可向 `/wallet/v1/portfolio/positions` 发出 `isForceRefresh:true`。`_scheduleDeFiForceRefresh` 按 `accountId__networkId` 合并 delayed timer，但不会合并已在飞的 immediate 请求；提交侧也没有 fetchedAt/generation 的 LWW 保护，旧响应可能覆盖较新的事件结果。

所以附件能够证明的是：pending 关闭后，UI 在 indexer 物化前继续显示旧持仓，随后通过外部确认/轮询延迟更新。它不能单独证明某一条入口是唯一触发源；本次临时日志尚未拿到该笔交易从 action 到最终 history 的完整关联时间线。

**建议的最小修复**：保留并为 generic pending/undefined guard 增加回归断言（它已存在，不是新的行为改动）；pending 只记录 order/状态，不发 positions force refresh。由一个按 `accountId + networkId + transaction/order` 去重的 coordinator 接管 AccountDataUpdate、local-confirm、最终 Success 和 history 入口，保留 40s/80s indexer-lag fallback，并拒绝旧 generation 提交。Borrow `handleBorrowSuccess` 对 undefined 的旁支缺陷仍应单独修复/测试，但它不是这段 Morpho 录屏的根因。

## OK-63710：单链切全网空态

录屏 7.09.37 的时间线：Ethereum 约 $44.63；切 All Networks 后约 2 秒显示 `$0.00` 与“开始赚取收益”；随后 skeleton；最后回填约 $156.85 和协议卡。它不是最终数据为空。iOS 受控复现更严重：切 All Networks 后总览约 $26.80，但协议卡持续为空超过 16 秒；切回 Ethereum 后约 $22.86 的 Morpho/Pendle/Aave 卡片立即恢复。

代码时序：

- `useAllNetworkRequests` 在一次 run 开始调用 `clearAllNetworkData`；`DeFiListBlock.tsx:690-713` 清 overview、protocols、protocolMap，并置 `isRefreshing=true`。
- `handleAllNetworkRequestsFinished` (`:877-917`) 先调用 `updateAllNetworkData.flush()`，随后执行 `deFiListLoadingReducer({type:'settled'})`；flush 可能提交当前的部分聚合，甚至是空聚合。
- `useAllNetworkRequests` 的 `onFinished` 位于 hook 的 `finally`，早于 `onResultPublished`；`allNetworksResult` effect (`:1449-1518`) 之后才重新合并 authoritative result 并写入协议列表。
- 这里的 `finally` 只覆盖已接受的 fan-out。stale owner、disabled、已有请求、缺少 owner 或非 All Networks 的 early return 在进入 `try/finally` 前直接返回 `undefined`，不会调用 `onFinished`；但 `usePromiseResult` 仍可能在 nonce/latest gate 通过时把这个 `undefined` 写回结果。诊断日志缺少 `onFinished` 时，必须同时区分“early return”与“accepted run 的 settled 时序”。
- 对照 `TokenListBlock.tsx:1968-1980`，baseline 的 DeFiListBlock 调用 `useAllNetworkRequests`（约 `DeFiListBlock.tsx:948-976`）没有传 `onRequestSettled`/`onResultPublished`，也没有开启 `clearRetainedResultOnAcceptedRun`。临时诊断期间加入的 `onResultPublished` 只用于记录 telemetry，不能算生产提交门。因此 DeFi 没有 TokenList 那条渐进 ingest/published-generation 提交门，allNetworksResult 只能依赖 hook 的最终 state；旧观察中的“请求成功但协议卡为空”与此风险一致，但最新 active run 已正常发布 15 条结果。
- `useAllNetwork.ts:631-655,1254-1286` 中，`runWithQueue` 在 `isFetching.current` 为真时会设置 `rerunAfterCurrentRef`；随后 `scheduleQueuedRerun()` 让当前 run 的 `hasQueuedRerun=true`。`useAllNetwork.ts:1209-1223` 调用 `resolveAllNetworkPublishedResult`，而 `allNetworkRunResultUtils.test.ts:43-55` 已证明：没有 retained snapshot 时，当前成功结果也会返回 `undefined`。因此“请求成功 → onFinished settled → 当前结果不提交 → queued run 再被 redundant gate 跳过/返回 undefined”可以直接解释空态，不需要假设 HTTP 失败。
- Empty 条件由 `deFiListLoadingReducer.ts:42-60` 定义：`protocolsLength===0 && initialized && !isRefreshing && loadedOwnerKey===ownerKey`。因此 onFinished 到 result effect 之间可以合法渲染 EmptyDeFi。

All Networks 另有 `isEmptyAccount` 异步状态：`useAllNetwork.ts` 只有在 accounts 过滤后才设置；它没有随 owner 同步 reset。账号缓存半成品、enabled map 尚未到达、旧 run 的 callback 都可能把同一个空态窗口拉长。源码确认存在“clear-before-authoritative-result + settled-before-result”的竞态窗口；旧空态观察与该窗口一致，但并未用同一次 active-tab 日志唯一证明失败提交分支。旧 iOS 观察的 15 个 positions 请求均成功，其中返回协议的网络合计 13 个；最新 active 日志则记录 `onFinished → result-resolved(15) → result-published(15) → consumer(15)`，因此下一次必须在空态同一轮补出 lastPublishedResult/undefined、queued rerun 或 owner guard 的分支标记。

**建议的最小修复**：将 settled 状态绑定到 authoritative aggregate commit；对 DeFi 启用 retained last-good 或让 queued run 继承/发布 superseded result，禁止 `hasQueuedRerun` 的成功结果直接落成 `undefined`。在此之前保留 last-good protocols/overview，只显示 loading overlay。所有 callback 传递并校验 owner/generation；owner 变化时同步 reset `isEmptyAccount`，旧 generation 只允许写 telemetry，不能写 atoms。下一轮诊断仍应在 active `refreshCacheOnly=false` 实例记录 clear、onFinished、resolved、published、consumer effect 和 owner/generation，以闭合真实触发频率。

## OK-63712：底部最后协议不可选中

截图显示 sticky chip 中 Pendle V2 保持 active，最右 Aave V3 被标注但未能成为 active。相关实现：

- `DeFiContainer.tsx:98-122` 计算目标滚动位置并 clamp 到 `maxScroll`。
- `DeFiContainer.tsx:336-375` 点击后设置 `pinLockTarget`，滚动未收敛时 2 秒 safety timer 解除锁。
- `defiDesktopStickyDom.ts:39-55` 只选择 `top <= stickyLine` 的最后一个 anchor。

当最后 anchor 需要的 targetY 大于 maxScroll，页面已经到达底部但它仍在 stickyLine 下方，scroll-spy 继续返回倒数第二个协议；safety timer 到期后 pinnedKey 回退。这不是横向 chip 命中问题。当前 Desktop 受控证据：Ethereum 账户六个协议，点击 Ethena 后主滚动容器 `scrollTop=3060.89`、`scrollHeight=3955`、`clientHeight=894`；sticky host bottom `166.60`，chip strip height 约 `48.61`，计算 sticky line 约 `215.20`；Spark anchor `top≈107.79`，Ethena 最后 anchor `top≈362.29`，最终 chip 的 `aria-current` 仍是 Spark。最后 anchor 距 sticky line 约 `147px`，说明底部至少需要同量级的动态 spacer 或等价的 last-item fallback。截图和 JSON 保存在 `/tmp/defi-investigation-evidence/63712-desktop-click.{png,json}`。iOS 截图显示原生 DeFi 列表可以滚到 Ethena，未使用 Desktop sticky chip，因此不能把 Desktop DOM 根因外推为 iOS 缺陷。

**建议的最小修复**：给内容尾部增加动态 spacer，至少覆盖 `viewportHeight - stickyOffset`；或者在 `scrollTop≈maxScroll` 且目标为最后协议时显式把目标视为 active。补几何集成测试，覆盖 target clamp、last anchor、pin lock release。

## 取证边界

静态回归：`allNetworkRunResultUtils.test.ts` 15/15、`DeFiListBlock.loading.test.ts` 3/3、`defiDesktopStickyDom.test.ts` 21/21（合计 39 tests）通过（2026-09-21）。其中 utility test 明确覆盖 queued first-run 返回 `undefined` 的现有契约；这些测试不能替代全网切换、真实交易确认或 iOS main/background 运行验证。

- Desktop：开发环境已进入 DeFi tab，监听到一次手动全网刷新并发 51 个 `positions` 请求，全部 `isForceRefresh:true`；页面从约 ¥307.72 分批落到约 ¥166.17，证明请求/聚合存在可见分批窗口。另已从顶部点击最后 Ethena chip 复现 63712：最终 active chip 为 Spark，证据见 `/tmp/defi-investigation-evidence/63712-desktop-click.json` 与 `.png`。
- iOS：Ethereum → DeFi 受控复现成功；旧 All Networks 观察显示 15 个 DeFi-enabled positions 请求均 `ok=true`，协议卡持续为空，切回 Ethereum 立即恢复；最新带临时日志的 active run 成功提交 15 个结果并渲染协议卡，因此空态的精确提交分支仍未闭环。另完成 63711 的 Morpho withdraw → Redeem confirmation 只读路由并取消，未广播交易；因此 63711 pending 链路仍未验收。63712 的原生列表可完整滚到 Ethena/最后协议，没有 Desktop sticky chip/active-anchor UI，Desktop sticky DOM 是另一条 tableLayout 路径。一次点击 Ethena 右侧箭头打开了 BTC 资产弹窗，记录为独立的点击命中候选（`.tmp/defi-ios-audit/63712-ethena-open.png`），不归因到 63712。
- 该 iOS 点击命中候选同时出现 `Cannot update a component (BasicPageFooter) while rendering a different component (PageFooterContext)`，日志位于当前 `agent-device` session 的 app log；这是原生页面渲染/点击路径问题，尚未证明与三个 Jira 的根因有关，需单独立项或复现后再处理。
- 运行证据文件：iOS 截图和日志摘录在 `.tmp/defi-ios-audit/`；Desktop 监听摘要在 `/tmp/defi-investigation-evidence/desktop-load.json`、`switch-to-ethereum.json` 和 `63712-desktop-click.json/png`。这些是取证产物，不是产品修复。
- 本轮 active-tab result publication 诊断摘录为 `.tmp/defi-ios-audit/result-publication-trace-v3.txt`，对应截图 `.tmp/defi-ios-audit/refresh-trace-active-v3.png`；它记录的是成功发布链路，用于约束结论边界，不代表空态失败分支已闭环。
- 当前 fix 分支未提交、未推送、未创建 PR；临时 `[DEFI-DIAG]` 代码已移除。实现 diff 只留在本地供 review。
