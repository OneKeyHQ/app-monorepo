# DeFi 数据流重构与优化报告

## 目标

把 DeFi positions 变成 owner-scoped、可取消、可去重、可观测的单一 read model。UI 只订阅当前 owner 的 materialized state；交易刷新只通过一个 coordinator；缓存和网络结果都通过同一提交门校验 generation。

估算假设：沿用现有 `/wallet/v1/portfolio/positions` 协议、SimpleDB 数据结构和 AppEventBus，不引入新的 Realm/IndexedDB schema，不重写协议卡 UI。若后端需要新增版本号/confirmed-at 字段，需另行评估接口和发布周期；以下工作量是前端 main/bg、Desktop 和 iOS 双端验证的工程估算，不是承诺排期。

## 本地实现状态

本地 fix 分支已完成第一阶段的可 review 实现，当前保持未提交状态：

- `DeFiListBlock` 已拆成单网络数据、All Networks 聚合、刷新事件、支持 action 四个 hook，页面组件只保留状态读取和 UI 编排。
- All Networks 改为通过 `onResultPublished` 提交 authoritative aggregate，开启 retained-result；同 owner 刷新保留 last-good snapshot，空结果也能完成 settled 提交。
- 交易 action 先等待 Earn order 持久化，再发 `HistoryTxStatusChanged`，由历史分类触发一次 DeFi force refresh；ServiceDeFi 对同一 account/network 的立即请求做 in-flight 合并。
- Desktop table-layout 内容尾部增加 `$24` spacer，给最后协议 chip 留出 sticky offset 的滚动空间。
- 新增 `deFiListDataUtils.test.ts`，覆盖聚合、排序和 owner key；本地已有 All Networks / promise / loading / sticky 测试一并通过。

这轮没有改接口或本地数据库 schema，仍需按验收矩阵在 Desktop 和 iOS 做真实交易及快速切换验证。

## 分阶段计划

### Phase 0：证据闭环（0.5–1 人日）

只加开发环境临时日志，完成后删除（或在稳定后改为采样 telemetry）：

- ServiceDeFi：requestId、触发源、account/network owner 摘要、force/save/abortable、耗时、HTTP 错误/限流、protocol count；不记录地址、tx hash 或敏感数据。
- All Network：runGeneration、ownerKey、accountsInfo count、enabled map count、cache count、fan-out count、onFinished、allNetworksResult publish 时间。
- All Network skip：stale owner、disabled、已有请求、缺少 owner、非 All Networks、redundant same-owner；这些路径可能在 `try/finally` 前返回 `undefined`，必须与 accepted fan-out 的 `onFinished` 分开统计。
- UI commit：clear、empty-account transition、cache hydrate、single/all/event commit 的 owner/generation。
- 交易事件：tx status、order classification、pending/confirmed、action callback 是否触发。

日志验收必须能按 `requestId` 还原一条链路：`trigger → request-start → response/error → commit/commit-rejected`，并带 `ownerKey/generation/reason` 摘要；只看到总请求数或单个 HTTP 200 不足以证明刷新正确。禁止打印地址、xpub、tx hash、签名、seed 和用户输入。

本轮旧观察取得一条 iOS 63710 证据：15 个 fan-out 请求均成功，其中 5 个返回协议（合计 13 个），但协议卡为空；补加日志后的 fresh active run 则明确记录 `onFinished → result-resolved(15) → result-published(15) → consumer(hasResult=true, 15)`。因此 Phase 0 已证明正常发布链路，但还没有在空态同一次运行中捕获失败分支；63711 的 action→pending→history 完整关联和 63712 的最后协议交互仍未闭环。

随后已完成 Desktop 63712 受控日志：点击最后 Ethena chip 后主滚动容器 `scrollTop=3060.89/scrollHeight=3955/clientHeight=894`，sticky line 约 `215.20`，Ethena anchor `top≈362.29` 未越过，Spark 仍为 active。该证据支持以至少约 147px 的动态底部 spacer 或 last-item max-scroll fallback 修复；iOS 原生列表需独立验收。

### Phase 1：三个 issue 的低风险修复（3–5 人日，加 Desktop/iOS 回归 2–3 人日）

