// cspell:ignore dmi macd
import type { IMarketTokenKLineDataPoint } from '@onekeyhq/shared/types/marketV2';

import {
  TRADING_VIEW_NATIVE_SUB_INDICATOR_PANE_HEIGHT,
  TRADING_VIEW_NATIVE_TIME_AXIS_HEIGHT,
} from '../../chartConstants';

import {
  getTradingViewNativeSubIndicatorPaneHeights,
  getTradingViewNativeSubIndicatorPaneLayoutAtY,
  getTradingViewNativeSubIndicatorPaneLayouts,
  getTradingViewNativeSubIndicatorPaneStackHeight,
  getTradingViewNativeSubIndicatorPaneStackLayout,
  getTradingViewNativeVisibleSubIndicatorPaneCount,
} from './layout';
import {
  getTradingViewNativeSubIndicatorLegendHitRegions,
  getTradingViewNativeSubIndicatorLegendIndicatorAtPoint,
  getTradingViewNativeSubIndicatorLegendLayouts,
} from './legend';
import { createTradingViewNativeSubIndicatorRenderSnapshots } from './pipeline';

const POINTS: IMarketTokenKLineDataPoint[] = Array.from(
  { length: 40 },
  (_, index) => ({
    c: 100 + index,
    h: 102 + index,
    l: 98 + index,
    o: 99 + index,
    t: 1_700_000_000 + index * 60,
    v: 1000 + index * 10,
  }),
);

