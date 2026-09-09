import type { IMarketTokenKLineDataPoint } from '@onekeyhq/shared/types/marketV2';

import {
  createTradingViewNativeSubIndicatorRenderSnapshot,
  createTradingViewNativeSubIndicatorRenderSnapshots,
} from './pipeline';

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

describe('TradingViewNative sub-indicator render pipeline', () => {
  it('resolves settings, calculates values, and builds one render snapshot', () => {
    const snapshot = createTradingViewNativeSubIndicatorRenderSnapshot({
      config: {
        id: 'rsi-primary',
        indicator: 'RSI',
        settings: {
          inputs: { period: 4 },
          plots: { rsi: { color: '#123456' } },
        },
      },
      points: POINTS,
    });

    expect(snapshot.instance.settings.inputs.period).toBe(4);
    expect(snapshot.calculation.inputValues.period).toBe(4);
    expect(snapshot.calculation.pointCount).toBe(POINTS.length);
    expect(snapshot.pane.instanceId).toBe('rsi-primary');
    expect(snapshot.pane.series[0]?.style.color).toBe('#123456');
    expect(snapshot.pane.series[0]?.values).toEqual(
      snapshot.calculation.plots.rsi,
    );
    expect(snapshot.pane.series[0]?.values).toBe(
      snapshot.calculation.plots.rsi,
    );
  });

  it('preserves instance order and independent settings across panes', () => {
    const snapshots = createTradingViewNativeSubIndicatorRenderSnapshots({
      configs: [
        { id: 'macd-1', indicator: 'MACD' },
        {
          id: 'rsi-1',
          indicator: 'RSI',
          isVisible: false,
          settings: { bands: { upper: { value: 75 } } },
        },
      ],
      points: POINTS,
    });

    expect(snapshots.map(({ instance }) => instance.id)).toEqual([
      'macd-1',
      'rsi-1',
    ]);
    expect(snapshots[0]?.pane.indicator).toBe('MACD');
    expect(snapshots[1]?.pane.isVisible).toBe(false);
    expect(snapshots[1]?.pane.bands[0]?.style.value).toBe(75);
  });
});
