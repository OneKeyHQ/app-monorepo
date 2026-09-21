# DeFi 数据流重构与优化报告

## 目标

把 DeFi positions 变成 owner-scoped、可取消、可去重、可观测的单一 read model。UI 只订阅当前 owner 的 materialized state；交易刷新只通过一个 coordinator；缓存和网络结果都通过同一提交门校验 generation。

估算假设：沿用现有 `/wallet/v1/portfolio/positions` 协议、SimpleDB 数据结构和 AppEventBus，不引入新的 Realm/IndexedDB schema，不重写协议卡 UI。若后端需要新增版本号/confirmed-at 字段，需另行评估接口和发布周期；以下工作量是前端 main/bg、Desktop 和 iOS 双端验证的工程估算，不是承诺排期。

## 本地实现状态

本地 fix 分支已完成第一阶段的可 review 实现，当前保持未提交状态：

- `DeFiListBlock` 已拆成单网络数据、All Networks 聚合、刷新事件、支持 action 四个 hook，页面组件只保留状态读取和 UI 编排。
- All Networks 改为通过 `onResultPublished` 提交 authoritative aggregate，开启 retained-result；同 owner 刷新保留 last-good snapshot，空结果也能完成 settled 提交。
- 交易 action 先等待 Earn order 持久化，再把成功回调直接路由到对应 account/network 的 `ServiceDeFi` positions refresh；随后发 `HistoryTxStatusChanged` 更新历史，ServiceDeFi 对同一 account/network 的立即请求做 in-flight 合并。
- Desktop table-layout 内容尾部增加 `$24` spacer，给最后协议 chip 留出 sticky offset 的滚动空间。
- 新增 `deFiListDataUtils.test.ts`，覆盖聚合、排序和 owner key；本地已有 All Networks / promise / loading / sticky 测试一并通过。

这轮没有改接口或本地数据库 schema，仍需按验收矩阵在 Desktop 和 iOS 做真实交易及快速切换验证。

## 验收矩阵

| 场景                   | Desktop                                                                                                                  | iOS                                                                                   |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------- |
| 单链 → All Networks    | 不出现 EmptyDeFi；保留 last-good 或只显示 skeleton/overlay；最终值与协议数一致                                           | 同样验证 main/background 事件和 owner generation                                      |
| Withdraw/Repay pending | generic pending 不触发 success/positions force refresh；确认后只出现一次 immediate/settled commit，40/80 秒 retry 可观测 | 同上，重点看 bg ServiceDeFi 到 main UI 的事件顺序；Borrow 分支单独验证 undefined 契约 |
| 最后协议               | 点击后 active chip 稳定，目标 anchor 或 bottom fallback 可验证                                                           | 验收原生协议列表交互，不套用 Desktop sticky DOM                                       |
| 重复刷新               | 同 owner 短窗共享请求；记录请求数、耗时、限流                                                                            | 记录 main/bg 各自请求数和跨 runtime 事件数                                            |
| 账号/网络快速切换      | 旧 owner 不得写新 owner UI                                                                                               | main/bg 两边都不得写旧 owner                                                          |

请求性能目标：同一 owner/network 的 pending 回调不得触发 positions 强刷；一次明确 confirmed 事件最多产生一个立即请求，40/80 秒仅在需要时各执行一次且不与 in-flight 请求重叠；AccountDataUpdate 与 force refresh 不能为同一 transaction 产生两条未合并请求；全网冷路径请求数不超过当次 eligible network 数加明确的重试预算。验收同时记录 P50/P95 首次可见、最终收敛耗时、峰值并发、HTTP 限流次数、重复请求比率和旧 owner commit 拒绝数。

## 回滚与发布

本轮未改变后台服务协议或本地数据库 schema，因此不需要数据库版本升级；若后续引入持久化字段再按 schema 规则单独评估。

本轮已经拿到 iOS DeFi 账户和后台日志，并验证 63710 的正常 active 发布链路；旧空态截图对应的失败提交分支仍未唯一闭环。63712 已有 Desktop 运行根因，iOS 原生路径可滚到最后协议且未发现同构 sticky 问题；63711 已验证 iOS generic Morpho action 到签名前，但未广播真实交易，pending/confirmed 仍应标为未验证，不能以重构静态检查代替多端验收。
