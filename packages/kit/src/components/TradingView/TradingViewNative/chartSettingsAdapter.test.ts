import {
  TRADING_VIEW_NATIVE_THEME_COLORS,
  createTradingViewNativeChartSettings,
} from '@onekeyhq/shared/types/tradingViewNative';

import { createTradingViewChartSettingsValue } from '../TradingViewChartControls/chartSettings';

import {
  getTradingViewChartSettingsValue,
  getTradingViewNativeChartSettings,
  normalizeTradingViewNativeChartSettings,
} from './chartSettingsAdapter';

describe('TradingViewNative chart settings adapter', () => {
  it('keeps the panel defaults aligned with the persisted defaults', () => {
    expect(
      getTradingViewChartSettingsValue(createTradingViewNativeChartSettings()),
    ).toEqual(createTradingViewChartSettingsValue());
  });

  it('round-trips chart settings while preserving the quick y-axis option', () => {
    const currentSettings = createTradingViewNativeChartSettings();
    currentSettings.options.yAxis = false;
    const value = getTradingViewChartSettingsValue(currentSettings);
    const candleSection = value.appearanceSections.find(
      (section) => section.id === 'candles',
    );
    const body = candleSection?.items.find((item) => item.id === 'body');
    if (body) {
      body.enabled = false;
      body.upColor = '#112233';
    }
    value.options.latestPrice = false;
    value.background.style = 'gradient';
    value.background.colors = ['#010203', '#040506'];

    const nextSettings = getTradingViewNativeChartSettings({
      currentSettings,
      value,
    });

    expect(nextSettings.options.yAxis).toBe(false);
    expect(nextSettings.options.latestPrice).toBe(false);
    expect(nextSettings.candles.body).toEqual({
      enabled: false,
      upColor: '#112233',
      downColor: TRADING_VIEW_NATIVE_THEME_COLORS.negative,
    });
    expect(nextSettings.background).toEqual({
      style: 'gradient',
      colors: ['#010203', '#040506'],
    });
  });

  it('migrates the previous copied defaults to OneKey theme colors', () => {
    const legacySettings = createTradingViewNativeChartSettings();
    Object.assign(legacySettings, {
      schemaVersion: 1,
      candles: {
        body: { enabled: true, upColor: '#219D46', downColor: '#C33759' },
        border: { enabled: true, upColor: '#219D46', downColor: '#C33759' },
        wick: { enabled: true, upColor: '#219D46', downColor: '#C33759' },
      },
      background: { style: 'solid', colors: ['#000000', '#171717'] },
      grid: {
        style: 'both',
        horizontalColor: '#171717',
        verticalColor: '#171717',
      },
      crossLine: { color: '#BFC3CF', style: 'dashed' },
      latestPriceLine: {
        upColor: '#219D46',
        downColor: '#C33759',
        style: 'dashed',
      },
    });

    const migrated = normalizeTradingViewNativeChartSettings(legacySettings);

    expect(migrated).toEqual(createTradingViewNativeChartSettings());
  });
});
