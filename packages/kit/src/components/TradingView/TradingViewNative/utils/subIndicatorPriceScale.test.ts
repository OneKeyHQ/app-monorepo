// cspell:ignore macd
import {
  applyTradingViewNativeSubIndicatorPriceScales,
  getTradingViewNativeScaledSubIndicatorAxisLabel,
  getTradingViewNativeSubIndicatorPriceAxisLayouts,
} from './subIndicatorPriceScale';
import {
  createTradingViewNativeSubIndicatorRenderSnapshots,
  getTradingViewNativeSubIndicatorValueRange,
} from './subIndicatorRender';
import {
  getTradingViewNativeSubIndicatorValueAtY,
  getTradingViewNativeSubIndicatorY,
} from './subIndicatorRender/coordinates';

import type { ITradingViewNativeSubIndicatorPriceScales } from './subIndicatorPriceScale';

const points = Array.from({ length: 60 }, (_, index) => ({
  c: 100 + Math.sin(index) * 10,
  h: 120,
  l: 80,
  o: 100,
  t: index * 60,
  v: index + 1,
}));

const panes = createTradingViewNativeSubIndicatorRenderSnapshots({
  configs: [
    { id: 'macd', indicator: 'MACD' },
    { id: 'rsi', indicator: 'RSI' },
    { id: 'stoch', indicator: 'StochRSI' },
  ],
  points,
}).map(({ pane }) => pane);

describe('indicator price scales', () => {
  it('pins a signed range across data and viewport updates without changing other panes or copying series', () => {
    const scales: ITradingViewNativeSubIndicatorPriceScales = {
      macd: {
        mode: 'linear',
        pinnedPriceRange: { minPrice: -10, maxPrice: 20 },
        rangeScale: 2,
      },
    };
    const scaled = applyTradingViewNativeSubIndicatorPriceScales(panes, scales);
    expect(scaled[0].series).toBe(panes[0].series);
    expect(scaled[1]).toBe(panes[1]);
    expect(scaled[2]).toBe(panes[2]);
    expect(panes[0].scale.kind).toBe('auto');
    expect(
      getTradingViewNativeSubIndicatorValueRange({
        pane: scaled[0],
        startIndex: 0,
        endIndex: 60,
      }),
    ).toEqual({ minValue: -25, maxValue: 35 });
    expect(
      getTradingViewNativeSubIndicatorValueRange({
        pane: scaled[0],
        startIndex: 20,
        endIndex: 30,
      }),
    ).toEqual({ minValue: -25, maxValue: 35 });
    const updated = {
      ...panes[0],
      series: panes[0].series.map((series) => ({
        ...series,
        values: series.values.map(() => 1000),
      })),
    };
    expect(
      applyTradingViewNativeSubIndicatorPriceScales([updated], scales)[0].scale,
    ).toEqual(scaled[0].scale);
    const reset = applyTradingViewNativeSubIndicatorPriceScales([updated], {});
    expect(reset[0]).toBe(updated);
    expect(
      getTradingViewNativeSubIndicatorValueRange({
        pane: reset[0],
        startIndex: 0,
        endIndex: 60,
      })?.maxValue,
    ).toBeGreaterThan(1000);
  });

  it('uses the resized visible pane geometry and keeps scales attached to instance IDs after reordering', () => {
    const reordered = [
      { ...panes[2], isVisible: false },
      { ...panes[1], preferredHeight: 80 },
      { ...panes[0], preferredHeight: 120 },
    ];
    const scales: ITradingViewNativeSubIndicatorPriceScales = {
      rsi: {
        mode: 'linear',
        pinnedPriceRange: { minPrice: 0, maxPrice: 100 },
        rangeScale: 0.5,
      },
    };
    const scaled = applyTradingViewNativeSubIndicatorPriceScales(
      reordered,
      scales,
    );
    expect(scaled[1].scale).toEqual({
      kind: 'fixed',
      minValue: 25,
      maxValue: 75,
    });
    expect(scaled[2]).toBe(reordered[2]);
    const layouts = getTradingViewNativeSubIndicatorPriceAxisLayouts({
      height: 500,
      panes: scaled,
      timeAxisHeight: 20,
    });
    expect(
      layouts.map(({ top, bottom, pane }) => ({
        top,
        bottom,
        id: pane.instanceId,
      })),
    ).toEqual([
      { top: 280, bottom: 360, id: 'rsi' },
      { top: 360, bottom: 480, id: 'macd' },
    ]);
  });

  it('measures manually expanded labels, including negative oscillator values', () => {
    expect(getTradingViewNativeScaledSubIndicatorAxisLabel(panes, {})).toBe('');
    expect(
      getTradingViewNativeScaledSubIndicatorAxisLabel(panes, {
        rsi: {
          mode: 'linear',
          pinnedPriceRange: { minPrice: 0, maxPrice: 100 },
          rangeScale: 10,
        },
      }),
    ).toHaveLength('-450.00'.length);
  });

  it('projects logarithmic plots and crosshair values using the same scale, with a linear fallback for signed ranges', () => {
    const scaled = applyTradingViewNativeSubIndicatorPriceScales(panes, {
      rsi: {
        mode: 'logarithmic',
        pinnedPriceRange: { minPrice: 1, maxPrice: 100 },
        rangeScale: 1,
      },
      macd: {
        mode: 'logarithmic',
        pinnedPriceRange: { minPrice: -10, maxPrice: 10 },
        rangeScale: 1,
      },
    });
    const range = getTradingViewNativeSubIndicatorValueRange({
      pane: scaled[1],
      startIndex: 0,
      endIndex: 60,
    });
    expect(range?.mode).toBe('logarithmic');
    expect(range).not.toBeNull();
    if (!range) return;
    expect(
      getTradingViewNativeSubIndicatorY({
        bottom: 100,
        top: 0,
        range,
        value: 10,
      }),
    ).toBeCloseTo(50);
    expect(
      getTradingViewNativeSubIndicatorValueAtY({
        bottom: 100,
        top: 0,
        range,
        y: 50,
      }),
    ).toBeCloseTo(10);
    expect(
      getTradingViewNativeSubIndicatorValueRange({
        pane: scaled[0],
        startIndex: 0,
        endIndex: 60,
      }),
    ).toEqual({ minValue: -10, maxValue: 10 });
    const expanded = applyTradingViewNativeSubIndicatorPriceScales(panes, {
      rsi: {
        mode: 'logarithmic',
        pinnedPriceRange: { minPrice: 1, maxPrice: 100 },
        rangeScale: 2,
      },
    });
    const expandedRange = getTradingViewNativeSubIndicatorValueRange({
      pane: expanded[1],
      startIndex: 0,
      endIndex: 60,
    });
    expect(expandedRange?.minValue).toBeCloseTo(0.1);
    expect(expandedRange?.maxValue).toBeCloseTo(1000);
  });
});