- 63711：保留 generic position action 已有的 pending/undefined → 非 `onSuccess` 契约，并补回归测试；这不是新的行为修复。将 AccountDataUpdate、最终 Success、local-confirm、history 统一交给按 owner/network/transaction 去重的 coordinator，保留 40/80 秒 fallback，重点消除同一 action 的 normal tab refresh 与 force refresh 并发。Borrow hook 的 undefined 分支作为独立缺陷修复和回归测试，不把它当作 Morpho 录屏根因。
- 63710：清理时保留 last-good 数据；启用 retained-result/queued-rerun 的安全发布语义，禁止成功 fan-out 因 `hasQueuedRerun` 直接返回 `undefined`；settled 和 aggregate result 同事务提交；owner 改变同步 reset `isEmptyAccount`；每个 callback 做 generation check。
- 63712：增加动态底部 spacer 或 max-scroll-last-item fallback；把 `scrollToAnchor` 几何量写成单测/集成测试，验证最后协议 chip active 不回退。Desktop 已有受控复现，iOS 需按原生列表路径单独验收。

Phase 1 的完成门槛是每个 issue 各有一条 Desktop 受控日志时间线和一条 iOS 受控日志时间线；只有附件复现、源码推断或无 owner 关联的 network count 时，状态应保持“未闭环”。

### Phase 2：统一数据流（7–10 人日，含双端验收约 1–2 周）

1. 建立 `DeFiPositionsRepository`，key 为 `accountId + indexedAccountId + networkId/allNetwork + currency`；缓存、in-flight promise、TTL、abort controller 都按 key 管理。
2. 每次 run 分配单调 generation；请求、cache hydrate、事件 payload 都带 owner/generation/fetchedAt；提交只接受当前 generation，旧结果仅记 telemetry。
3. 建立 `DeFiRefreshCoordinator`：普通 polling/cache read、用户手动刷新、交易 confirmed refresh 分离；同 key 请求合并；交易只在一个确认点触发，40/80 秒作为可取消的 delayed retry。
4. All Network 返回 authoritative materialized map；冷/暖缓存统一发布协议，禁止 `onFinished` 先于结果把列表标记为 settled；切 owner 时 abort 旧 fan-out 并清理 aggregator。
5. Service local overview 按 owner 写入；正常 settle 从 controller 集合移除；前台和 background 通过同一 repository 事件桥接。
6. Portfolio header、DeFi tab、Desktop WebAccountPanel 改为订阅同一 read model，消除独立 fan-out。

建议先以 `DeFiPositionsRepository` 的只读 shadow mode 运行一轮：旧 UI 继续渲染，repository 仅记录去重命中、stale commit 拒绝和请求预算；确认结果与现有链路一致后再切换单一写入。这样可以把重构风险和三个 issue 的小修隔离。

## 验收矩阵

| 场景 | Desktop | iOS |
|---|---|---|
| 单链 → All Networks | 不出现 EmptyDeFi；保留 last-good 或只显示 skeleton/overlay；最终值与协议数一致 | 同样验证 main/background 事件和 owner generation |
| Withdraw/Repay pending | generic pending 不触发 success/positions force refresh；确认后只出现一次 immediate/settled commit，40/80 秒 retry 可观测 | 同上，重点看 bg ServiceDeFi 到 main UI 的事件顺序；Borrow 分支单独验证 undefined 契约 |
| 最后协议 | 点击后 active chip 稳定，目标 anchor 或 bottom fallback 可验证 | 验收原生协议列表交互，不套用 Desktop sticky DOM |
| 重复刷新 | 同 owner 短窗共享请求；记录请求数、耗时、限流 | 记录 main/bg 各自请求数和跨 runtime 事件数 |
| 账号/网络快速切换 | 旧 owner 不得写新 owner UI | main/bg 两边都不得写旧 owner |

请求性能目标：同一 owner/network 的 pending 回调不得触发 positions 强刷；一次明确 confirmed 事件最多产生一个立即请求，40/80 秒仅在需要时各执行一次且不与 in-flight 请求重叠；AccountDataUpdate 与 force refresh 不能为同一 transaction 产生两条未合并请求；全网冷路径请求数不超过当次 eligible network 数加明确的重试预算。验收同时记录 P50/P95 首次可见、最终收敛耗时、峰值并发、HTTP 限流次数、重复请求比率和旧 owner commit 拒绝数。

## 回滚与发布

先以小修 PR 分离三个 issue，保留临时日志开关但默认关闭；通过 Desktop、iOS 受控回归后再合并 repository 重构。任何后台服务协议字段或 Realm schema 未改变时不需要数据库版本升级；若引入持久化字段再按 schema 规则单独评估。

本轮已经拿到 iOS DeFi 账户和后台日志，并验证 63710 的正常 active 发布链路；旧空态截图对应的失败提交分支仍未唯一闭环。63712 已有 Desktop 运行根因，iOS 原生路径可滚到最后协议且未发现同构 sticky 问题；63711 已验证 iOS generic Morpho action 到签名前，但未广播真实交易，pending/confirmed 仍应标为未验证，不能以重构静态检查代替多端验收。
