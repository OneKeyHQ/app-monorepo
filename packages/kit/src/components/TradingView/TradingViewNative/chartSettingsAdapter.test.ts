import {
  TRADING_VIEW_NATIVE_CHART_SETTINGS_SCHEMA_VERSION,
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

  it('round-trips supported chart settings without the countdown option', () => {
    const currentSettings = createTradingViewNativeChartSettings();
    currentSettings.chartType = 'area';
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
    value.options.yAxis = true;
    value.options.countdown = false;
    value.options.latestPrice = false;
    value.latestPriceLine.upColor = '#123456';
    value.latestPriceLine.downColor = '#654321';
    value.background.style = 'gradient';
    value.background.colors = ['#010203', '#040506'];

    const nextSettings = getTradingViewNativeChartSettings({
      currentSettings,
      value,
    });

    expect(nextSettings.chartType).toBe('area');
    expect(nextSettings.options.yAxis).toBe(true);
    expect(nextSettings.options).not.toHaveProperty('countdown');
    expect(nextSettings.options.latestPrice).toBe(false);
    expect(nextSettings.latestPriceLine).toEqual({
      ...currentSettings.latestPriceLine,
      upColor: '#123456',
      downColor: '#654321',
    });
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

  it('does not repeat the theme migration for schema version 2 settings', () => {
    const previousSettings = createTradingViewNativeChartSettings();
    Object.assign(previousSettings, {
      schemaVersion: 2,
      background: { style: 'solid', colors: ['#000000', '#171717'] },
      grid: {
        style: 'both',
        horizontalColor: '#171717',
        verticalColor: '#171717',
      },
    });

    const migrated = normalizeTradingViewNativeChartSettings(previousSettings);

    expect(migrated.schemaVersion).toBe(
      TRADING_VIEW_NATIVE_CHART_SETTINGS_SCHEMA_VERSION,
    );
    expect(migrated.background.colors).toEqual(['#000000', '#171717']);
    expect(migrated.grid.horizontalColor).toBe('#171717');
    expect(migrated.grid.verticalColor).toBe('#171717');
  });

  it('sanitizes malformed nested values in the current persisted schema', () => {
    const fallback = createTradingViewNativeChartSettings();
    const normalized = normalizeTradingViewNativeChartSettings({
      schemaVersion: fallback.schemaVersion,
      chartType: 'unsupported',
      candles: null,
      options: {
        yAxis: false,
      },
      latestPriceLine: {
        upColor: '#123456',
        downColor: 'not-a-color',
        style: 'dotted',
      },
      background: {
        colors: null,
        style: 'pattern',
      },
      grid: null,
      crossLine: {
        color: 42,
        style: 'solid',
      },
      colorMode: 'unknown',
      priceColorMode: 'redUpGreenDown',
    });

    expect(normalized).toEqual({
      ...fallback,
      options: {
        ...fallback.options,
        yAxis: false,
      },
      latestPriceLine: {
        ...fallback.latestPriceLine,
        upColor: '#123456',
      },
      crossLine: {
        ...fallback.crossLine,
        style: 'solid',
      },
      priceColorMode: 'redUpGreenDown',
    });
  });

  it('falls back safely when the persisted root is invalid', () => {
    expect(normalizeTradingViewNativeChartSettings(null)).toEqual(
      createTradingViewNativeChartSettings(),
    );
  });
});
