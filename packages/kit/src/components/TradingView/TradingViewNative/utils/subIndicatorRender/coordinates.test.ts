import type { IMarketTokenKLineDataPoint } from '@onekeyhq/shared/types/marketV2';

import {
  formatTradingViewNativeSubIndicatorValue,
  getTradingViewNativeSubIndicatorAxisLabel,
  getTradingViewNativeSubIndicatorValueAtY,
  getTradingViewNativeSubIndicatorY,
} from './coordinates';
import { createTradingViewNativeSubIndicatorRenderSnapshot } from './pipeline';

const POINTS: IMarketTokenKLineDataPoint[] = Array.from(
  { length: 30 },
  (_, index) => ({
    c: index + 1,
    h: index + 2,
    l: index,
    o: index + 0.5,
    t: 1_700_000_000 + index * 60,
    v: 1000 + index * 100,
  }),
);

describe('TradingViewNative sub-indicator coordinates', () => {
  it('maps values to pane coordinates and back', () => {
    const range = { maxValue: 100, minValue: -100 };

    expect(
      getTradingViewNativeSubIndicatorY({
        bottom: 150,
        range,
        top: 50,
        value: 0,
      }),
    ).toBe(100);
    expect(
      getTradingViewNativeSubIndicatorValueAtY({
        bottom: 150,
        range,
        top: 50,
        y: 75,
      }),
    ).toBe(50);
    expect(
      getTradingViewNativeSubIndicatorValueAtY({
        bottom: 150,
        range,
        top: 50,
        y: 151,
      }),
    ).toBeNull();
  });

  it('formats price precision and signed volume values', () => {
    expect(
      formatTradingViewNativeSubIndicatorValue(12.3456, {
        precision: 2,
        type: 'price',
      }),
    ).toBe('12.35');
    expect(
      formatTradingViewNativeSubIndicatorValue(-1_250_000, {
        type: 'volume',
      }),
    ).toBe('-1.25M');
    expect(
      formatTradingViewNativeSubIndicatorValue(0.000_002_547, {
        type: 'inherit',
      }),
    ).toBe('0.0₅2547');
  });

  it('finds a pane label wide enough for negative volume studies', () => {
    const pane = createTradingViewNativeSubIndicatorRenderSnapshot({
      config: { id: 'obv', indicator: 'OBV' },
      points: POINTS,
    }).pane;
    pane.series[0]!.values[29] = -12_345_678;

    const widestLabel = getTradingViewNativeSubIndicatorAxisLabel([pane]);
    expect(
      formatTradingViewNativeSubIndicatorValue(-0.888_888, pane.format).length,
    ).toBeLessThanOrEqual(widestLabel.length);
    expect(
      formatTradingViewNativeSubIndicatorValue(-999.999, pane.format).length,
    ).toBeLessThanOrEqual(widestLabel.length);
  });

  it('includes padded scale tick candidates in the widest axis label', () => {
    const pane = createTradingViewNativeSubIndicatorRenderSnapshot({
      config: { id: 'volume', indicator: 'VOL' },
      points: POINTS,
    }).pane;
    const volume = pane.series.find((series) => series.id === 'volume');
    expect(volume).toBeDefined();
    if (!volume) {
      return;
    }
    volume.values = Array.from({ length: POINTS.length }, (_, index) =>
      index === POINTS.length - 1 ? 2000 : null,
    );

    const widestLabel = getTradingViewNativeSubIndicatorAxisLabel([pane]);

    expect(
      formatTradingViewNativeSubIndicatorValue(999.999, pane.format).length,
    ).toBeLessThanOrEqual(widestLabel.length);
    expect(
      formatTradingViewNativeSubIndicatorValue(0.888_888, pane.format).length,
    ).toBeLessThanOrEqual(widestLabel.length);
  });

  it('reserves width across abbreviated volume-unit boundaries', () => {
    const pane = createTradingViewNativeSubIndicatorRenderSnapshot({
      config: { id: 'volume', indicator: 'VOL' },
      points: POINTS,
    }).pane;
    const volume = pane.series.find((series) => series.id === 'volume');
    expect(volume).toBeDefined();
    if (!volume) {
      return;
    }
    volume.values = Array.from({ length: POINTS.length }, (_, index) =>
      index === POINTS.length - 1 ? 2_160_000_000 : null,
    );

    const widestLabel = getTradingViewNativeSubIndicatorAxisLabel([pane]);
    for (const value of [999.999, 999_999, 999_999_999]) {
      expect(
        formatTradingViewNativeSubIndicatorValue(value, pane.format).length,
      ).toBeLessThanOrEqual(widestLabel.length);
    }
  });

  it('reserves all significant digits for continuous crosshair values', () => {
    const pane = createTradingViewNativeSubIndicatorRenderSnapshot({
      config: { id: 'rsi', indicator: 'RSI' },
      points: POINTS,
    }).pane;
    pane.scale = { kind: 'fixed', maxValue: 0.2, minValue: 0.1 };

    pane.format = { type: 'inherit' };
    const inheritLabel = getTradingViewNativeSubIndicatorAxisLabel([pane]);
    expect(
      formatTradingViewNativeSubIndicatorValue(0.1999, pane.format).length,
    ).toBeLessThanOrEqual(inheritLabel.length);

    pane.format = { type: 'volume' };
    const volumeLabel = getTradingViewNativeSubIndicatorAxisLabel([pane]);
    expect(
      formatTradingViewNativeSubIndicatorValue(0.199_999, pane.format).length,
    ).toBeLessThanOrEqual(volumeLabel.length);
  });

  it('reserves scientific exponent width for ranges crossing zero', () => {
    const pane = createTradingViewNativeSubIndicatorRenderSnapshot({
      config: { id: 'rsi', indicator: 'RSI' },
      points: POINTS,
    }).pane;
    pane.scale = {
      kind: 'fixed',
      maxValue: 0.000_000_001,
      minValue: -0.000_000_001,
    };

    pane.format = { type: 'inherit' };
    const inheritLabel = getTradingViewNativeSubIndicatorAxisLabel([pane]);
    expect(
      formatTradingViewNativeSubIndicatorValue(
        -0.000_000_000_088_88,
        pane.format,
      ).length,
    ).toBeLessThanOrEqual(inheritLabel.length);

    pane.format = { type: 'volume' };
    const volumeLabel = getTradingViewNativeSubIndicatorAxisLabel([pane]);
    expect(
      formatTradingViewNativeSubIndicatorValue(
        -0.000_000_000_088_888_8,
        pane.format,
      ).length,
    ).toBeLessThanOrEqual(volumeLabel.length);
  });

  it('reserves the widest trillion-unit mantissa', () => {
    const pane = createTradingViewNativeSubIndicatorRenderSnapshot({
      config: { id: 'volume', indicator: 'VOL' },
      points: POINTS,
    }).pane;
    pane.format = { type: 'volume' };
    pane.scale = {
      kind: 'fixed',
      maxValue: 1_000_000_000_000_000,
      minValue: 1_000_000_000_000,
    };

    const widestLabel = getTradingViewNativeSubIndicatorAxisLabel([pane]);
    expect(
      formatTradingViewNativeSubIndicatorValue(888_800_000_000_000, pane.format)
        .length,
    ).toBeLessThanOrEqual(widestLabel.length);
  });

  it('reserves mantissa digits inside a compact-unit range', () => {
    const pane = createTradingViewNativeSubIndicatorRenderSnapshot({
      config: { id: 'volume', indicator: 'VOL' },
      points: POINTS,
    }).pane;
    pane.format = { type: 'volume' };
    pane.scale = { kind: 'fixed', maxValue: 4000, minValue: 1000 };

    const widestLabel = getTradingViewNativeSubIndicatorAxisLabel([pane]);
    expect(
      formatTradingViewNativeSubIndicatorValue(3333, pane.format).length,
    ).toBeLessThanOrEqual(widestLabel.length);
  });
});
