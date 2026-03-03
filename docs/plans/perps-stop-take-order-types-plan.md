# Perps Stop/Take 方案说明（产品 + 前后端实现）

## 0. Agent Execution Brief (for Codex / Claude)

### 0.1 Primary Task
Implement first-class Trigger order UX + order payload mapping for:

1. Stop Market
2. Stop Limit
3. Take Market
4. Take Limit

Do not regress existing Market/Limit and attached TP/SL flows.

### 0.2 Inputs / Context

1. Existing trading form currently centered on `market|limit` + attached TP/SL.
2. Hyperliquid service already supports order payload construction; trigger path is partially hardcoded.
3. This document defines product behavior and payload mapping.

### 0.3 Required Outputs

1. UI behavior aligned with section 3.
2. Trigger payload mapping aligned with section 5.
3. ReduceOnly and liq-price display policy aligned with section 4.
4. Validation and submit behavior aligned with section 6.
5. Regression-safe implementation with clear PR diff.

### 0.4 Hard Constraints

1. No TWAP/Scale trading capability in this phase.
2. Avoid unrelated refactors.
3. Keep existing Market/Limit and attached TP/SL path functional.
4. If uncertain, prefer explicit TODO comments over hidden assumptions.

### 0.5 Definition of Done

1. All items in section 7 pass.
2. Trigger order payload fields are inspectable and correct (`b/isMarket/tpsl/triggerPx/p/r`).
3. UI state transitions (Long/Short, Stop/Take, ReduceOnly) are deterministic and testable.

## 1. 目标与范围
本期目标是在 Trading Form 中将以下 4 类触发单做成一等下单类型（非附带 TP/SL）：

1. `Stop Market`
2. `Stop Limit`
3. `Take Market`
4. `Take Limit`

保留现有能力且不回归：

1. `Market`
2. `Limit`
3. 现有“附带 TP/SL”链路

不在本期：

1. `TWAP`
2. `Scale`

---

## 2. 关键产品语义（必须统一）

### 2.1 Trigger 文案含义
`Trigger when Mark Price <= Trigger Price` 的含义：

1. 当 `Mark Price <= 用户设置的 Trigger Price` 时触发订单。

为什么使用 Mark Price：

1. 降低使用 Last Price 的短时插针误触发。
2. 与强平/风控口径一致，行为更稳定。

### 2.2 多空 + 止盈止损触发方向
建议产品自动决定触发方向，不给用户手动改“>= / <=”。

| 持仓/方向 | 意图 | 触发条件 |
|---|---|---|
| Long | Stop | Mark <= Trigger |
| Long | Take | Mark >= Trigger |
| Short | Stop | Mark >= Trigger |
| Short | Take | Mark <= Trigger |

### 2.3 四种订单类型行为

1. `Stop Market`：触发后按市价执行（成交价不确定，受滑点影响）。
2. `Stop Limit`：触发后挂限价单（可能挂出不成交）。
3. `Take Market`：触发后按市价执行。
4. `Take Limit`：触发后挂限价单。

---

## 3. UI/交互规范（本次讨论确认）

### 3.1 顶部结构
参考 HL/BN 风格：

1. 先显示 `Margin Mode + Leverage`
2. 再显示 `Market / Limit / Trigger(下拉当前类型)`

### 3.2 字段可见性

1. `Market`：Size
2. `Limit`：Price + Size
3. `Stop Market / Take Market`：Trigger Price + Size
4. `Stop Limit / Take Limit`：Trigger Price + Price(执行价) + Size
5. Trigger 模式下不展示原 `BBO` 价格切换按钮
6. Trigger 模式下价格输入统一沿用现有 `PriceInput` 组件

### 3.3 Reduce Only 与 TP/SL 区块

1. 在 Trigger 类型下，显示 `Reduce Only` 开关。
2. Trigger 类型下不显示原 TP/SL 输入区。
3. 非 Trigger（Market/Limit）保留原 TP/SL 行为。
4. Trigger 类型建议 `Reduce Only` 默认开启（可被用户关闭）。

