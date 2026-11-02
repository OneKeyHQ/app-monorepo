# TradingView Native Sub-Chart Indicator Algorithms

This document records the algorithms of the 13 sub-chart indicators in the old WebView TradingView Native Controls, so that `TradingViewNative` implements them with the same values and default behavior.

Research date: 2026-08-19.

## 1. Compatibility Target

The old controller did not implement these algorithms in the app. It mapped each indicator name to a built-in Study of the TradingView Charting Library and then called:

```ts
chart.createStudy(studyName, false, false);
```

The call passes no custom inputs, so the compatibility target of this document is:

1. Use the same built-in Study the old controller mapped to.
2. Use the default inputs and the actual calculation of the current Charting Library bundle.
3. Treat the official TradingView documentation only as an explanation of the formulas; where the general official description differs from the project bundle, the project bundle wins.

"Matching values" means the same output for finite, valid OHLCV input once the indicator has finished its warm-up. For abnormal input such as missing history or zero volume, the old bundle relies on how JavaScript propagates `NaN`/`Infinity`; the Native implementation turns all of these into `null` as described in section 2.2. This is a deliberate safety boundary, and those abnormal values do not need to be reproduced.

Baseline:

- OneKey TradingView chart commit: `7511e31329e35acd104d97c1b820e6157fbd6dc8`
- Controller mapping: [NativeChartControlsManager.ts](https://github.com/OneKeyHQ/tradingview-charting-library/blob/7511e31329e35acd104d97c1b820e6157fbd6dc8/src/widget/managers/NativeChartControlsManager.ts)
- Study implementation: `public/charting_library/bundles/library.da96fe4a247adfea0ad8.js` in that commit
- Mock data for the future settings page in the app: [TradingViewSettingsMockState.ts](../../../TradingViewChartControls/chartSettings/TradingViewSettingsMockState.ts)

### 1.1 Name Mapping

| App name | Charting Library Study | Description |
| --- | --- | --- |
| `VOL` | `Volume` | Volume bars |
| `MACD` | `MACD` | Moving average convergence divergence |
| `RSI` | `Relative Strength Index` | Relative strength index |
| `StochRSI` | `Stochastic RSI` | Stochastic oscillator applied to RSI |
| `OBV` | `On Balance Volume` | Volume accumulated by close direction |
| `MFI` | `Money Flow Index` | Volume-weighted momentum oscillator |
| `TRIX` | `TRIX` | Momentum of a triple exponential smoothing |
| `EMV` | `Ease Of Movement` | The app calls it EMV; the Study name and common abbreviation are EOM |
| `WR` | `Williams %R` | Williams %R |
| `ROC` | `Rate Of Change` | Percentage price change |
| `MTM` | `Momentum` | Absolute price change |
| `DMI` | `Directional Movement Index` | Trend direction and strength |
| `CCI` | `Commodity Channel Index` | Distance of the typical price from its average |

## 2. Inputs and Shared Conventions

Bar `t` uses:

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

Bars must be sorted by time in ascending order and deduplicated by timestamp before calculation. Internal calculations keep the full precision of JavaScript `number` and only round when formatting for the UI.

### 2.1 Shared Moving Averages

Simple moving average:

```text
SMA(X, n)[t] = sum(X[t - n + 1 ... t]) / n
```

The exponential moving average uses the SMA of the first `n` valid values as its first value, and then:

```text
alpha = 2 / (n + 1)
EMA(X, n)[t] = alpha * X[t] + (1 - alpha) * EMA(X, n)[t - 1]
```

Wilder's moving average is called `RMA` in the bundle and is also initialized with the first SMA:

```text
RMA(X, n)[t] = (X[t] + (n - 1) * RMA(X, n)[t - 1]) / n
```

Its equivalent smoothing factor is `1 / n`. RSI and DMI must use `RMA` and must not be switched to a plain EMA.

The bundle's RSI/MFI ratio helper uses a `1e-10` tolerance to decide whether a float is zero, so these two indicators keep that rule. The original formulas of ROC, MTM, WR, CCI, EMV, StochRSI and DMI only treat an exact `0` specially; tiny but non-zero prices or ranges must still be calculated, and non-finite results are filtered out at the end.

### 2.2 Invalid Values

The Native implementation always uses `null` for points that have not formed yet or cannot be calculated, and never passes `NaN`, `Infinity` or `-Infinity` to the layout and render layers.

Unless a rule below says otherwise, output `null` when:

- There is not enough history.
- An input OHLCV value is not a finite number.
- A formula's denominator is `0`.
- A logarithm's input is less than or equal to `0`.

Do not use `0` in place of missing history, since that changes the results of EMA, RMA and cumulative indicators.

## 3. Default Inputs

| Indicator | Bundle default inputs | Visible outputs by default |
| --- | --- | --- |
| `VOL` | Volume MA is `SMA(20)` and its smoothing line is `SMA(9)`; both are hidden by default | Volume bars |
| `MACD` | Fast `12`, Slow `26`, Signal `9`, all EMA, source=`close` | Histogram, MACD, Signal |
| `RSI` | Length `14` | RSI; an extra SMA(14) is hidden by default |
| `StochRSI` | RSI `14`, Stoch `14`, K `3`, D `3` | `%K`, `%D` |
| `OBV` | No main period | OBV; an extra SMA(9) is hidden by default |
| `MFI` | Length `14` | MFI |
| `TRIX` | Length `18` | TRIX |
| `EMV` | Divisor `10,000`, Length `14` | EOM |
| `WR` | Length `14` | `%R` |
| `ROC` | Length `9` | ROC |
| `MTM` | Length `10`, source=`close` | Momentum |
| `DMI` | DI Length `14`, ADX Smoothing `14` | `+DI`, `-DI`, `DX`, `ADX`, `ADXR` |
| `CCI` | Length `20` | CCI; an extra SMA(20) is hidden by default |

## 4. Indicator Algorithms

### 4.1 VOL

The default output is the current bar's volume:

```text
VOL[t] = V[t]
```

The default bar color follows the current candle's direction rather than a comparison with the previous close:

```text
C[t] >= O[t]  => Growing
C[t] <  O[t]  => Falling
```

The bundle also provides a volume moving average, hidden by default:

```text
VOL_MA[t] = SMA(V, 20)[t]
```

and a further smoothing of the Volume MA, also hidden by default:

```text
Smoothed_VOL_MA[t] = SMA(VOL_MA, 9)[t]
```

Implementation note: `VOL` only uses the standalone sub-chart mode. Volume embedded in the main chart is always off; once `VOL` is selected it is drawn by its own definition, settings, palette and pane scene, and turning it off leaves no visible volume area.

Reference: [TradingView Average Volume](https://www.tradingview.com/support/solutions/43000745917-how-do-we-calculate-average-volume/).

### 4.2 MACD

The defaults are `12 / 26 / 9`, all EMA, with the close as input:

```text
Fast[t] = EMA(C, 12)[t]
Slow[t] = EMA(C, 26)[t]
DIF[t] = Fast[t] - Slow[t]
DEA[t] = EMA(DIF, 9)[t]
Histogram[t] = DIF[t] - DEA[t]
```

Output names:

| Name in common Chinese charting apps | TradingView output |
| --- | --- |
| DIF | MACD line |
| DEA | Signal line |
| MACD bars | Histogram |

Compatibility note: the Histogram is **not multiplied by 2**. Some charting apps use `2 * (DIF - DEA)`, which does not match the old Charting Library Study.

The Histogram's four-color palette depends on both the sign and the direction relative to the previous value: a positive value that rises or does not rise uses index `0` or `1`, and a non-positive value that rises or does not rise uses `2` or `3`. When the first valid Histogram has no previous value to compare with, the bundle takes the "rising" branch, so a positive value uses `0` and a non-positive value uses `2`.

Reference: [TradingView MACD](https://www.tradingview.com/support/solutions/43000502344-moving-average-convergence-divergence-macd-indicator/).

### 4.3 RSI

The default period is `14`, with the close as input:

```text
Delta[t] = C[t] - C[t - 1]
Gain[t] = max(Delta[t], 0)
Loss[t] = max(-Delta[t], 0)
AvgGain[t] = RMA(Gain, 14)[t]
AvgLoss[t] = RMA(Loss, 14)[t]
RS[t] = AvgGain[t] / AvgLoss[t]
RSI[t] = 100 - 100 / (1 + RS[t])
```

The bundle's edge rules:

```text
AvgLoss == 0 => RSI = 100
AvgLoss != 0 && AvgGain == 0 => RSI = 0
```

So when both averages are `0` it also returns `100`; do not change that to `50`. The default reference lines are `70 / 50 / 30`. The bundle also calculates `SMA(RSI, 14)`, but that line is hidden by default.

Reference: [TradingView RSI](https://www.tradingview.com/support/solutions/43000502338-relative-strength-index-rsi/).

### 4.4 StochRSI

First calculate `RSI(14)` as in the previous section, then RSI's position within its latest 14 values:

```text
LowestRSI[t] = lowest(RSI, 14)[t]
HighestRSI[t] = highest(RSI, 14)[t]
Raw[t] = 100 * (RSI[t] - LowestRSI[t])
               / (HighestRSI[t] - LowestRSI[t])
K[t] = SMA(Raw, 3)[t]
D[t] = SMA(K, 3)[t]
```

Compatibility notes:

- The bundle's output range is `0 ... 100`, not the `0 ... 1` notation the official description sometimes uses.
- When all 14 RSI values are equal and the denominator is `0`, the bundle's `fixnan` carries the last valid Raw value forward; if there is no earlier valid value, the output is `null`.
- The default reference lines are `80 / 20`.

Reference: [TradingView Stochastic RSI](https://www.tradingview.com/support/solutions/43000502333-stochastic-rsi-stoch-rsi/).

### 4.5 OBV

OBV accumulates volume by the direction of the close:

```text
Contribution[t] =
  V[t],   if C[t] > C[t - 1]
 -V[t],   if C[t] < C[t - 1]
  0,      if C[t] == C[t - 1]

OBV[0] = 0
OBV[t] = OBV[t - 1] + Contribution[t]
```

The absolute starting point of OBV does not change the shape of the line, but the Native implementation always starts at `0` so cross-platform snapshot tests stay simple. The bundle also calculates `SMA(OBV, 9)`, hidden by default.

A bar without volume has no OBV. When its volume is not a finite number, or the data source uses `0` to mean it has no volume for the bar, both its OBV and MAOBV are `null`. For now only the stock (share price) source reads `0` this way: it sends `0` for bars it has no volume for, such as after hours. Other sources still count a `0` as "nothing traded", which contributes `0`. Such a bar is skipped entirely: the next bar with volume compares its close with the last bar that had volume and continues from the last OBV, and MAOBV averages only the bars that have OBV. A bar with an invalid close is still `null`, and accumulation restarts from the next bar.

History paging note: when earlier bars are later added to the front of the time axis, the accumulation must restart from the new start of history; do not just shift the old OBV array to the right.

Reference: [TradingView OBV](https://www.tradingview.com/support/solutions/43000502593-on-balance-volume-obv/).

### 4.6 MFI

The default period is `14`:

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

When two Typical Prices are equal, the current Raw Money Flow counts toward neither the positive nor the negative flow. The bundle's edge rules are:

```text
NegativeSum == 0 => MFI = 100
NegativeSum != 0 && PositiveSum == 0 => MFI = 0
```

The bundle's rolling `sum` returns partial-window results while there are fewer than 14 flow values, and the first bar, which has no previous Typical Price, goes into both the positive and the negative flow, so the first value is usually `50`. The Native implementation follows the shared warm-up rule and returns `null` until it has a full window of 14 directional flows; from the first full window on, both formulas match exactly.

The default reference lines are `80 / 20`.

Reference: [TradingView MFI](https://www.tradingview.com/support/solutions/43000502348-money-flow-mfi/).

### 4.7 TRIX

The old bundle's actual implementation differs slightly from the common textbook TRIX formula. For matching values, take the natural logarithm of the close first and then apply the EMA three times:

```text
LogClose[t] = ln(C[t])
EMA1[t] = EMA(LogClose, 18)[t]
EMA2[t] = EMA(EMA1, 18)[t]
EMA3[t] = EMA(EMA2, 18)[t]
TRIX[t] = 10,000 * (EMA3[t] - EMA3[t - 1])
```

Compatibility notes:

- Output `null` when `C[t] <= 0`.
- Do not replace it with the common `100 * (EMA3[t] / EMA3[t - 1] - 1)`.
- The bundle only outputs the TRIX line, with no MATRIX or Signal line.

The official TradingView description summarizes TRIX as the one-period rate of change of a triple EMA; the logarithm and the `10,000` multiplier above come from the project's actual bundle and are what values must match.

Reference: [TradingView TRIX](https://www.tradingview.com/support/solutions/43000502331-trix/).

### 4.8 EMV / EOM

The app uses the name `EMV`; the old controller actually created the `Ease Of Movement` Study. The defaults are `Divisor = 10,000` and a smoothing period of `14`:

```text
Midpoint[t] = (H[t] + L[t]) / 2
Distance[t] = Midpoint[t] - Midpoint[t - 1]
Range[t] = H[t] - L[t]
RawEOM[t] = 10,000 * Distance[t] * Range[t] / V[t]
EOM[t] = SMA(RawEOM, 14)[t]
```

The formula can also be written as:

```text
BoxRatio[t] = (V[t] / 10,000) / Range[t]
RawEOM[t] = Distance[t] / BoxRatio[t]
```

Output `null` when `V[t] == 0`. The bundle has only one EOM line, with no MAEMV signal line.

Reference: [TradingView Ease of Movement](https://www.tradingview.com/support/solutions/43000502256-ease-of-movement-eom/).

### 4.9 WR / Williams %R

The default period is `14`:

```text
HH[t] = highest(H, 14)[t]
LL[t] = lowest(L, 14)[t]
WR[t] = 100 * (C[t] - HH[t]) / (HH[t] - LL[t])
```

Equivalently:

```text
WR[t] = -100 * (HH[t] - C[t]) / (HH[t] - LL[t])
```

Results usually fall within `-100 ... 0`, and the default reference lines are `-80 / -20`. Output `null` when `HH == LL`. The bundle has a single `%R` with a period of 14, not a WR1/WR2 pair.

Reference: [TradingView Williams %R](https://www.tradingview.com/support/solutions/43000501985-williams-r-r/).

### 4.10 ROC

The default period is `9`, with the close as input:

```text
ROC[t] = 100 * (C[t] - C[t - 9]) / C[t - 9]
```

Output `null` when `C[t - 9] == 0`. The bundle has only the main ROC line, with no MAROC average.

Reference: [TradingView ROC](https://www.tradingview.com/support/solutions/43000502343-rate-of-change-roc/).

### 4.11 MTM / Momentum

The default period is `10`, with the close as input:

```text
MTM[t] = C[t] - C[t - 10]
```

MTM is an absolute price difference and ROC is a percentage change, so the two cannot share an output scale. When the earlier close is missing or equals `0`, output `null`, as the bundle does. The bundle has no MAMTM average.

Reference: [TradingView Momentum](https://www.tradingview.com/support/solutions/43000589187-momentum/).

### 4.12 DMI

The defaults are `DI Length = 14` and `ADX Smoothing = 14`. First calculate the directional moves and the True Range:

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

Then use Wilder's RMA:

```text
ATR[t] = RMA(TR, 14)[t]
PlusDI[t] = 100 * RMA(PlusDM, 14)[t] / ATR[t]
MinusDI[t] = 100 * RMA(MinusDM, 14)[t] / ATR[t]

DISum[t] = PlusDI[t] + MinusDI[t]
DX[t] = 100 * abs(PlusDI[t] - MinusDI[t]) / DISum[t]
ADX[t] = RMA(DX, 14)[t]
ADXR[t] = (ADX[t] + ADX[t - 13]) / 2
```

Compatibility notes:

- Bar `0` has no previous bar, so its `TR`, `PlusDM` and `MinusDM` are all `null`; do not start the RMA early with `H - L` and two `0`s. With the default periods, the first valid indexes of `DI / ADX / ADXR` are `14 / 27 / 40`.
- When `PlusDI + MinusDI == 0`, the bundle gets `DX = 0` through a safe denominator.
- When `PlusDI` or `MinusDI` temporarily cannot be calculated, it keeps the last valid value; with no earlier valid value it is `null`.
- The bundle outputs five lines: `+DI`, `-DI`, `DX`, `ADX`, `ADXR`. Do not implement only the three lines common in the modern TradingView UI.
- ADXR uses `ADX[t - (DI Length - 1)]`, which is `t - 13` with the default period; this is what the bundle actually does.

Reference: [TradingView DMI](https://www.tradingview.com/support/solutions/43000502250-directional-movement-dmi/), [TradingView ADX](https://www.tradingview.com/support/solutions/43000589099-average-directional-index-adx/).

### 4.13 CCI

The bundle always uses the Typical Price, with a default period of `20`:

```text
TP[t] = (H[t] + L[t] + C[t]) / 3
Basis[t] = SMA(TP, 20)[t]

MeanDeviation[t] =
  sum(abs(TP[i] - Basis[t]), i = t - 19 ... t) / 20

CCI[t] = (TP[t] - Basis[t]) / (0.015 * MeanDeviation[t])
```

This is the mean absolute deviation, not the standard deviation. Output `null` when `MeanDeviation == 0`. The default reference lines are `+100 / -100`. The bundle also calculates `SMA(CCI, 20)`, hidden by default.

TradingView's current help page mentions a configurable source, but the project bundle's Study is fixed to `HLC3`; use `TP` to stay compatible with the old chart.

Reference: [TradingView CCI](https://www.tradingview.com/support/solutions/43000502001-commodity-channel-index-cci/).

## 5. Differences From the App Settings Mock

`TradingViewSettingsMockState.ts` is a mock for the settings UI, not the source of truth for the old WebView indicator algorithms. It differs from the old Charting Library defaults as follows:

| Indicator | Old Charting Library | Settings mock |
| --- | --- | --- |
| `VOL` | Volume; MA(20) hidden by default | MA1(5), MA2(10); averages off by default in the sub-chart |
| `RSI` | Single RSI(14) line | RSI1(6), RSI2(12), RSI3(24) |
| `OBV` | OBV; SMA(9) hidden by default | OBV + MAOBV(30) |
| `TRIX` | Single TRIX(18) line | TRIX(12) + MATRIX(9) |
| `EMV` | Divisor(10,000), single EOM(14) line | EMV(14) + MAEMV(9) |
| `WR` | Single WR(14) line | WR1(10) + WR2(6) |
| `ROC` | Single ROC(9) line | ROC(12) + MAROC(6) |
| `MTM` | Single MTM(10) line | MTM(12) + MAMTM(6) |
| `DMI` | DI(14), ADX(14), five outputs | N(14), MM(6), as in the design mockups |
| `CCI` | CCI(20) | CCI(14) |

The core inputs of `MACD(12, 26, 9)`, `StochRSI(14, 14, 3, 3)` and `MFI(14)` match.

If the product goal is to reproduce the old WebView, use the inputs in sections 3 and 4. If the goal changes to implementing the settings mock, open a separate requirement that pins down the inputs, output lines and migration plan; do not mix the two definitions during implementation.

## 6. Native Implementation and Verification Requirements

### 6.1 Calculation Interface

Each indicator calculator should stay a pure function and return arrays as long as the input bars:

```ts
type IIndicatorValues = Array<number | null>;
```

Indicators with several outputs return named series instead of relying on array indexes:

```ts
interface ISubIndicatorSeries {
  key: string;
  values: Array<number | null>;
}
```

Keep colors, line widths and layout heights out of the algorithm layer.

### 6.2 History and Realtime Updates

- After the first load, an interval switch, or loading earlier history, recalculate from all sorted bars.
- A realtime bar may update the same timestamp repeatedly; do not advance EMA/RMA state as if each update were a new bar.
- If calculation later becomes incremental, keep both the state after the last closed bar and a state for the current bar that can be rolled back, and verify in tests that the result matches a full recalculation.
- Cumulative indicators such as OBV must recalculate the full accumulation after earlier history is added.

### 6.3 Required Test Data

Each indicator should cover at least:

1. Steadily rising data.
2. Steadily falling data.
3. Completely flat data.
4. OHLC data with gaps.
5. `V == 0` and `H == L`.
6. Just short of the period, exactly the period, and long history.
7. Repeated updates to the last realtime bar.
8. Stable full results after earlier history is added.

Numeric tests should store reference output from the current Charting Library bundle and compare every valid point. The algorithm layer should use an absolute or relative tolerance around `1e-10`; UI display precision must not feed back into calculation precision.

## 7. Official References

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
