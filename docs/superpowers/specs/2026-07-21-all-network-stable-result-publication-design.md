# 全网络稳定结果发布设计

## 背景

硬件钱包批量创建默认网络账户时，会连续触发 `AddDBAccountsToWallet`。如果全网络请求 A 尚未结束，新的账户事件会让 `useAllNetworkRequests` 排队请求 B；当前实现仍会先发布 A 的聚合结果，再执行并发布 B。

Portfolio 监听 Token 全网络聚合结果。于是 A 可能触发一次 `uploadPortfolio`，B 的内容发生变化后又在冷却窗口结束时触发第二次上传。两次上传都符合现有去重规则，但 A 已经是明确会被 B 替代的中间快照。

## 目标

- 已经排队后续 rerun 时，不发布当前请求的最终聚合结果。
- 只让队列中最后一次稳定请求更新 `useAllNetworkRequests.result`。
- 保留缓存预填充、逐网络渐进更新和现有请求队列行为。
- 避免 Portfolio 收到确定过期的中间快照。
- 同时避免 NFT、DeFi 消费者应用确定过期的最终聚合结果。

## 非目标

- 不改变 Portfolio 的 1 秒 debounce、20 秒硬件冷却和 content hash 去重。
- 不减少或合并 `AddDBAccountsToWallet` 事件。
- 不改变批量账户创建流程、硬件通信或数据库写入顺序。
- 不改变 `onRequestSettled` 的渐进式渲染行为。
- 不调整 `onStarted`、`onFinished` 的调用时机。

## 推荐方案

在 `useAllNetworkRequests` 内增加稳定结果发布门控。

每次请求结束时，在完成 `onFinished` 后检查 `rerunAfterCurrentRef`：

- 没有后续 rerun：当前结果是稳定结果，允许发布并替换最后一次稳定结果。
- 已有后续 rerun：当前结果标记为 superseded，继续按照现有逻辑调度 rerun，但不替换公开的 `result`。

Hook 内部保留最后一次稳定发布结果。superseded 请求完成时，消费者继续看到原来的稳定结果引用；首次请求就被 superseded 时，消费者继续看到未就绪状态，直到最终 rerun 完成。

## 数据流

```text
请求 A 开始
  → 逐网络结果通过 onRequestSettled 渐进更新页面
  → 收到新的刷新请求，设置 rerunAfterCurrentRef
  → 请求 A 完成并执行 onFinished
  → 检测到后续 rerun，A 不更新公开 result
  → 按现有合并配置启动请求 B
  → 请求 B 完成，期间没有新的 rerun
  → B 更新公开 result
  → Token/NFT/DeFi 执行最终聚合 effect
  → Portfolio 仅收到 Token 的稳定快照
```

## 实现边界

主要修改：

- `packages/kit/src/hooks/useAllNetwork.ts`
  - 将内部请求结果与公开稳定结果区分开。
  - 在请求队列最终状态确定后计算是否允许发布。
  - superseded 结果不得清空或替换已有稳定结果。

测试修改：

- 为结果发布门控补充针对性测试；根据现有测试结构，可提取一个小型纯函数，也可使用 Hook 测试验证请求时序。

不需要修改：

- `TokenListBlock.tsx`
- `ServiceHardwarePortfolioSync.ts`
- `ServiceHardware.ts`
- 本地数据库 schema 和事件 payload

## 并发与时序

- 判断是否发布必须发生在 `onFinished` 完成之后，避免该异步阶段新到达的刷新请求漏标当前结果。
- 判断完成后到结果返回之间不得再引入异步间隙。
- 多次刷新请求继续由现有 `rerunConfigRef` 合并成一次 rerun。
- 当前请求的缓存写入和渐进式结果仍可执行；只阻止最终 authoritative result 发布。
- owner、network 或 wallet 切换时，现有 owner guard 和请求 nonce 规则继续生效。

## 错误处理

- 当前请求失败时保持现有错误路径，不因发布门控吞掉有效错误。
- rerun 已排队时，当前成功结果即使被丢弃，也必须正常执行清理和 `onFinished`。
- 最终 rerun 失败时，不伪造稳定结果；页面继续保留已有缓存或渐进式数据，并沿用现有错误处理。

## 跨平台说明

- iOS、Android、扩展是 main/bg 分离 Runtime：全网络请求和最终聚合发生在 main，Portfolio 服务在 bg 消费跨 Runtime 事件；门控发生在事件发出前，因此不会增加 JS 堆副本或硬件调用。
- Desktop/Web 是单 Runtime：同样在最终聚合 effect 触发前完成门控。
- USB/BLE 与硬件 SDK 仍由后台硬件链路持有，本设计不改变原生资源所有权和初始化顺序。

## 测试与验收

至少覆盖以下场景：

1. 无 rerun：请求 A 正常成为公开结果。
2. A 执行期间触发 B：A 不发布，B 发布。
3. A 执行期间连续触发多次刷新：仍只执行一次合并后的 rerun，最终结果发布一次。
4. 已有稳定结果时出现 superseded 请求：公开结果不被清空，也不改变引用。
5. 首次请求被 superseded：在最终 rerun 完成前不产生最终聚合结果。
6. Token 场景中只对稳定结果发出 `AllNetworksTokenListSettled`，从而只调用一次 Portfolio 上传。
7. NFT 和 DeFi 不应用 superseded 的最终聚合结果，现有 `onFinished` 加载状态逻辑不回归。

完成实现后运行相关 Hook/工具测试，并根据改动范围执行 TypeScript 与 lint 验证。

## 风险与控制

- `useAllNetworkRequests` 同时服务 Token、NFT、DeFi，虽然改动集中，但消费者范围较广。
- 保留 `onRequestSettled` 可避免等待最终 rerun 时页面失去渐进式数据。
- 保留最后一次稳定结果可避免 superseded 请求导致列表清空或闪烁。
- 不修改事件和数据库结构，降低跨 Runtime 与持久化兼容风险。

## 验收标准

- 批量创建硬件账户引发连续全网络刷新时，superseded 请求不更新公开 `result`。
- Portfolio 不再因为 superseded 中间快照发生第一次设备写入。
- 最终稳定快照仍正常上传设备。
- Token、NFT、DeFi 的缓存、渐进式展示、手动刷新和加载状态无回归。
