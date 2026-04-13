# Perp 币种信息与交易数据方案调研

## 1. 目标

在用户选定某个 Perp 币种后，提供一套接近 Binance / OKX 交易页的信息面板，但原则不是“信息越多越好”，而是：

1. 数据必须准确，优先使用 Hyperliquid 原生数据。
2. 原生拿不到的内容，要么明确标注为第三方来源，要么不做。
3. 不把“推导指标”伪装成“官方指标”。

一句话总结：**优先做强“合约与市场微观结构数据”，谨慎做“币种基本面数据”。**

## 2. 竞品拆解

Binance Futures 和 OKX Swap 虽然 UI 细节不同，但从大的信息结构看，基本都可以拆成 4 类：

### 2.1 头部行情

- 最新价 / 24h 涨跌
- 24h 成交额
- Open Interest
- Funding Rate
- Mark / Index / Oracle 相关价格

### 2.2 Trading Data

- 资金费历史
- 最近成交
- 多空比
- Taker Buy / Sell Ratio
- Basis / Premium
- 大户多空比 / 账户数多空比

### 2.3 Contract / Rule Info

- 最大杠杆
- 保证金档位
- 是否仅支持逐仓
- 合约规格
- OI cap / 风控限制

### 2.4 Token / Project Info

- 项目简介
- 官网 / 白皮书 / 社媒
- Market Cap / FDV / 流通量 / 总量
- 分类标签

对我们最重要的结论是：

- **Binance / OKX 的“Trading Data”大部分是交易所自有统计口径。**
- **Binance / OKX 的“Token Info”大部分来自额外的项目资料或第三方数据源。**
- **Hyperliquid 原生强项主要集中在行情、盘口、资金费、成交、合约规则，不在基本面资料。**

## 3. 当前仓库已经具备的基础能力

当前 Perp 页面已经不是从零开始，已有的数据和承载位不少：

- 已有实时市场上下文：
  - `markPrice`
  - `oraclePrice`
  - `24h volume`
  - `openInterest`
  - `fundingRate`
  - `24h change`
- 已有盘口：
  - `l2Book`
- 已有图表：
  - TradingView + mid price / price scale
- 已有账户和成交相关：
  - open orders
  - user fills
  - portfolio history

当前订阅层已经覆盖：

- `allMids`
- `activeAssetCtx`
- `bbo`
- `l2Book`
- 用户与账户相关订阅

但**还没有现成的“公共 recent trades 实时订阅”接入到当前 Perp UI**，所以第一版如果要做 `Recent Trades`，更现实的方案是：

- 先走 `recentTrades()` REST polling
- 等确认 Hyperliquid 公共成交订阅的接入收益后，再升级成流式

仓库里已经存在的关键入口：

- `packages/kit-bg/src/services/ServiceHyperLiquid/ServiceHyperliquid.ts`
- `packages/kit-bg/src/services/ServiceHyperLiquid/ServiceHyperliquidSubscription.ts`
- `packages/kit/src/views/Perp/hooks/usePerpMarketData.ts`
- `packages/kit/src/views/Perp/components/TickerBar/PerpTickerBarDesktop.tsx`
- `packages/kit/src/views/Perp/components/TickerBar/MobilePerpMarketHeader.tsx`
- `packages/kit/src/views/Perp/components/PerpOrderBook.tsx`

布局层面也已经有现成承载位：

- Desktop 当前是 `TickerBar + Candles + OrderBook + TradingPanel + BottomPanel`
- Mobile 已经有单独的 `MobilePerpMarket` 页面

另外，仓库中还已经有一套可复用的市场详情页架构：

- `packages/kit/src/views/Market/MarketDetailV2/layouts/DesktopLayout.tsx`
- `packages/kit/src/views/Market/MarketDetailV2/components/InformationTabs/layout/DesktopInformationTabs.tsx`
- `packages/kit/src/views/Market/MarketDetailV2/components/TokenActivityOverview/components/BuySellRatioBar.tsx`

这意味着这次工作更像是“组合已有能力 + 补齐 Hyperliquid 数据接口”，而不是重写整套页面。

## 4. Hyperliquid 原生可拿到什么

### 4.1 市场概览 / 合约元数据

通过 `metaAndAssetCtxs()` / `allPerpMetas()` / `meta()` 可以稳定拿到：

- `prevDayPx`
- `dayNtlVlm`
- `dayBaseVlm`
- `markPx`
- `midPx`
- `funding`
- `openInterest`
- `premium`
- `oraclePx`
- `impactPxs`
- `szDecimals`
- `maxLeverage`
- `marginTableId`
- `onlyIsolated`
- `marginMode`
- `marginTables`

