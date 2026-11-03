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

  it.each([
    [0.000_003_194_79, '0.0₅319479'],
    [-0.000_003_194_79, '-0.0₅319479'],
    [0.000_000_000_319_479, '0.0₉319479'],
    [0.000_031_947_9, '0.0₄319479'],
    [-0.000_031_947_9, '-0.0₄319479'],
    [0.000_319_479, '0.000319479'],
    [0.000_009_999_999, '0.0₄1'],
    [0.000_099_999_99, '0.0001'],
    [0, '0'],
  ] as const)(
    'compacts small volume indicator value %s to %s',
    (value, expected) => {
      expect(
        formatTradingViewNativeSubIndicatorValue(value, { type: 'volume' }),
      ).toBe(expected);
    },
  );

  it('measures EMV axis labels using the same compact format as its ticks', () => {
    const { pane } = createTradingViewNativeSubIndicatorRenderSnapshot({
      config: { id: 'emv', indicator: 'EMV' },
      points: POINTS,
    });
    pane.scale = {
      kind: 'fixed',
      maxValue: 0.000_004,
      minValue: 0.000_002,
    };

    const label = getTradingViewNativeSubIndicatorAxisLabel([pane]);
    expect(label).toContain('₅');
    expect(label.length).toBeLessThan('0.00000319479'.length);
    expect(label.length).toBeGreaterThanOrEqual('0.0₅319479'.length);
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

  it('formats inherited values with the resolved price precision', () => {
    expect(
      formatTradingViewNativeSubIndicatorValue(-1.9634, {
        precision: 2,
        type: 'inherit',
      }),
    ).toBe('-1.96');
    expect(
      formatTradingViewNativeSubIndicatorValue(0.0008, {
        precision: 2,
        type: 'inherit',
      }),
    ).toBe('0.00');
  });

  it.each([
    [-0.3, { precision: 0, type: 'inherit' } as const, '0'],
    [-0.001, { precision: 2, type: 'price' } as const, '0.00'],
    [-0.6, { precision: 0, type: 'inherit' } as const, '-1'],
  ])('drops the sign when %s rounds to zero', (value, format, expected) => {
    expect(formatTradingViewNativeSubIndicatorValue(value, format)).toBe(
      expected,
    );
  });

  it.each([
    [0.888_888, '0.89'],
    [-0.888_888, '-0.89'],
    [999.999, '1K'],
    [-0.001, '0'],
    [523.4567, '523.5'],
    [147_912, '147.9K'],
  ])('formats %s with limited volume decimals as %s', (value, expected) => {
    expect(
      formatTradingViewNativeSubIndicatorValue(value, {
        precision: 2,
        type: 'volume',
      }),
    ).toBe(expected);
  });

  it('sizes a zero-crossing K-unit volume pane by its unit labels', () => {
    const pane = createTradingViewNativeSubIndicatorRenderSnapshot({
      config: { id: 'emv', indicator: 'EMV' },
      points: POINTS,
    }).pane;
    pane.scale = { kind: 'fixed', maxValue: 147_900, minValue: -241_200 };

    // Six significant digits stay reserved for tiny values near zero.
    expect(getTradingViewNativeSubIndicatorAxisLabel([pane])).toBe('-0.888888');

    pane.format = { precision: 2, type: 'volume' };
    const widestLabel = getTradingViewNativeSubIndicatorAxisLabel([pane]);
    expect(widestLabel).toBe('-888.8K');
    for (let step = 0; step <= 1000; step += 1) {
      const value = -241_200 + (389_100 * step) / 1000;
      expect(
        formatTradingViewNativeSubIndicatorValue(value, pane.format).length,
      ).toBeLessThanOrEqual(widestLabel.length);
    }
  });

  it('reserves the widest unit suffix a volume range reaches', () => {
    const pane = createTradingViewNativeSubIndicatorRenderSnapshot({
      config: { id: 'obv', indicator: 'OBV' },
      points: POINTS,
    }).pane;
    pane.format = { precision: 2, type: 'volume' };
    pane.scale = { kind: 'fixed', maxValue: 900_000, minValue: -2_500_000 };

    expect(getTradingViewNativeSubIndicatorAxisLabel([pane])).toBe('-888.8M');
  });

  it('sizes a zero-crossing inherited pane by its range ends once precision is known', () => {
    const pane = createTradingViewNativeSubIndicatorRenderSnapshot({
      config: { id: 'inherited', indicator: 'MACD' },
      points: POINTS,
    }).pane;
    pane.scale = { kind: 'fixed', maxValue: 4.9, minValue: -6.4 };

    // Without a known precision, near-zero significant digits stay reserved.
    expect(getTradingViewNativeSubIndicatorAxisLabel([pane])).toBe(
      '-0.0008888',
    );

    pane.format = { precision: 2, type: 'inherit' };
    const widestLabel = getTradingViewNativeSubIndicatorAxisLabel([pane]);
    expect(widestLabel).toHaveLength('-6.40'.length);
    for (let step = 0; step <= 1000; step += 1) {
      const value = -6.4 + (11.3 * step) / 1000;
      expect(
        formatTradingViewNativeSubIndicatorValue(value, pane.format).length,
      ).toBeLessThanOrEqual(widestLabel.length);
    }
  });

  it('keeps a signed K-unit range narrower than a theoretical scientific label', () => {
    const pane = createTradingViewNativeSubIndicatorRenderSnapshot({
      config: { id: 'obv', indicator: 'OBV' },
      points: POINTS,
    }).pane;
    pane.scale = { kind: 'fixed', maxValue: 54_309, minValue: -141_663 };

    const widestLabel = getTradingViewNativeSubIndicatorAxisLabel([pane]);

    expect(widestLabel).not.toMatch(/e/i);
    expect(widestLabel.length).toBeLessThanOrEqual('-0.888888'.length);
    for (const value of [54_309, 5316, -92_670, -141_663]) {
      expect(
        formatTradingViewNativeSubIndicatorValue(value, pane.format).length,
      ).toBeLessThanOrEqual(widestLabel.length);
    }
  });

  it('sizes tiny signed ranges for their formatted ticks', () => {
    const pane = createTradingViewNativeSubIndicatorRenderSnapshot({
      config: { id: 'rsi', indicator: 'RSI' },
      points: POINTS,
    }).pane;
    pane.scale = {
      kind: 'fixed',
      maxValue: 0.000_000_001,
      minValue: -0.000_000_001,
    };

    for (const type of ['inherit', 'volume'] as const) {
      pane.format = { type };
      const widestLabel = getTradingViewNativeSubIndicatorAxisLabel([pane]);
      for (const value of [-1e-9, -5e-10, 0, 5e-10, 1e-9]) {
        expect(
          formatTradingViewNativeSubIndicatorValue(value, pane.format).length,
        ).toBeLessThanOrEqual(widestLabel.length);
      }
    }
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
