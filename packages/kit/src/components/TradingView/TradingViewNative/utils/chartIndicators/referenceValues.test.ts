// cspell:ignore BRAR DIFMA KDJ MAPSY MAVR SKDJ
import { calculateTradingViewNativeAverageTrueRange } from './atr';
import { calculateTradingViewNativeBrar } from './brar';
import { calculateTradingViewNativeBullBearPower } from './bullBearPower';
import { calculateTradingViewNativeDma } from './dma';
import { calculateTradingViewNativeDonchianChannel } from './donchian';
import { getTradingViewNativePointValues } from './indicatorMath';
import {
  calculateTradingViewNativeKdj,
  calculateTradingViewNativeSkdj,
} from './kdj';
import { calculateTradingViewNativeKst } from './kst';
import { calculateTradingViewNativeSimpleMovingAverage } from './ma';
import { calculateTradingViewNativeMaSlope } from './maSlope';
import { calculateTradingViewNativeMassIndex } from './massIndex';
import { calculateTradingViewNativeNegativeVolumeIndex } from './nvi';
import { calculateTradingViewNativePriceMomentumOscillator } from './pmo';
import { calculateTradingViewNativePsychologicalLine } from './psy';
import { calculateTradingViewNativePriceVolumeTrend } from './pvt';
import { calculateTradingViewNativeQqe } from './qqe';
import { calculateTradingViewNativeRankCorrelationIndex } from './rci';
import { TRADING_VIEW_NATIVE_REFERENCE_CANDLES } from './referenceCandles.fixture';
import { calculateTradingViewNativeRelativeVolatilityIndex } from './relativeVolatilityIndex';
import {
  TRADING_VIEW_NATIVE_SQUEEZE_OFF,
  calculateTradingViewNativeSqueezeMomentum,
} from './squeezeMomentum';
import { calculateTradingViewNativeStochasticRsi } from './stochasticRsi';
import { calculateTradingViewNativeSuperTrend } from './superTrend';
import { calculateTradingViewNativeTrendStrengthIndex } from './trendStrengthIndex';
import { calculateTradingViewNativeVolumeRatio } from './vr';
import { calculateTradingViewNativeVolumeWeightedAveragePrice } from './vwap';