这些字段已经足够支撑：

- 头部行情卡片
- 合约规格
- 保证金档位
- 当前资金费
- OI / 24h 成交额
- Premium / Mark vs Oracle

### 4.2 历史资金费

`fundingHistory()` 返回：

- `coin`
- `fundingRate`
- `premium`
- `time`

足够做：

- Funding 历史曲线
- Funding 历史表格
- Funding / Premium 双线对照

### 4.3 最近成交

`recentTrades()` 返回：

- `coin`
- `side`
- `px`
- `sz`
- `time`
- `hash`
- `tid`
- `users`

足够做：

- Recent Trades 列表
- 短周期买卖主动成交量统计
- 简单的 trade tape

### 4.4 K 线

`candleSnapshot()` 返回：

- OHLC
- `v`（base volume）
- `n`（成交笔数）

足够做：

- 原生 K 线补数据
- 某些统计卡片的区间回放

### 4.5 多交易所预测资金费

`predictedFundings()` 返回：

- `asset`
- 各 venue 的 `fundingRate`
- `nextFundingTime`
- `fundingIntervalHours`

足够做：

- Hyperliquid vs Binance / Bybit 等 venue 的 funding compare

但这里有一个关键点：

- **不同 venue 的 funding interval 不一定一致，展示时不能直接做“谁高谁低”的粗暴比较。**
- 更合理的做法是同时展示：
  - 原始 funding rate
  - funding interval
  - next funding time

### 4.6 注释信息

`perpAnnotation()` / `perpConciseAnnotations()` 返回：

- `category`
- `description`
- `displayName`
- `keywords`

它们可以用来补一层“合约分类说明”，但**不能当成完整项目介绍**。

### 4.7 额外可用但目前还没接入的点

- `perpsAtOpenInterestCap()`：可做 OI cap 风险提示
- `userFunding()`：用户维度资金费

## 5. Hyperliquid 不擅长或拿不到什么

仅靠 Hyperliquid 原生数据，基本拿不到完整的 Binance / OKX 式币种基本面：

- 官网
- 白皮书
- Twitter / Telegram / Discord
- 项目简介
- Market Cap
- FDV
- 流通量
- 总量
- 生态标签 / 赛道标签

同样也拿不到交易所自有统计口径的这类指标：

- Top Trader Long / Short Ratio
- Account Long / Short Ratio
- 官方口径 Taker Buy / Sell Ratio
- 大户持仓占比
- 类似 OKX 的部分“情绪类 / 持仓类衍生统计”

这类指标如果没有可靠第三方源，**就不应该伪装成“准确交易数据”**。

## 6. 数据来源分级

### A. 推荐直接做：Hyperliquid 原生数据

这些项准确性最高，最适合做 MVP：

| 模块 | 数据 | 来源 | 备注 |
| --- | --- | --- | --- |
| Overview | Mark / Oracle / Mid / 24h Change / 24h Volume / OI / Funding | `metaAndAssetCtxs` | 原生可靠 |
| Contract | Max Leverage / Size Decimals / Margin Mode / Margin Tables | `meta` / `allPerpMetas` | 原生可靠 |
| Funding | Current Funding / Funding History / Premium History | `metaAndAssetCtxs` + `fundingHistory` | 原生可靠 |
| Trades | Recent Trades | `recentTrades` | 原生可靠 |
| Liquidity | Spread / Best Bid / Best Ask / Depth | `l2Book` | 原生可靠 |
| Cross Venue | Predicted Funding Compare | `predictedFundings` | 原生可靠，但展示要保留 interval |
| Annotation | Category / Display Name / Description | `perpAnnotation` | 可做轻量说明 |
| Risk | OI Cap Warning | `perpsAtOpenInterestCap` | 适合做提示 |

### B. 可以做，但必须明确标注为“推导指标”

这些不是 Hyperliquid 直接给的“官方指标”，而是可以基于原始数据计算：

| 模块 | 计算方式 | 风险 |
| --- | --- | --- |
| OI Notional | `openInterest * markPx` | 需要说明原始 OI 是币本位数量还是合约数量 |
| Spread % | `(bestAsk - bestBid) / bestAsk` | 低风险 |
| Depth Imbalance | `topN bid depth / (topN bid + topN ask)` | 低风险 |
| Premium % | `(markPx - oraclePx) / oraclePx` 或直接用 `premium` | 要统一口径 |
| Buy / Sell Flow | 基于 `recentTrades.side` 的滚动窗口统计 | 只能叫 flow / recent buy-sell ratio，不能叫官方 taker ratio |
| Funding APR Estimate | funding rate 年化估算 | 容易被误读，必须标注 estimate |