describe('TradingViewNative sub-indicator pane layout', () => {
  it('uses resized pane boundaries consistently for rendering and settings hit testing', () => {
    const panes = createTradingViewNativeSubIndicatorRenderSnapshots({
      configs: [
        { id: 'rsi', indicator: 'RSI' },
        { id: 'macd', indicator: 'MACD' },
      ],
      points: POINTS,
    }).map(({ pane }, index) => ({
      ...pane,
      preferredHeight: index === 0 ? 100 : 60,
    }));
    const stack = getTradingViewNativeSubIndicatorPaneStackLayout({
      height: 400,
      paneCount: 2,
      panes,
      timeAxisHeight: 20,
    });
    expect(stack).toEqual({ top: 220, bottom: 380, height: 160 });
    const layouts = getTradingViewNativeSubIndicatorPaneLayouts({
      panes,
      stackTop: stack.top,
      stackBottom: stack.bottom,
      startIndex: 0,
      endIndex: POINTS.length,
    });
    expect(layouts.map((pane) => pane.height)).toEqual([100, 60]);
    expect(
      getTradingViewNativeSubIndicatorPaneLayoutAtY(layouts, 315)?.pane
        .indicator,
    ).toBe('RSI');
    expect(
      getTradingViewNativeSubIndicatorPaneLayoutAtY(layouts, 325)?.pane
        .indicator,
    ).toBe('MACD');
    const regions = getTradingViewNativeSubIndicatorLegendHitRegions({
      height: 400,
      panes,
      timeAxisHeight: 20,
      measureTextWidth: (text) => text.length * 6,
      pointIndex: 39,
      priceAxisX: 600,
    });
    expect(regions[1].rect.y).toBeGreaterThanOrEqual(320);
    const compressed = getTradingViewNativeSubIndicatorPaneStackLayout({
      height: 200,
      paneCount: 2,
      panes,
      timeAxisHeight: 20,
    });
    expect(compressed.top).toBeGreaterThanOrEqual(96);
    const compactLayouts = getTradingViewNativeSubIndicatorPaneLayouts({
      panes,
      stackTop: compressed.top,
      stackBottom: compressed.bottom,
      startIndex: 0,
      endIndex: POINTS.length,
    });
    // 84px for panes that prefer 160px: MACD stops at the minimum height and
    // RSI gives up the rest.
    expect(compactLayouts.map((pane) => pane.height)).toEqual([48, 36]);
  });

  describe('getTradingViewNativeSubIndicatorPaneHeights', () => {
    it('keeps every share while each pane stays above the minimum', () => {
      expect(
        getTradingViewNativeSubIndicatorPaneHeights([120, 80], 200),
      ).toEqual([120, 80]);
      expect(
        getTradingViewNativeSubIndicatorPaneHeights([120, 80], 150),
      ).toEqual([90, 60]);
      expect(
        getTradingViewNativeSubIndicatorPaneHeights([120, 80], 300),
      ).toEqual([180, 120]);
    });

    it('stops a pane at the minimum height and takes the rest from taller ones', () => {
      // One pane that filled the stack, then two added beside it.
      expect(
        getTradingViewNativeSubIndicatorPaneHeights([180, 56, 56], 180),
      ).toEqual([108, 36, 36]);
      // Stopping the last pane leaves too little for the middle one's share.
      expect(
        getTradingViewNativeSubIndicatorPaneHeights([100, 60, 5], 110),
      ).toEqual([38, 36, 36]);
    });

    it('splits a stack too short for every minimum equally', () => {
      expect(
        getTradingViewNativeSubIndicatorPaneHeights([180, 56, 56], 90),
      ).toEqual([30, 30, 30]);
      expect(getTradingViewNativeSubIndicatorPaneHeights([180, 56], 0)).toEqual(
        [0, 0],
      );
      expect(getTradingViewNativeSubIndicatorPaneHeights([], 90)).toEqual([]);
    });

    it('always fills the stack', () => {
      for (const stackHeight of [37, 71.9, 72, 107.5, 109.5, 180.25, 640]) {
        const heights = getTradingViewNativeSubIndicatorPaneHeights(
          [109.5, 56, 56],
          stackHeight,
        );
        expect(heights.reduce((sum, height) => sum + height, 0)).toBeCloseTo(
          stackHeight,
        );
      }
    });
  });
  it('uses one preferred-height pane and preserves input order', () => {
    const panes = createTradingViewNativeSubIndicatorRenderSnapshots({
      configs: [
        { id: 'rsi', indicator: 'RSI' },
        { id: 'macd', indicator: 'MACD' },
      ],
      points: POINTS,
    }).map(({ pane }) => pane);
    const stackHeight = getTradingViewNativeSubIndicatorPaneStackHeight({
      height: 400,
      paneCount: panes.length,
    });
    const timeAxisY = 400 - TRADING_VIEW_NATIVE_TIME_AXIS_HEIGHT;
    const layouts = getTradingViewNativeSubIndicatorPaneLayouts({
      endIndex: POINTS.length,
      panes,
      stackBottom: timeAxisY,
      stackTop: timeAxisY - stackHeight,
      startIndex: 0,
    });

    expect(stackHeight).toBe(TRADING_VIEW_NATIVE_SUB_INDICATOR_PANE_HEIGHT * 2);
    expect(layouts.map(({ pane }) => pane.instanceId)).toEqual(['rsi', 'macd']);
    expect(layouts[0]?.bottom).toBe(layouts[1]?.top);
    expect(layouts[1]?.bottom).toBe(timeAxisY);
    expect(layouts.every(({ range }) => range !== null)).toBe(true);
  });

  it('compresses many panes without overlapping the main chart or time axis', () => {
    const stackHeight = getTradingViewNativeSubIndicatorPaneStackHeight({
      height: 220,
      paneCount: 13,
    });

    expect(stackHeight).toBeGreaterThan(0);
    expect(stackHeight).toBeLessThan(
      13 * TRADING_VIEW_NATIVE_SUB_INDICATOR_PANE_HEIGHT,
    );
    expect(
      220 - TRADING_VIEW_NATIVE_TIME_AXIS_HEIGHT - stackHeight,
    ).toBeGreaterThanOrEqual(96);
  });

  it('uses the supplied time-axis height as the pane stack boundary', () => {
    expect(
      getTradingViewNativeSubIndicatorPaneStackLayout({
        height: 360,
        paneCount: 1,
        timeAxisHeight: 20,
      }),
    ).toEqual({
      bottom: 340,
      height: TRADING_VIEW_NATIVE_SUB_INDICATOR_PANE_HEIGHT,
      top: 284,
    });
  });

  it('filters hidden panes and resolves pane hit testing', () => {
    const panes = createTradingViewNativeSubIndicatorRenderSnapshots({
      configs: [
        { id: 'hidden', indicator: 'RSI', isVisible: false },
        { id: 'visible', indicator: 'MFI' },
      ],
      points: POINTS,
    }).map(({ pane }) => pane);
    const layouts = getTradingViewNativeSubIndicatorPaneLayouts({
      endIndex: POINTS.length,
      panes,
      stackBottom: 200,
      stackTop: 144,
      startIndex: 0,
    });

    expect(getTradingViewNativeVisibleSubIndicatorPaneCount(panes)).toBe(1);
    expect(layouts).toHaveLength(1);
    expect(layouts[0]?.pane.instanceId).toBe('visible');
    expect(getTradingViewNativeSubIndicatorPaneLayoutAtY(layouts, 170)).toBe(
      layouts[0],
    );
    expect(
      getTradingViewNativeSubIndicatorPaneLayoutAtY(layouts, 120),
    ).toBeNull();
  });

  it('resolves settings taps only inside each visible legend target', () => {
    const panes = createTradingViewNativeSubIndicatorRenderSnapshots({
      configs: [
        { id: 'hidden', indicator: 'VOL', isVisible: false },
        { id: 'rsi', indicator: 'RSI' },
        { id: 'macd', indicator: 'MACD' },
      ],
      points: POINTS,
    }).map(({ pane }) => pane);
    const regions = getTradingViewNativeSubIndicatorLegendHitRegions({
      height: 400,
      measureTextWidth: (text) => text.length * 6,
      panes,
      pointIndex: POINTS.length - 1,
      priceAxisX: 300,
    });
    const compactRegions = getTradingViewNativeSubIndicatorLegendHitRegions({
      height: 400,
      measureTextWidth: (text) => text.length * 6,
      panes,
      pointIndex: POINTS.length - 1,
      priceAxisX: 300,
      timeAxisHeight: 20,
    });
    const rsiRegion = regions.find(({ indicator }) => indicator === 'RSI');
    const macdRegion = regions.find(({ indicator }) => indicator === 'MACD');
    expect(rsiRegion).toBeDefined();
    expect(macdRegion).toBeDefined();
    if (!rsiRegion || !macdRegion) {
      return;
    }

    expect(compactRegions.map(({ rect }) => rect.y)).toEqual(
      regions.map(({ rect }) => rect.y + 4),
    );

    expect(
      getTradingViewNativeSubIndicatorLegendIndicatorAtPoint({
        regions,
        x: rsiRegion.rect.x + rsiRegion.rect.width,
        y: rsiRegion.rect.y + rsiRegion.rect.height / 2,
      }),
    ).toBe('RSI');
    expect(
      getTradingViewNativeSubIndicatorLegendIndicatorAtPoint({
        regions,
        x: macdRegion.rect.x + 1,
        y: macdRegion.rect.y + 1,
      }),
    ).toBe('MACD');
    expect(
      getTradingViewNativeSubIndicatorLegendIndicatorAtPoint({
        regions,
        x: rsiRegion.rect.x + rsiRegion.rect.width + 1,
        y: rsiRegion.rect.y + rsiRegion.rect.height / 2,
      }),
    ).toBeNull();
    expect(
      getTradingViewNativeSubIndicatorLegendIndicatorAtPoint({
        regions,
        x: 20,
        y: 300,
      }),
    ).toBeNull();
  });

  it('keeps the full wrapped legend inside the settings target', () => {
    const panes = createTradingViewNativeSubIndicatorRenderSnapshots({
      configs: [{ id: 'dmi', indicator: 'DMI' }],
      points: POINTS,
    }).map(({ pane }) => pane);
    const regions = getTradingViewNativeSubIndicatorLegendHitRegions({
      height: 300,
      measureTextWidth: (text) => text.length * 6,
      panes,
      pointIndex: POINTS.length - 1,
      priceAxisX: 190,
    });
    const region = regions[0];
    expect(region).toBeDefined();
    if (!region) {
      return;
    }

    expect(region.rect.height).toBeGreaterThan(24);
    expect(
      getTradingViewNativeSubIndicatorLegendIndicatorAtPoint({
        regions,
        x: region.rect.x + 1,
        y: region.rect.y + region.rect.height - 1,
      }),
    ).toBe('DMI');
  });

  it('wraps a short legend tightly without shrinking its tap target', () => {
    const panes = createTradingViewNativeSubIndicatorRenderSnapshots({
      configs: [{ id: 'wr', indicator: 'WR' }],
      points: POINTS,
    }).map(({ pane }) => pane);
    const stackHeight = getTradingViewNativeSubIndicatorPaneStackHeight({
      height: 300,
      paneCount: panes.length,
    });
    const paneLayouts = getTradingViewNativeSubIndicatorPaneLayouts({
      endIndex: POINTS.length,
      panes,
      stackBottom: 300 - TRADING_VIEW_NATIVE_TIME_AXIS_HEIGHT,
      stackTop: 300 - TRADING_VIEW_NATIVE_TIME_AXIS_HEIGHT - stackHeight,
      startIndex: 0,
    });
    const [legendLayout] = getTradingViewNativeSubIndicatorLegendLayouts({
      layouts: paneLayouts,
      measureTextWidth: (text) => text.length * 6,
      pointIndex: POINTS.length - 1,
      priceAxisX: 300,
    });

    expect(legendLayout?.backgroundRect).toEqual(
      expect.objectContaining({ height: 15 }),
    );
    expect(legendLayout?.backgroundRect.width).toBeLessThan(96);
    expect(legendLayout?.hitRect).toEqual(
      expect.objectContaining({ height: 24, width: 96 }),
    );
  });
});
