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
});