### C. 可选做，但必须用第三方数据源并显式标注来源

如果以后想补“币种信息”而不是“合约信息”，建议单独做来源标记：

| 模块 | 可能来源 | 风险 |
| --- | --- | --- |
| 项目简介 / 官网 / 社媒 | CoinGecko / CMC / 内部市场 API | 币种映射要准 |
| Market Cap / FDV / Supply | CoinGecko / CMC / 内部市场 API | 合约标的与现货币种可能有映射歧义 |
| 分类 / 标签 | 第三方 metadata | 容易和 Hyperliquid annotation 含义冲突 |

建议 UI 上与 Hyperliquid 原生数据分开，明确标注：

- `Source: Hyperliquid`
- `Source: CoinGecko`

### D. 当前不建议做

以下内容如果没有权威来源，容易误导用户：

- Top Trader Long / Short Ratio
- Account Long / Short Ratio
- “官方口径” Taker Buy / Sell Ratio
- 支撑位 / 压力位这类分析性指标
- 清算热力图

这些更像“分析工具”而不是“准确交易数据”。

## 7. 推荐的信息架构

### 7.1 核心原则

建议把内容拆成两个层级：

1. **Market Data**
   - 完全基于 Hyperliquid 原生和可解释推导
2. **Token Info**
   - 只在有可靠第三方源时提供
   - 与原生交易数据分区展示

### 7.2 推荐 MVP 信息结构

#### Overview

- Mark Price
- Oracle Price
- 24h Change
- 24h Volume
- OI
- OI Notional
- Funding Rate
- Premium
- Best Bid / Ask
- Spread / Spread %

#### Funding

- Current Funding
- Next Funding Countdown
- Funding History Chart
- Premium History
- Cross-venue Predicted Funding

#### Trades

- Recent Trades 列表
- Rolling Buy / Sell Flow
- Top N Depth Imbalance

#### Contract

- Max Leverage
- Margin Mode
- Size Decimals
- Margin Tiers
- OI Cap Warning

#### About

- Category
- Display Name
- Annotation Description

这个 `About` 只代表 Hyperliquid 对该 perp 的注释，不代表完整项目百科。

## 8. UI 方案建议

### 8.1 Desktop

不建议一上来把这套内容硬塞进当前订单区，否则很容易破坏交易主工作区密度。

更合理的方式是：

#### 推荐方案：Chart 下方可展开的 Market Detail Drawer

- 位置：K 线下方
- 默认：折叠
- 展开后：占据新的垂直空间，不压缩 OrderBook / TradingPanel
- 内部结构：Tabs
  - `Overview`
  - `Funding`
  - `Trades`
  - `Contract`
  - `About`

原因：

- 不破坏当前交易区稳定性
- 符合交易所“图表下方展开详情”的使用习惯
- 技术上可以复用 `MarketDetailV2` 的 tabs 架构

### 8.2 Mobile

Mobile 已经有 `MobilePerpMarket` 页面，最适合直接往下加：

- Header
- Candles
- OrderBook
- **Market Data Sections**

推荐顺序：

1. Overview
2. Funding
3. Trades
4. Contract
5. About

原因：

- 移动端天然适合纵向滚动
- 不会挤压下单面板
- 与当前 `MobilePerpMarket` 结构兼容

### 8.3 是否直接复用现有 MarketDetailV2

可以复用，但建议“复用架构，不直接复用数据模型”：

- 可复用：
  - Tabs 容器结构
  - 信息卡片布局
  - `BuySellRatioBar`
  - 信息分区样式
- 不建议直接复用：
  - Token fundamentals 的数据模型
  - 现货 holders / transactions / portfolio 语义

更好的方向是：

- 新建 `PerpMarketDetail` 组件族
- 复用 `MarketDetailV2` 的布局模式和基础视觉组件

## 9. 实现方案

### 9.1 后台服务层

建议在 `ServiceHyperliquid` 增加一组 symbol detail 能力：

- `getPerpMarketOverview({ coin })`
- `getPerpFundingHistory({ coin, startTime, endTime })`
- `getPerpRecentTrades({ coin })`
- `getPerpPredictedFundings({ coin })`
- `getPerpAnnotation({ coin })`
- `getPerpsAtOpenInterestCap()`

其中：

- `overview` 可以优先复用当前 WebSocket 上下文 + meta cache
- `fundingHistory` / `recentTrades` / `predictedFundings` / `annotation` 走 REST
- `recentTrades` 第一版建议只在面板可见时轮询，不要默认全局常驻刷新

