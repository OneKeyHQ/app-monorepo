# TradingView Native 副图指标算法

本文记录旧 WebView TradingView Native Controls 中 13 个副图指标的算法，用于后续在 `TradingViewNative` 中实现时保持数值和默认行为一致。

研究日期：2026-08-19。

## 1. 兼容目标

旧控制器并没有在 App 内实现这些算法。它把指标名称映射到 TradingView Charting Library 的内置 Study，然后调用：

```ts
chart.createStudy(studyName, false, false);
```

调用没有传入自定义参数，因此本文的兼容目标是：

1. 使用旧控制器映射到的同一个内置 Study。
2. 使用当前 Charting Library bundle 的默认参数和实际计算方式。
3. TradingView 官方文档只作为公式解释；当官方通用说明与项目 bundle 不同时，以项目 bundle 为准。

“数值一致”指有限、合法 OHLCV 输入在指标完成 warm-up 后的输出一致。旧 bundle 对缺历史、零成交量等异常输入存在依赖 JavaScript `NaN`/`Infinity` 传播的细节；Native 实现按第 2.2 节统一收敛为 `null`，这是有意的安全边界，不要求复刻这些异常值。

核对基线：

- OneKey TradingView chart commit：`7511e31329e35acd104d97c1b820e6157fbd6dc8`
- 控制器映射：[NativeChartControlsManager.ts](https://github.com/OneKeyHQ/tradingview-charting-library/blob/7511e31329e35acd104d97c1b820e6157fbd6dc8/src/widget/managers/NativeChartControlsManager.ts)
- Study 实现：该 commit 中 `public/charting_library/bundles/library.da96fe4a247adfea0ad8.js`
- App 中未来设置页的 mock 数据：[TradingViewSettingsMockState.ts](../../../TradingViewChartControls/chartSettings/TradingViewSettingsMockState.ts)

### 1.1 名称映射

| App 名称 | Charting Library Study | 说明 |
| --- | --- | --- |
| `VOL` | `Volume` | 成交量柱 |
| `MACD` | `MACD` | 指数平滑异同移动平均线 |
| `RSI` | `Relative Strength Index` | 相对强弱指标 |
| `StochRSI` | `Stochastic RSI` | 随机 RSI |
| `OBV` | `On Balance Volume` | 能量潮 |
| `MFI` | `Money Flow Index` | 资金流量指数 |
| `TRIX` | `TRIX` | 三重指数平滑动量 |
| `EMV` | `Ease Of Movement` | App 名称为 EMV，Study 名称及常用缩写为 EOM |
| `WR` | `Williams %R` | 威廉指标 |
| `ROC` | `Rate Of Change` | 价格变化率 |
| `MTM` | `Momentum` | 动量值 |
| `DMI` | `Directional Movement Index` | 方向与趋势强度 |
| `CCI` | `Commodity Channel Index` | 顺势指标 |

## 2. 输入和公共计算约定

第 `t` 根 K 线使用：

```text
O[t] = open
H[t] = high
L[t] = low
C[t] = close
V[t] = volume
TP[t] = (H[t] + L[t] + C[t]) / 3
HL2[t] = (H[t] + L[t]) / 2
change(X)[t] = X[t] - X[t - 1]
```

K 线必须按时间升序排列，并在计算前按 timestamp 去重。内部计算保持 JavaScript `number` 的完整精度，只在 UI 格式化阶段舍入。

### 2.1 公共移动平均

简单移动平均：

```text
SMA(X, n)[t] = sum(X[t - n + 1 ... t]) / n
```

指数移动平均使用前 `n` 个有效值的 SMA 作为首值，之后使用：

```text
alpha = 2 / (n + 1)
EMA(X, n)[t] = alpha * X[t] + (1 - alpha) * EMA(X, n)[t - 1]
```

Wilder 移动平均在 bundle 中名为 `RMA`，同样使用首个 SMA 初始化：

```text
RMA(X, n)[t] = (X[t] + (n - 1) * RMA(X, n)[t - 1]) / n
```

等价平滑系数为 `1 / n`。RSI 和 DMI 必须使用 `RMA`，不能替换为普通 EMA。

Bundle 的 RSI/MFI 比值 helper 判断浮点数是否为零时使用 `1e-10` 容差，因此这两个指标保留该规则。ROC、MTM、WR、CCI、EMV、StochRSI 和 DMI 的原始公式只对精确的 `0` 产生特殊结果；极小但非零的价格或区间仍必须参与计算，最终再统一过滤非有限结果。

### 2.2 无效值

Native 实现统一使用 `null` 表示尚未形成或无法计算的点，不允许把 `NaN`、`Infinity` 或 `-Infinity` 传入布局和渲染层。

除下文明确给出特殊规则外，出现以下情况时输出 `null`：

- 历史长度不足。
- 输入 OHLCV 不是有限数。
- 公式分母为 `0`。
- 对数输入小于或等于 `0`。

不要用 `0` 代替缺失历史，否则会改变 EMA、RMA 和累计指标的结果。

## 3. 默认参数汇总

| 指标 | Bundle 默认参数 | 默认可见输出 |
| --- | --- | --- |
| `VOL` | Volume MA 为 `SMA(20)`；其平滑线为 `SMA(9)`，两者默认隐藏 | Volume 柱 |
| `MACD` | Fast `12`，Slow `26`，Signal `9`，均为 EMA，source=`close` | Histogram、MACD、Signal |
| `RSI` | Length `14` | RSI；额外 SMA(14) 默认隐藏 |
| `StochRSI` | RSI `14`，Stoch `14`，K `3`，D `3` | `%K`、`%D` |
| `OBV` | 无主周期 | OBV；额外 SMA(9) 默认隐藏 |
| `MFI` | Length `14` | MFI |
| `TRIX` | Length `18` | TRIX |
| `EMV` | Divisor `10,000`，Length `14` | EOM |
| `WR` | Length `14` | `%R` |
| `ROC` | Length `9` | ROC |
| `MTM` | Length `10`，source=`close` | Momentum |
| `DMI` | DI Length `14`，ADX Smoothing `14` | `+DI`、`-DI`、`DX`、`ADX`、`ADXR` |
| `CCI` | Length `20` | CCI；额外 SMA(20) 默认隐藏 |

## 4. 指标算法

### 4.1 VOL

默认输出就是当前 K 线的成交量：

```text
VOL[t] = V[t]
```

默认柱色基于当前蜡烛方向，而不是与前一根收盘价比较：

```text
C[t] >= O[t]  => Growing
C[t] <  O[t]  => Falling
```

Bundle 还提供默认隐藏的成交量均线：

```text
VOL_MA[t] = SMA(V, 20)[t]
```

以及对 Volume MA 再做一次默认隐藏的平滑：

```text
Smoothed_VOL_MA[t] = SMA(VOL_MA, 9)[t]
```

实现说明：`VOL` 只使用独立副图模式。主图内嵌成交量始终关闭；选择 `VOL` 后由它自己的 definition、settings、palette 和 pane scene 绘制，关闭后不保留任何可见成交量区域。

参考：[TradingView Average Volume](https://www.tradingview.com/support/solutions/43000745917-how-do-we-calculate-average-volume/)。

### 4.2 MACD

默认参数为 `12 / 26 / 9`，全部使用 EMA，输入为收盘价：

```text
Fast[t] = EMA(C, 12)[t]
Slow[t] = EMA(C, 26)[t]
DIF[t] = Fast[t] - Slow[t]
DEA[t] = EMA(DIF, 9)[t]
Histogram[t] = DIF[t] - DEA[t]
```

输出名称对应关系：

| 常见中文行情名称 | TradingView 输出 |
| --- | --- |
| DIF | MACD line |
| DEA | Signal line |
| MACD 柱 | Histogram |

兼容要点：Histogram **不乘以 2**。部分行情软件使用 `2 * (DIF - DEA)`，但这不符合旧 Charting Library Study。

Histogram 的四色 palette 同时取决于正负和相对前值的方向：正值上升/不升分别使用索引 `0/1`，非正值上升/不升分别使用 `2/3`。首个有效 Histogram 没有可比较的前值时，Bundle 走“上升”分支，即正值为 `0`、非正值为 `2`。

参考：[TradingView MACD](https://www.tradingview.com/support/solutions/43000502344-moving-average-convergence-divergence-macd-indicator/)。

### 4.3 RSI

默认周期为 `14`，输入为收盘价：

```text
Delta[t] = C[t] - C[t - 1]
Gain[t] = max(Delta[t], 0)
Loss[t] = max(-Delta[t], 0)
AvgGain[t] = RMA(Gain, 14)[t]
AvgLoss[t] = RMA(Loss, 14)[t]
RS[t] = AvgGain[t] / AvgLoss[t]
RSI[t] = 100 - 100 / (1 + RS[t])
```

Bundle 的边界规则：

```text
AvgLoss == 0 => RSI = 100
AvgLoss != 0 && AvgGain == 0 => RSI = 0
```

因此，当两个平均值同时为 `0` 时也返回 `100`，不要擅自改成 `50`。默认参考线为 `70 / 50 / 30`。Bundle 还计算 `SMA(RSI, 14)`，但该线默认隐藏。

参考：[TradingView RSI](https://www.tradingview.com/support/solutions/43000502338-relative-strength-index-rsi/)。

### 4.4 StochRSI

先按上一节计算 `RSI(14)`，再计算 RSI 在最近 14 个值中的相对位置：

```text
LowestRSI[t] = lowest(RSI, 14)[t]
HighestRSI[t] = highest(RSI, 14)[t]
Raw[t] = 100 * (RSI[t] - LowestRSI[t])
               / (HighestRSI[t] - LowestRSI[t])
K[t] = SMA(Raw, 3)[t]
D[t] = SMA(K, 3)[t]
```

兼容要点：

- Bundle 输出范围为 `0 ... 100`，不是官方说明中有时使用的 `0 ... 1` 表示法。
- 当 14 个 RSI 全部相等、分母为 `0` 时，Bundle 的 `fixnan` 会沿用上一个有效 Raw 值；若此前没有有效值，则输出 `null`。
- 默认参考线为 `80 / 20`。

参考：[TradingView Stochastic RSI](https://www.tradingview.com/support/solutions/43000502333-stochastic-rsi-stoch-rsi/)。

### 4.5 OBV

OBV 根据收盘价方向累计成交量：

```text
Contribution[t] =
  V[t],   if C[t] > C[t - 1]
 -V[t],   if C[t] < C[t - 1]
  0,      if C[t] == C[t - 1]

OBV[0] = 0
OBV[t] = OBV[t - 1] + Contribution[t]
```

OBV 的绝对起点不影响曲线形态，但 Native 实现固定从 `0` 开始，便于跨端快照测试。Bundle 还计算 `SMA(OBV, 9)`，默认隐藏。

历史分页注意：如果后来向时间轴前方补入更早 K 线，必须从新历史起点重新累计；不能只把旧 OBV 数组向右平移。

参考：[TradingView OBV](https://www.tradingview.com/support/solutions/43000502593-on-balance-volume-obv/)。

### 4.6 MFI

默认周期为 `14`：

```text
TP[t] = (H[t] + L[t] + C[t]) / 3
RawMoneyFlow[t] = TP[t] * V[t]

PositiveFlow[t] = RawMoneyFlow[t], if TP[t] > TP[t - 1], else 0
NegativeFlow[t] = RawMoneyFlow[t], if TP[t] < TP[t - 1], else 0

PositiveSum[t] = sum(PositiveFlow, 14)[t]
NegativeSum[t] = sum(NegativeFlow, 14)[t]
MoneyRatio[t] = PositiveSum[t] / NegativeSum[t]
MFI[t] = 100 - 100 / (1 + MoneyRatio[t])
```

当两个 Typical Price 相等时，当前 Raw Money Flow 不计入正向或负向流量。Bundle 的边界规则为：

```text
NegativeSum == 0 => MFI = 100
NegativeSum != 0 && PositiveSum == 0 => MFI = 0
```

Bundle 的 rolling `sum` 会在不足 14 个流量值时给出部分窗口结果，且首根没有前序 Typical Price 的 K 线会同时进入正、负流量，使首值通常为 `50`。Native 实现按统一 warm-up 规则，在形成完整 14 个方向流量前返回 `null`；从首个完整窗口开始，两者公式完全一致。

默认参考线为 `80 / 20`。

参考：[TradingView MFI](https://www.tradingview.com/support/solutions/43000502348-money-flow-mfi/)。

### 4.7 TRIX

旧 bundle 的实际实现与常见的 TRIX 教科书公式存在细微差异。为了数值兼容，必须先对收盘价取自然对数，再进行三次 EMA：

```text
LogClose[t] = ln(C[t])
EMA1[t] = EMA(LogClose, 18)[t]
EMA2[t] = EMA(EMA1, 18)[t]
EMA3[t] = EMA(EMA2, 18)[t]
TRIX[t] = 10,000 * (EMA3[t] - EMA3[t - 1])
```

兼容要点：

- `C[t] <= 0` 时输出 `null`。
- 不要替换成常见的 `100 * (EMA3[t] / EMA3[t - 1] - 1)`。
- Bundle 只输出 TRIX 一条线，没有 MATRIX/Signal 线。

TradingView 官方说明将 TRIX 概括为三重 EMA 的单周期变化率；上面的对数和 `10,000` 倍率来自项目实际 bundle，应作为数值对齐依据。

参考：[TradingView TRIX](https://www.tradingview.com/support/solutions/43000502331-trix/)。

### 4.8 EMV / EOM

App 使用 `EMV` 名称，旧控制器实际创建 `Ease Of Movement` Study。默认 `Divisor = 10,000`、平滑周期 `14`：

```text
Midpoint[t] = (H[t] + L[t]) / 2
Distance[t] = Midpoint[t] - Midpoint[t - 1]
Range[t] = H[t] - L[t]
RawEOM[t] = 10,000 * Distance[t] * Range[t] / V[t]
EOM[t] = SMA(RawEOM, 14)[t]
```

该公式也可以写成：

```text
BoxRatio[t] = (V[t] / 10,000) / Range[t]
RawEOM[t] = Distance[t] / BoxRatio[t]
```

`V[t] == 0` 时输出 `null`。Bundle 只有一条 EOM 线，没有 MAEMV 信号线。

参考：[TradingView Ease of Movement](https://www.tradingview.com/support/solutions/43000502256-ease-of-movement-eom/)。

### 4.9 WR / Williams %R

默认周期为 `14`：

```text
HH[t] = highest(H, 14)[t]
LL[t] = lowest(L, 14)[t]
WR[t] = 100 * (C[t] - HH[t]) / (HH[t] - LL[t])
```

等价写法为：

```text
WR[t] = -100 * (HH[t] - C[t]) / (HH[t] - LL[t])
```

结果通常位于 `-100 ... 0`，默认参考线为 `-80 / -20`。当 `HH == LL` 时输出 `null`。Bundle 只有一条周期为 14 的 `%R`，没有 WR1/WR2 双线。

参考：[TradingView Williams %R](https://www.tradingview.com/support/solutions/43000501985-williams-r-r/)。

### 4.10 ROC

默认周期为 `9`，输入为收盘价：

```text
ROC[t] = 100 * (C[t] - C[t - 9]) / C[t - 9]
```

当 `C[t - 9] == 0` 时输出 `null`。Bundle 只有 ROC 主线，没有 MAROC 均线。

参考：[TradingView ROC](https://www.tradingview.com/support/solutions/43000502343-rate-of-change-roc/)。

### 4.11 MTM / Momentum

默认周期为 `10`，输入为收盘价：

```text
MTM[t] = C[t] - C[t - 10]
```

MTM 是绝对价格差，ROC 是百分比变化，两者不能复用同一输出尺度。当历史收盘价不存在或等于 `0` 时，按 bundle 行为输出 `null`。Bundle 没有 MAMTM 均线。

参考：[TradingView Momentum](https://www.tradingview.com/support/solutions/43000589187-momentum/)。

### 4.12 DMI

默认 `DI Length = 14`、`ADX Smoothing = 14`。先计算方向变化和 True Range：

```text
UpMove[t] = H[t] - H[t - 1]
DownMove[t] = L[t - 1] - L[t]

PlusDM[t] = UpMove[t],
  if UpMove[t] > DownMove[t] and UpMove[t] > 0,
  else 0

MinusDM[t] = DownMove[t],
  if DownMove[t] > UpMove[t] and DownMove[t] > 0,
  else 0

TR[t] = max(
  H[t] - L[t],
  abs(H[t] - C[t - 1]),
  abs(L[t] - C[t - 1])
)
```

然后使用 Wilder RMA：

```text
ATR[t] = RMA(TR, 14)[t]
PlusDI[t] = 100 * RMA(PlusDM, 14)[t] / ATR[t]
MinusDI[t] = 100 * RMA(MinusDM, 14)[t] / ATR[t]

DISum[t] = PlusDI[t] + MinusDI[t]
DX[t] = 100 * abs(PlusDI[t] - MinusDI[t]) / DISum[t]
ADX[t] = RMA(DX, 14)[t]
ADXR[t] = (ADX[t] + ADX[t - 13]) / 2
```

兼容要点：

- 第 `0` 根没有前一根 K 线，`TR`、`PlusDM` 和 `MinusDM` 都是 `null`，不能用 `H - L` 和两个 `0` 提前初始化 RMA。默认周期下 `DI / ADX / ADXR` 首个有效下标分别为 `14 / 27 / 40`。
- 当 `PlusDI + MinusDI == 0` 时，Bundle 通过安全分母得到 `DX = 0`。
- `PlusDI`、`MinusDI` 在临时无法计算时沿用上一个有效值；此前没有有效值则为 `null`。
- Bundle 输出五条线：`+DI`、`-DI`、`DX`、`ADX`、`ADXR`。不能只实现现代 TradingView UI 中常见的三条线。
- ADXR 使用 `ADX[t - (DI Length - 1)]`；默认周期下是 `t - 13`，这是 bundle 的实际实现。

参考：[TradingView DMI](https://www.tradingview.com/support/solutions/43000502250-directional-movement-dmi/)、[TradingView ADX](https://www.tradingview.com/support/solutions/43000589099-average-directional-index-adx/)。

### 4.13 CCI

Bundle 固定使用 Typical Price，默认周期为 `20`：

```text
TP[t] = (H[t] + L[t] + C[t]) / 3
Basis[t] = SMA(TP, 20)[t]

MeanDeviation[t] =
  sum(abs(TP[i] - Basis[t]), i = t - 19 ... t) / 20

CCI[t] = (TP[t] - Basis[t]) / (0.015 * MeanDeviation[t])
```

这里是平均绝对偏差，不是标准差。`MeanDeviation == 0` 时输出 `null`。默认参考线为 `+100 / -100`。Bundle 还计算 `SMA(CCI, 20)`，但默认隐藏。

TradingView 当前帮助页提到可配置 source，但项目 bundle 的 Study 实际固定为 `HLC3`；为兼容旧图表，应使用 `TP`。

参考：[TradingView CCI](https://www.tradingview.com/support/solutions/43000502001-commodity-channel-index-cci/)。

## 5. 与 App 设置 Mock 的差异

`TradingViewSettingsMockState.ts` 是设置 UI mock，并不是旧 WebView 指标的算法事实来源。它与旧 Charting Library 默认值存在以下差异：

| 指标 | 旧 Charting Library | 设置 Mock |
| --- | --- | --- |
| `VOL` | Volume；MA(20) 默认隐藏 | MA1(5)、MA2(10)，副图默认关闭均线 |
| `RSI` | RSI(14) 单主线 | RSI1(6)、RSI2(12)、RSI3(24) |
| `OBV` | OBV；SMA(9) 默认隐藏 | OBV + MAOBV(30) |
| `TRIX` | TRIX(18) 单线 | TRIX(12) + MATRIX(9) |
| `EMV` | Divisor(10,000)、EOM(14) 单线 | EMV(14) + MAEMV(9) |
| `WR` | WR(14) 单线 | WR1(10) + WR2(6) |
| `ROC` | ROC(9) 单线 | ROC(12) + MAROC(6) |
| `MTM` | MTM(10) 单线 | MTM(12) + MAMTM(6) |
| `DMI` | DI(14)、ADX(14)，五条输出 | N(14)、MM(6) 的设计稿口径 |
| `CCI` | CCI(20) | CCI(14) |

`MACD(12, 26, 9)`、`StochRSI(14, 14, 3, 3)` 和 `MFI(14)` 的核心参数一致。

如果产品目标是复刻旧 WebView，使用本文第 3、4 节的参数。如果目标改为实现设置 Mock，则应另开需求明确参数、输出线和迁移策略，不能在实现过程中混用两套定义。

## 6. Native 实现和验证要求

### 6.1 计算接口

每个指标计算器应保持纯函数，并返回与输入 K 线等长的数组：

```ts
type IIndicatorValues = Array<number | null>;
```

多输出指标返回具名 series，避免依赖数组下标：

```ts
interface ISubIndicatorSeries {
  key: string;
  values: Array<number | null>;
}
```

不要把配色、线宽、布局高度混入算法层。

### 6.2 历史与实时更新

- 首次加载、切换周期和向前补历史后，使用全部有序 K 线重算。
- 实时 K 线可能反复更新同一个 timestamp；不能把每次更新都当成新 bar 推进 EMA/RMA 状态。
- 若后续改为增量计算，需要保存“上一根已结束 bar 状态”和“当前可回滚 bar 状态”，并用全量计算测试验证一致性。
- OBV 等累计指标在补入更早历史后必须重算完整累计值。

### 6.3 必测数据

每个指标至少覆盖：

1. 单调上涨数据。
2. 单调下跌数据。
3. 完全横盘数据。
4. 含跳空的 OHLC 数据。
5. `V == 0` 和 `H == L`。
6. 刚好不足周期、刚好满足周期和长历史。
7. 最后一根实时 K 线重复更新。
8. 向前补历史后全量结果稳定。

数值测试应保存来自当前 Charting Library bundle 的参考输出，并比较所有有效点。算法层建议使用 `1e-10` 量级的绝对或相对误差；UI 显示精度不应反向影响计算精度。

## 7. 官方参考资料

- [Moving Average Convergence Divergence](https://www.tradingview.com/support/solutions/43000502344-moving-average-convergence-divergence-macd-indicator/)
- [Relative Strength Index](https://www.tradingview.com/support/solutions/43000502338-relative-strength-index-rsi/)
- [Stochastic RSI](https://www.tradingview.com/support/solutions/43000502333-stochastic-rsi-stoch-rsi/)
- [On Balance Volume](https://www.tradingview.com/support/solutions/43000502593-on-balance-volume-obv/)
- [Money Flow Index](https://www.tradingview.com/support/solutions/43000502348-money-flow-mfi/)
- [TRIX](https://www.tradingview.com/support/solutions/43000502331-trix/)
- [Ease of Movement](https://www.tradingview.com/support/solutions/43000502256-ease-of-movement-eom/)
- [Williams %R](https://www.tradingview.com/support/solutions/43000501985-williams-r-r/)
- [Rate of Change](https://www.tradingview.com/support/solutions/43000502343-rate-of-change-roc/)
- [Momentum](https://www.tradingview.com/support/solutions/43000589187-momentum/)
- [Directional Movement](https://www.tradingview.com/support/solutions/43000502250-directional-movement-dmi/)
- [Average Directional Index](https://www.tradingview.com/support/solutions/43000589099-average-directional-index-adx/)
- [Commodity Channel Index](https://www.tradingview.com/support/solutions/43000502001-commodity-channel-index-cci/)