### 3.4 Trigger 说明行
当前产品决定移除表单内固定提示句（`Trigger when ...`）文案展示，保留内部逻辑。

### 3.5 移动端交互

1. 移动端订单类型统一放在 `Order Type selector`（底部弹层）内。
2. selector 需包含：
   - `Market`
   - `Limit`
   - `Stop Market`
   - `Stop Limit`
   - `Take Market`
   - `Take Limit`
3. 移动端不使用桌面端顶部 tab + trigger 下拉组合样式。

### 3.6 桌面端布局细节

1. 先 `Margin Mode + Leverage`，后 `Market/Limit/Trigger`。
2. 保持交易面板顶部 padding。
3. 缩小 `Margin Mode` 行与订单类型行之间的 gap（避免视觉空洞）。

---

## 4. 强平价与成本展示策略（重要）

### 4.1 成本（Cost）计算
前端当前口径：

1. `orderValue = size * effectivePrice`
2. `marginRequired = orderValue / leverage`

代码参考：

1. `packages/kit/src/views/Perp/hooks/useTradingCalculationsForSide.ts`

### 4.2 预估强平价计算
当前由统一函数估算（非链上最终值）：

1. `useLiquidationPrice -> calculateLiquidationPrice`
2. 核心公式：`Liq = Entry - side * MarginAvailable / Size / (1 - mmr * side)`
3. `mmr` 基于 margin tier 推导
4. 区分 isolated / cross
5. 会考虑“已有仓位 + 新订单”的合并效果（加仓/减仓/反手）

代码参考：

1. `packages/kit/src/views/Perp/hooks/useLiquidationPrice.ts`
2. `packages/shared/src/utils/perpsUtils.ts`

### 4.3 Trigger 单为什么会看到强平价
关键点：要区分 `Reduce Only`。

1. `ReduceOnly = false`：触发后可能开新仓/反手，展示“触发后预估强平价”合理。
2. `ReduceOnly = true`：本质是减仓/平仓，理论上不应强调新仓位强平价。

建议产品口径：

1. Trigger + `ReduceOnly=true`：预估强平价显示 `--` 或隐藏。
2. Trigger + `ReduceOnly=false`：显示 `Est. Liq Price (if triggered)`。

### 4.4 为什么 Stop Market 也能显示强平价

1. 可显示的是“触发后仓位”的预估强平价，不是当前未触发状态的真实强平价。
2. `Stop Market` 成交价不确定（受深度/滑点影响），因此预估误差大于 `Stop Limit/Take Limit`。
3. 建议文案带估算语义：`预估强平价（触发后）`。

---

## 5. Hyperliquid 接口映射（下单核心）

### 5.1 当前 HL 下单参数关键字段

1. `b`: 买卖方向（`true=Buy/Long`, `false=Sell/Short`）
2. `t.trigger.isMarket`: `true=Stop/Take Market`, `false=Stop/Take Limit`
3. `t.trigger.tpsl`: `'sl'` 或 `'tp'`
4. `t.trigger.triggerPx`: 触发价
5. `p`: 执行价（Limit 必填；Market 可用滑点保护价）
6. `r`: `reduceOnly`

### 5.2 Long / Short 点击在接口层的差异
本质是 `b` 的变化，以及 market 执行保护价方向变化。

1. 点 Long：`b=true`
2. 点 Short：`b=false`
3. 如果是 market 触发执行，滑点保护价方向也随 `b` 变化（buy 上调、sell 下调）

### 5.3 四类 Trigger 到 payload 的映射

1. `Stop Market`
   - `t.trigger = { isMarket: true, tpsl: 'sl', triggerPx }`
2. `Stop Limit`
   - `t.trigger = { isMarket: false, tpsl: 'sl', triggerPx }`
   - `p = executionPx`
3. `Take Market`
   - `t.trigger = { isMarket: true, tpsl: 'tp', triggerPx }`
4. `Take Limit`
   - `t.trigger = { isMarket: false, tpsl: 'tp', triggerPx }`
   - `p = executionPx`

### 5.4 Reduce Only 映射