### 9.2 缓存策略

建议按模块拆缓存，不要一个大接口全绑死：

| 模块 | 建议刷新策略 |
| --- | --- |
| Overview | 直接用当前实时 WS 数据 |
| Funding History | 进入页面拉一次，切时间范围再拉 |
| Predicted Funding | 30~60s TTL |
| Annotation / Contract | 进页面拉一次，长 TTL |
| Recent Trades | 面板可见时 2~3s polling，后续再评估 WS |

### 9.3 前端状态层

建议新增单独 hook，而不是继续把逻辑堆进现有 Ticker / OrderBook：

- `usePerpMarketOverview`
- `usePerpFundingHistory`
- `usePerpRecentTrades`
- `usePerpMarketDetail`

避免以下问题：

- TickerBar 继续膨胀
- OrderBook 组件承担过多信息聚合逻辑
- 移动端和桌面端无法共享 detail 数据层

### 9.4 组件建议

建议新建目录：

- `packages/kit/src/views/Perp/components/MarketDetail/`

拆成：

- `PerpMarketDetailDrawer`
- `PerpMarketOverviewCards`
- `PerpFundingPanel`
- `PerpRecentTradesPanel`
- `PerpContractPanel`
- `PerpAboutPanel`

如果想减少重复代码，可以把以下内容从 `MarketDetailV2` 抽成通用组件：

- 比例条
- 信息卡片
- tabs header 样式

## 10. 指标命名建议

为了避免误导，建议严格控制文案：

- 可以叫：
  - `Buy / Sell Flow`
  - `Depth Imbalance`
  - `Funding Compare`
  - `Premium`
- 不建议叫：
  - `Top Trader Long/Short Ratio`
  - `Account Long/Short Ratio`
  - `Taker Buy/Sell Ratio`

除非我们真的接了对应官方源。

## 11. 推荐分阶段落地

### Phase 1：只做 Hyperliquid 原生强项

- Overview
- Funding
- Trades
- Contract
- About

这是最稳的第一版，也最符合“数据要准确”的目标。

### Phase 2：补推导统计

- Rolling Buy / Sell Flow
- OI Notional
- Spread / Depth Imbalance
- Funding APR Estimate

这些都要明确写清楚计算口径。

### Phase 3：可选第三方 Token Info

- 项目简介
- 官网 / 社媒
- Market Cap / FDV / Supply

这一层一定要：

- 单独数据源标记
- 单独错误态 / 降级态
- 不跟 Hyperliquid 原生指标混在一起

## 12. 最终建议

如果目标是“让用户更方便拿到准确交易数据”，最推荐的路径是：

1. **先做 Hyperliquid 原生 market data 面板，不碰第三方基本面。**
2. **桌面端用 chart 下方 drawer，移动端挂到 `MobilePerpMarket` 下方。**
3. **用“Overview / Funding / Trades / Contract / About”这 5 个模块做 MVP。**
4. **所有推导指标都明确标注口径，不使用 Binance / OKX 的官方指标命名。**

这样做的好处是：

- 信息足够有用
- 数据口径可解释
- 不会因为“想做全”而把准确性做坏
- 技术上也能最大化复用当前 Perp 与 MarketDetailV2 的已有资产

## 13. 参考来源

- Hyperliquid Info API docs:
  - https://hyperliquid.gitbook.io/hyperliquid-docs/for-developers/api/info-endpoint/perpetuals
  - https://hyperliquid.gitbook.io/hyperliquid-docs/for-developers/api/info-endpoint
- Hyperliquid SDK typings:
  - `node_modules/@nktkas/hyperliquid/esm/api/info/_methods/metaAndAssetCtxs.d.ts`
  - `node_modules/@nktkas/hyperliquid/esm/api/info/_methods/fundingHistory.d.ts`
  - `node_modules/@nktkas/hyperliquid/esm/api/info/_methods/recentTrades.d.ts`
  - `node_modules/@nktkas/hyperliquid/esm/api/info/_methods/predictedFundings.d.ts`
  - `node_modules/@nktkas/hyperliquid/esm/api/info/_methods/perpAnnotation.d.ts`
  - `node_modules/@nktkas/hyperliquid/esm/api/info/_methods/perpsAtOpenInterestCap.d.ts`
- Binance Futures 参考页：
  - https://www.binance.com/zh-CN/futures/BTCUSDT
- OKX Swap 参考页：
  - https://www.okx.com/zh-hans/trade-swap/btc-usdt-swap#workspaceId=-4
