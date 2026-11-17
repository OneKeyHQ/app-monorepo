import { TRADING_VIEW_NATIVE_SUB_INDICATORS } from '../chartIndicators/subIndicatorTypes';

import { buildTradingViewNativeSubIndicatorInstanceConfigsFromController } from './controllerAdapter';

describe('TradingView Native sub-indicator controller adapter', () => {
  it('builds configs in canonical order and ignores main and unknown ids', () => {
    expect(
      buildTradingViewNativeSubIndicatorInstanceConfigsFromController({
        activeIndicatorValues: new Set(['CCI', 'UNKNOWN', 'MA', 'MACD', 'VOL']),
      }),
    ).toEqual([
      { id: 'VOL', indicator: 'VOL' },
      { id: 'MACD', indicator: 'MACD' },
      { id: 'CCI', indicator: 'CCI' },
    ]);
  });

  it('maps settings overrides to the matching stable instance id', () => {
    const settings = {
      inputs: { period: 7 },
      plots: { rsi: { visible: false } },
    };

    expect(
      buildTradingViewNativeSubIndicatorInstanceConfigsFromController({
        activeIndicatorValues: new Set(['RSI']),
        settingsByIndicator: { RSI: settings },
      }),
    ).toEqual([{ id: 'RSI', indicator: 'RSI', settings }]);
  });

  it('projects all active sub-indicators without duplicates', () => {
    const configs =
      buildTradingViewNativeSubIndicatorInstanceConfigsFromController({
        activeIndicatorValues: new Set(TRADING_VIEW_NATIVE_SUB_INDICATORS),
      });

    expect(configs.map(({ indicator }) => indicator)).toEqual(
      TRADING_VIEW_NATIVE_SUB_INDICATORS,
    );
    expect(new Set(configs.map(({ id }) => id)).size).toBe(13);
  });
});