// Each expected value is the readout of an exchange chart that showed the same
// daily candles, with its default settings, for the last candle of the
// fixture. The readouts have two decimals, so that is the precision checked.
describe('TradingViewNative indicators against reference chart readouts', () => {
  const points = TRADING_VIEW_NATIVE_REFERENCE_CANDLES;
  const closes = getTradingViewNativePointValues(points, 'c');
  const last = points.length - 1;
  const expectLast = (values: readonly (number | null)[], expected: number) => {
    expect(values).toHaveLength(points.length);
    expect(values[last]).toBeCloseTo(expected, 2);
  };

  it('reads the same candles as the reference chart', () => {
    // The 5, 10 and 20-bar averages the reference chart showed.
    expectLast(
      calculateTradingViewNativeSimpleMovingAverage(closes, 5),
      163.21,
    );
    expectLast(
      calculateTradingViewNativeSimpleMovingAverage(closes, 10),
      172.26,
    );
    expectLast(
      calculateTradingViewNativeSimpleMovingAverage(closes, 20),
      188.79,
    );
  });

  it('matches KDJ and SKDJ', () => {
    const kdj = calculateTradingViewNativeKdj(points);
    expectLast(kdj.k, 21.01);
    expectLast(kdj.d, 17.34);
    expectLast(kdj.j, 28.34);

    const skdj = calculateTradingViewNativeSkdj(points);
    expectLast(skdj.k, 19.62);
    expectLast(skdj.d, 16.86);
  });

  it('matches DMA, VR, BRAR and PSY', () => {
    const dma = calculateTradingViewNativeDma(closes);
    expectLast(dma.dif, -38.16);
    expectLast(dma.movingAverage, -28.07);

    const vr = calculateTradingViewNativeVolumeRatio(points);
    expectLast(vr.vr, 92.82);
    expectLast(vr.movingAverage, 87.49);

    const brar = calculateTradingViewNativeBrar(points);
    expectLast(brar.br, 60.32);
    expectLast(brar.ar, 60.55);

    const psy = calculateTradingViewNativePsychologicalLine(closes);
    expectLast(psy.psy, 33.33);
    expectLast(psy.movingAverage, 34.72);
  });

  it('matches the cumulative PVT and NVI from the first candle', () => {
    expectLast(calculateTradingViewNativePriceVolumeTrend(points), -4729.39);

    const nvi = calculateTradingViewNativeNegativeVolumeIndex(points);
    expectLast(nvi.nvi, 995.11);
    expectLast(nvi.movingAverage, 1056.24);
  });

  it('matches ATR, Mass Index and BBP', () => {
    expectLast(calculateTradingViewNativeAverageTrueRange(points), 9.69);
    expectLast(calculateTradingViewNativeMassIndex(points), 12.01);
    expectLast(calculateTradingViewNativeBullBearPower(points), -28.34);
  });

  it('matches KST and PMO', () => {
    const kst = calculateTradingViewNativeKst(closes);
    expectLast(kst.kst, -197.97);
    expectLast(kst.signal, -149.1);

    const pmo = calculateTradingViewNativePriceMomentumOscillator(closes);
    expectLast(pmo.pmo, -7.1);
    expectLast(pmo.signal, -5.36);
  });

  it('matches the RCI ribbon and the trend strength index', () => {
    expectLast(
      calculateTradingViewNativeRankCorrelationIndex(closes, 10),
      -87.58,
    );
    expectLast(
      calculateTradingViewNativeRankCorrelationIndex(closes, 30),
      -93.45,
    );
    expectLast(
      calculateTradingViewNativeRankCorrelationIndex(closes, 50),
      -93.56,
    );
    expectLast(calculateTradingViewNativeTrendStrengthIndex(closes), -0.93);
  });

  it('matches the relative volatility index and the existing StochRSI', () => {
    const rvi = calculateTradingViewNativeRelativeVolatilityIndex(closes);
    expectLast(rvi.rvi, 39.16);
    expectLast(rvi.signal, 36.53);

    const stochasticRsi = calculateTradingViewNativeStochasticRsi(closes);
    expectLast(stochasticRsi.k, 34.68);
    expectLast(stochasticRsi.d, 28.87);
  });

  it('matches the moving average slope for different settings', () => {
    expectLast(calculateTradingViewNativeMaSlope(closes), -66.99);
    expectLast(
      calculateTradingViewNativeMaSlope(closes, { lookback: 2 }),
      -159.66,
    );
    expectLast(
      calculateTradingViewNativeMaSlope(closes, { lookback: 2, period: 10 }),
      -166.63,
    );
  });

  it('matches the squeeze momentum value and state', () => {
    const squeezeMomentum = calculateTradingViewNativeSqueezeMomentum(points);
    expectLast(squeezeMomentum.momentum, -29.46);
    expect(squeezeMomentum.squeeze[last]).toBe(TRADING_VIEW_NATIVE_SQUEEZE_OFF);
  });

  it('matches the smoothed RSI of QQE', () => {
    // The trailing lines hold a level set several bars earlier, which still
    // depends on how the smoothing warmed up on this short history, so only
    // the RSI line is compared.
    expectLast(calculateTradingViewNativeQqe(closes).rsi, 29.43);
  });

  it('matches SuperTrend, VWAP and the Donchian channel', () => {
    const superTrend = calculateTradingViewNativeSuperTrend(points);
    expectLast(superTrend.downTrend, 188.73);
    expect(superTrend.upTrend[last]).toBeNull();

    expectLast(
      calculateTradingViewNativeVolumeWeightedAveragePrice(points),
      169.15,
    );

    const channel = calculateTradingViewNativeDonchianChannel(points);
    expectLast(channel.basis, 187.17);
    expectLast(channel.upper, 220.41);
    expectLast(channel.lower, 153.93);
  });
});
