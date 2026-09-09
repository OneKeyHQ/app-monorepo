import type { IMarketTokenKLineDataPoint } from '@onekeyhq/shared/types/marketV2';

import {
  calculateTradingViewNativeSubIndicatorsWithCache,
  createTradingViewNativeSubIndicatorCalculationCache,
} from './calculationCache';
import { resolveTradingViewNativeSubIndicatorInstance } from './settings';

const POINTS: IMarketTokenKLineDataPoint[] = Array.from(
  { length: 40 },
  (_, index) => ({
    c: index + 1,
    h: index + 2,
    l: index,
    o: index + 0.5,
    t: 1_700_000_000 + index * 60,
    v: 1000 + index,
  }),
);

describe('TradingViewNative sub-indicator calculation cache', () => {
  it('reuses calculations for style-only changes', () => {
    const cache = createTradingViewNativeSubIndicatorCalculationCache();
    const initialInstance = resolveTradingViewNativeSubIndicatorInstance({
      id: 'rsi',
      indicator: 'RSI',
    });
    const styledInstance = resolveTradingViewNativeSubIndicatorInstance({
      id: 'rsi',
      indicator: 'RSI',
      settings: {
        plots: { rsi: { color: '#FF0000' } },
      },
    });

    const [initialEntry] = calculateTradingViewNativeSubIndicatorsWithCache({
      cache,
      instances: [initialInstance],
      points: POINTS,
    });
    const [styledEntry] = calculateTradingViewNativeSubIndicatorsWithCache({
      cache,
      instances: [styledInstance],
      points: POINTS,
    });

    expect(styledEntry?.calculation).toBe(initialEntry?.calculation);
    expect(styledEntry?.instance.settings.plots.rsi?.color).toBe('#FF0000');
  });

  it('recalculates when inputs or point history change', () => {
    const cache = createTradingViewNativeSubIndicatorCalculationCache();
    const initialInstance = resolveTradingViewNativeSubIndicatorInstance({
      id: 'rsi',
      indicator: 'RSI',
    });
    const changedInputInstance = resolveTradingViewNativeSubIndicatorInstance({
      id: 'rsi',
      indicator: 'RSI',
      settings: { inputs: { period: 7 } },
    });

    const [initialEntry] = calculateTradingViewNativeSubIndicatorsWithCache({
      cache,
      instances: [initialInstance],
      points: POINTS,
    });
    const [changedInputEntry] =
      calculateTradingViewNativeSubIndicatorsWithCache({
        cache,
        instances: [changedInputInstance],
        points: POINTS,
      });
    const [changedPointsEntry] =
      calculateTradingViewNativeSubIndicatorsWithCache({
        cache,
        instances: [changedInputInstance],
        points: [...POINTS],
      });

    expect(changedInputEntry?.calculation).not.toBe(initialEntry?.calculation);
    expect(changedPointsEntry?.calculation).not.toBe(
      changedInputEntry?.calculation,
    );
  });

  it('releases cache entries for hidden instances', () => {
    const cache = createTradingViewNativeSubIndicatorCalculationCache();
    const instance = resolveTradingViewNativeSubIndicatorInstance({
      id: 'rsi',
      indicator: 'RSI',
    });

    calculateTradingViewNativeSubIndicatorsWithCache({
      cache,
      instances: [instance],
      points: POINTS,
    });
    calculateTradingViewNativeSubIndicatorsWithCache({
      cache,
      instances: [],
      points: POINTS,
    });

    expect(cache.entries.size).toBe(0);
  });
});