1. UI `Reduce Only` -> payload `r`
2. `r=true` 时仅允许减仓/平仓，不应增加净仓位
3. `r=false` 时允许开仓、加仓、反手

### 5.5 与现有附带 TP/SL 路径区别

1. 现有附带 TP/SL 是“开仓主单 + 附带平仓触发单”，附带单方向常用 `!isBuy`
2. 一等 Trigger 下单是“用户主动下触发单”，方向应直接由 Long/Short 映射到 `b`
3. 不可直接复用附带 TP/SL 的反向方向语义

---

## 6. 校验与提交流程

### 6.1 通用校验

1. `size > 0`
2. 所有价格字段必须是有限正数
3. 精度校验遵循 `szDecimals` 和现有价格输入规则

### 6.2 Trigger 方向校验（相对参考价）
参考价建议用 `Mark Price`。

1. Long + Stop：`trigger < mark`
2. Long + Take：`trigger > mark`
3. Short + Stop：`trigger > mark`
4. Short + Take：`trigger < mark`

### 6.3 Limit Trigger 额外校验

1. `Stop Limit/Take Limit` 必填执行价 `p`
2. `p` 需满足数值合法和精度合法

### 6.4 提交流程建议

1. 组装 payload
2. 前端预校验
3. 风险提示（可选）
4. 提交下单
5. 结果回填（成功/失败 toast、open orders 刷新）

---

## 7. 数据模型与状态管理建议

1. form type 增强：支持 6 种订单类型（market/limit/stopMarket/stopLimit/takeMarket/takeLimit）
2. Trigger 字段：
   - `triggerPx`
   - `executionPx`（仅 limit trigger）
   - `reduceOnly`
3. 不破坏现有 TP/SL 字段，保持向后兼容
4. 移动端与桌面端共用同一份 order type 枚举，避免分叉

---

## 8. 代码落点（建议）

1. Form 状态与计算：
   - `packages/kit/src/states/jotai/contexts/hyperliquid/atoms.ts`
   - `packages/kit/src/views/Perp/hooks/useTradingCalculationsForSide.ts`
   - `packages/kit/src/views/Perp/hooks/useLiquidationPrice.ts`
2. Trading Form UI：
   - `packages/kit/src/views/Perp/components/TradingPanel/panels/PerpTradingForm.tsx`
3. 下单服务：
   - `packages/kit-bg/src/services/ServiceHyperLiquid/ServiceHyperliquidExchange.ts`
4. 类型定义：
   - `packages/shared/types/hyperliquid/types.ts`

---

## 9. 验收清单（产品 + 开发）

1. 4 种 Trigger 类型字段显示正确。
2. Long/Short 切换后触发方向与默认 trigger 值方向正确反转。
3. Trigger 下显示 Reduce Only，非 Trigger 显示 TP/SL。
4. Stop/Take Limit 正确传 `isMarket:false` 且带 `p`。
5. Stop/Take Market 正确传 `isMarket:true`。
6. ReduceOnly=true 场景下强平价展示符合产品策略（隐藏或 `--`）。
7. 移动端 selector 包含全部 6 种类型。
8. 桌面端布局间距符合产品要求（顶部 padding 保持，逐仓行与订单类型行间距收敛）。
9. 不回归现有 Market/Limit 下单与附带 TP/SL。
10. Open Orders 类型展示正确。

---

## 10. PR 建议拆分

1. PR-1：数据模型与类型扩展（不改行为）
2. PR-2：桌面/移动端 Trigger UI 与字段切换
3. PR-3：Service payload 映射与提交链路
4. PR-4：校验、文案、强平价展示策略
5. PR-5：测试与回归

---

## 11. 测试建议（最小集）

1. 6 种类型逐一提交流程（含失败路径）
2. Long/Short 各测一遍 Trigger 方向校验
3. ReduceOnly true/false 对强平价展示与提交结果影响
4. StopLimit/TakeLimit 执行价合法性校验
5. 移动端 selector 选择后字段联动
6. 桌面端样式对齐与无误触
