// cspell:ignore dmi macd
import type { IMarketTokenKLineDataPoint } from '@onekeyhq/shared/types/marketV2';

import {
  TRADING_VIEW_NATIVE_SUB_INDICATOR_PANE_HEIGHT,
  TRADING_VIEW_NATIVE_TIME_AXIS_HEIGHT,
} from '../../chartConstants';

import {
  getTradingViewNativeSubIndicatorPaneLayoutAtY,
  getTradingViewNativeSubIndicatorPaneLayouts,
  getTradingViewNativeSubIndicatorPaneStackHeight,
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
    const rsiRegion = regions.find(({ indicator }) => indicator === 'RSI');
    const macdRegion = regions.find(({ indicator }) => indicator === 'MACD');
    expect(rsiRegion).toBeDefined();
    expect(macdRegion).toBeDefined();
    if (!rsiRegion || !macdRegion) {
      return;
    }

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
