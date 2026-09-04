// cspell:ignore macd
import {
  type ITradingViewNativeIndicatorSettings,
  TRADING_VIEW_NATIVE_INDICATOR_SETTINGS_SCHEMA_VERSION,
  TRADING_VIEW_NATIVE_THEME_COLORS,
  createTradingViewNativeIndicatorSettings,
} from '@onekeyhq/shared/types/tradingViewNative';

import { updateTradingViewSettingsMockIndicatorParameter } from '../TradingViewChartControls/chartSettings/TradingViewSettingsMockState';

import {
  createTradingViewNativeIndicatorSettingsValue,
  getTradingViewNativeActiveMainIndicators,
  getTradingViewNativeIndicatorSettings,
  getTradingViewNativeIndicatorSettingsValue,
  getTradingViewNativeMainIndicatorSettings,
  getTradingViewNativeSubIndicatorInstances,
  normalizeTradingViewNativeIndicatorSettings,
  reconcileTradingViewNativeIndicatorActiveState,
  updateTradingViewNativeIndicatorActiveState,
} from './indicatorSettingsAdapter';
import {
  TRADING_VIEW_NATIVE_ALL_INDICATORS,
  TRADING_VIEW_NATIVE_INDICATORS,
  TRADING_VIEW_NATIVE_SUB_INDICATORS,
} from './utils/chartIndicators';

describe('indicatorSettingsAdapter', () => {
  it('builds settings only for indicators supported by the native renderer', () => {
    const value = getTradingViewNativeIndicatorSettingsValue(
      createTradingViewNativeIndicatorSettings(),
    );

    expect(value.indicators.map((indicator) => indicator.id)).toEqual([
      ...TRADING_VIEW_NATIVE_INDICATORS,
      ...TRADING_VIEW_NATIVE_SUB_INDICATORS,
    ]);
    expect(value.indicators).toHaveLength(
      TRADING_VIEW_NATIVE_ALL_INDICATORS.length,
    );
    expect(value.indicators.every((indicator) => !indicator.active)).toBe(true);
    expect(
      value.indicators.some(
        (indicator) =>
          indicator.scope === 'main' && indicator.label === 'VOLUME',
      ),
    ).toBe(false);
    expect(
      value.indicators.find((indicator) => indicator.id === 'VOL'),
    ).toMatchObject({
      description: 'Volume',
      title: 'VOL (Volume)',
    });
    expect(
      value.indicators.find((indicator) => indicator.id === 'VOL')?.groupLabel,
    ).toBeUndefined();
    expect(
      value.indicators.find((indicator) => indicator.id === 'SAR'),
    ).toMatchObject({
      opacityColors: {
        downColor: TRADING_VIEW_NATIVE_THEME_COLORS.negative,
        upColor: TRADING_VIEW_NATIVE_THEME_COLORS.positive,
      },
      showOpacity: true,
    });
    expect(
      value.indicators
        .find((indicator) => indicator.id === 'SAR')
        ?.lines.find((line) => line.id === 'sar')?.showColor,
    ).toBe(false);
    expect(
      value.indicators
        .find((indicator) => indicator.id === 'BOLL')
        ?.lines.find((line) => line.id === 'background'),
    ).toMatchObject({
      color: TRADING_VIEW_NATIVE_THEME_COLORS.indicatorSecondary,
      enabled: true,
      showStyle: false,
    });
    expect(
      value.indicators
        .find((indicator) => indicator.id === 'BOLL')
        ?.lines.filter((line) => ['middle', 'upper', 'lower'].includes(line.id))
        .map((line) => line.color),
    ).toEqual([
      TRADING_VIEW_NATIVE_THEME_COLORS.indicatorSecondary,
      TRADING_VIEW_NATIVE_THEME_COLORS.indicatorSecondary,
      TRADING_VIEW_NATIVE_THEME_COLORS.indicatorSecondary,
    ]);
  });

  it('uses the native catalog and defaults for Reset', () => {
    const value = createTradingViewNativeIndicatorSettingsValue();

    expect(value.indicators.map((indicator) => indicator.id)).toEqual([
      ...TRADING_VIEW_NATIVE_INDICATORS,
      ...TRADING_VIEW_NATIVE_SUB_INDICATORS,
    ]);
    expect(value.indicators.every((indicator) => !indicator.active)).toBe(true);
  });

  it('limits only new activations when settings already exceed the cap', () => {
    const activeSubIndicatorIds = new Set<string>(
      TRADING_VIEW_NATIVE_SUB_INDICATORS.slice(0, 5),
    );
    const value = createTradingViewNativeIndicatorSettingsValue();
    value.indicators.forEach((indicator) => {
      if (activeSubIndicatorIds.has(indicator.id)) {
        indicator.active = true;
      }
    });
    const settings = getTradingViewNativeIndicatorSettings(value);

    const blockedSettings = updateTradingViewNativeIndicatorActiveState({
      active: true,
      indicator: 'MFI',
      maxSelectableSubIndicatorCount: 4,
      settings,
    });
    const reducedSettings = updateTradingViewNativeIndicatorActiveState({
      active: false,
      indicator: 'OBV',
      maxSelectableSubIndicatorCount: 4,
      settings: blockedSettings,
    });

    expect(
      blockedSettings.subIndicators
        .filter((indicator) => indicator.active)
        .map((indicator) => indicator.id),
    ).toEqual([...activeSubIndicatorIds]);
    expect(
      reducedSettings.subIndicators
        .filter((indicator) => indicator.active)
        .map((indicator) => indicator.id),
    ).toEqual(['VOL', 'MACD', 'RSI', 'StochRSI']);
  });

  it('reconciles a selection above the cap without trimming it', () => {
    const value = createTradingViewNativeIndicatorSettingsValue();
    const initialActiveIndicatorIds = new Set([
      'MA',
      'VOL',
      'MACD',
      'RSI',
      'StochRSI',
      'OBV',
    ]);
    value.indicators.forEach((indicator) => {
      if (initialActiveIndicatorIds.has(indicator.id)) {
        indicator.active = true;
      }
    });
    const settings = getTradingViewNativeIndicatorSettings(value);

    const reconciledSettings = reconcileTradingViewNativeIndicatorActiveState({
      activeIndicatorValues: new Set([
        'MA',
        'VOL',
        'RSI',
        'StochRSI',
        'OBV',
        'MFI',
      ]),
      replaceMainIndicators: false,
      replaceSubIndicators: true,
      settings,
    });

    expect(
      reconciledSettings.mainIndicators
        .filter((indicator) => indicator.active)
        .map((indicator) => indicator.id),
    ).toEqual(['MA']);
    expect(
      reconciledSettings.subIndicators
        .filter((indicator) => indicator.active)
        .map((indicator) => indicator.id),
    ).toEqual(['VOL', 'RSI', 'StochRSI', 'OBV', 'MFI']);
    expect(
      settings.subIndicators.filter((indicator) => indicator.active),
    ).toHaveLength(5);

    const mainOnlySettings = reconcileTradingViewNativeIndicatorActiveState({
      activeIndicatorValues: new Set(['EMA', 'VOL', 'MACD', 'RSI', 'StochRSI']),
      replaceMainIndicators: true,
      replaceSubIndicators: false,
      settings,
    });
    expect(
      mainOnlySettings.mainIndicators
        .filter((indicator) => indicator.active)
        .map((indicator) => indicator.id),
    ).toEqual(['EMA']);
    expect(
      mainOnlySettings.subIndicators
        .filter((indicator) => indicator.active)
        .map((indicator) => indicator.id),
    ).toEqual(['VOL', 'MACD', 'RSI', 'StochRSI', 'OBV']);
  });

  it('does not expose an ineffective single-color control for palette plots', () => {
    const value = createTradingViewNativeIndicatorSettingsValue();
    const volumePlot = value.indicators
      .find((indicator) => indicator.id === 'VOL')
      ?.lines.find((line) => line.id === 'plot:volume');
    const macdHistogram = value.indicators
      .find((indicator) => indicator.id === 'MACD')
      ?.lines.find((line) => line.id === 'plot:histogram');

    expect(volumePlot?.showColor).toBe(false);
    expect(macdHistogram?.showColor).toBe(false);
  });

  it('migrates the legacy single-array persisted shape', () => {
    const value = createTradingViewNativeIndicatorSettingsValue();
    const ma = value.indicators.find((indicator) => indicator.id === 'MA');
    const rsi = value.indicators.find((indicator) => indicator.id === 'RSI');
    expect(ma).toBeDefined();
    expect(rsi).toBeDefined();
    if (!ma || !rsi) {
      return;
    }
    ma.active = true;
    rsi.active = true;
    const currentSettings = getTradingViewNativeIndicatorSettings(value);

    const normalized = normalizeTradingViewNativeIndicatorSettings({
      indicators: [
        ...currentSettings.mainIndicators,
        ...currentSettings.subIndicators,
      ],
      schemaVersion: 1,
    });

    expect(
      normalized.mainIndicators.find((item) => item.id === 'MA')?.active,
    ).toBe(true);
    expect(
      normalized.subIndicators.find((item) => item.id === 'RSI')?.active,
    ).toBe(true);
  });

  it('falls back safely when persisted indicator branches are malformed', () => {
    expect(
      normalizeTradingViewNativeIndicatorSettings({
        mainIndicators: [{ active: true, id: 'MA' }],
        schemaVersion: 1,
        subIndicators: null,
      }),
    ).toEqual(createTradingViewNativeIndicatorSettings());
  });

  it('sanitizes malformed persisted line styles and colors', () => {
    const settings = {
      schemaVersion: 1,
      mainIndicators: [
        {
          active: true,
          id: 'MA',
          lines: {
            'line:0': {
              color: 'not-a-color',
              enabled: true,
              period: 5,
              style: 'zigzag',
            },
          },
          opacityColors: { downColor: null, upColor: false },
          parameters: {},
          transparency: 0,
        },
      ],
      subIndicators: [],
    } as unknown as ITradingViewNativeIndicatorSettings;

    const ma = getTradingViewNativeIndicatorSettingsValue(
      settings,
    ).indicators.find((indicator) => indicator.id === 'MA');

    expect(ma?.lines[0]).toMatchObject({
      color: TRADING_VIEW_NATIVE_THEME_COLORS.brand,
      style: 'solid',
    });
    expect(ma?.opacityColors).toEqual({
      downColor: TRADING_VIEW_NATIVE_THEME_COLORS.negative,
      upColor: TRADING_VIEW_NATIVE_THEME_COLORS.positive,
    });
  });

  it('sanitizes malformed nested values in the current persisted schema', () => {
    const normalized = normalizeTradingViewNativeIndicatorSettings({
      schemaVersion: TRADING_VIEW_NATIVE_INDICATOR_SETTINGS_SCHEMA_VERSION,
      mainIndicators: [
        {
          active: true,
          id: 'MA',
          lines: {
            'line:0': null,
            'line:1': {
              color: TRADING_VIEW_NATIVE_THEME_COLORS.indicatorPrimary,
              enabled: true,
              period: 0,
              style: 'solid',
            },
          },
          opacityColors: { downColor: null, upColor: false },
          parameters: { period: Number.NaN },
          transparency: 500,
        },
      ],
      subIndicators: [],
    });
    const ma = getTradingViewNativeIndicatorSettingsValue(
      normalized,
    ).indicators.find((indicator) => indicator.id === 'MA');

    expect(normalized.mainIndicators[0]).toMatchObject({
      lines: {
        'line:1': {
          period: 0,
        },
      },
      parameters: {},
      transparency: 100,
    });
    expect(normalized.mainIndicators[0]?.lines['line:0']).toBeUndefined();
    expect(normalized.mainIndicators[0]?.opacityColors).toBeUndefined();
    expect(ma?.lines[0]).toMatchObject({
      color: TRADING_VIEW_NATIVE_THEME_COLORS.brand,
      period: 5,
    });
    expect(ma?.lines[1]?.period).toBe(1);
    expect(ma?.opacityColors).toEqual({
      downColor: TRADING_VIEW_NATIVE_THEME_COLORS.negative,
      upColor: TRADING_VIEW_NATIVE_THEME_COLORS.positive,
    });
  });

  it('migrates previous indicator defaults to OneKey theme colors', () => {
    const settings = normalizeTradingViewNativeIndicatorSettings({
      schemaVersion: 1,
      mainIndicators: [
        {
          active: true,
          id: 'MA',
          lines: {
            'line:0': {
              color: '#FF9D22',
              enabled: true,
              period: 5,
              style: 'solid',
            },
          },
          opacityColors: { downColor: '#C33759', upColor: '#219D46' },
          parameters: {},
          transparency: 0,
        },
      ],
      subIndicators: [],
    });

    expect(settings.mainIndicators[0]?.lines['line:0']?.color).toBe(
      TRADING_VIEW_NATIVE_THEME_COLORS.indicatorSecondary,
    );
    expect(settings.mainIndicators[0]?.opacityColors).toEqual({
      downColor: TRADING_VIEW_NATIVE_THEME_COLORS.negative,
      upColor: TRADING_VIEW_NATIVE_THEME_COLORS.positive,
    });
  });

  it('migrates version 2 BOLL and MAOBV defaults', () => {
    const value = createTradingViewNativeIndicatorSettingsValue();
    const boll = value.indicators.find((indicator) => indicator.id === 'BOLL');
    const obv = value.indicators.find((indicator) => indicator.id === 'OBV');
    const upper = boll?.lines.find((line) => line.id === 'upper');
    const lower = boll?.lines.find((line) => line.id === 'lower');
    const movingAverage = obv?.lines.find(
      (line) => line.id === 'plot:movingAverage',
    );
    const movingAveragePeriod = obv?.parameters?.find(
      (parameter) => parameter.id === 'movingAveragePeriod',
    );
    expect(upper).toBeDefined();
    expect(lower).toBeDefined();
    expect(movingAverage).toBeDefined();
    expect(movingAveragePeriod).toBeDefined();
    if (!upper || !lower || !movingAverage || !movingAveragePeriod) {
      return;
    }
    upper.color = TRADING_VIEW_NATIVE_THEME_COLORS.quinary;
    lower.color = TRADING_VIEW_NATIVE_THEME_COLORS.quaternary;
    movingAverage.color = TRADING_VIEW_NATIVE_THEME_COLORS.indicatorPrimary;
    movingAverage.enabled = false;
    movingAveragePeriod.value = 9;

    const normalized = normalizeTradingViewNativeIndicatorSettings({
      ...getTradingViewNativeIndicatorSettings(value),
      schemaVersion: 2,
    });
    const restored = getTradingViewNativeIndicatorSettingsValue(normalized);
    const restoredBoll = restored.indicators.find(
      (indicator) => indicator.id === 'BOLL',
    );
    const restoredObv = restored.indicators.find(
      (indicator) => indicator.id === 'OBV',
    );

    expect(normalized.schemaVersion).toBe(
      TRADING_VIEW_NATIVE_INDICATOR_SETTINGS_SCHEMA_VERSION,
    );
    expect(
      restoredBoll?.lines
        .filter((line) => line.id === 'upper' || line.id === 'lower')
        .map((line) => line.color),
    ).toEqual([
      TRADING_VIEW_NATIVE_THEME_COLORS.indicatorSecondary,
      TRADING_VIEW_NATIVE_THEME_COLORS.indicatorSecondary,
    ]);
    expect(
      restoredObv?.lines.find((line) => line.id === 'plot:movingAverage'),
    ).toMatchObject({
      color: TRADING_VIEW_NATIVE_THEME_COLORS.indicatorSecondary,
      enabled: true,
    });
    expect(
      restoredObv?.parameters?.find(
        (parameter) => parameter.id === 'movingAveragePeriod',
      )?.value,
    ).toBe(30);
  });

  it('preserves customized version 2 BOLL and MAOBV settings', () => {
    const value = createTradingViewNativeIndicatorSettingsValue();
    const boll = value.indicators.find((indicator) => indicator.id === 'BOLL');
    const obv = value.indicators.find((indicator) => indicator.id === 'OBV');
    const upper = boll?.lines.find((line) => line.id === 'upper');
    const movingAverage = obv?.lines.find(
      (line) => line.id === 'plot:movingAverage',
    );
    const movingAveragePeriod = obv?.parameters?.find(
      (parameter) => parameter.id === 'movingAveragePeriod',
    );
    expect(upper).toBeDefined();
    expect(movingAverage).toBeDefined();
    expect(movingAveragePeriod).toBeDefined();
    if (!upper || !movingAverage || !movingAveragePeriod) {
      return;
    }
    upper.color = '#123456';
    movingAverage.color = '#654321';
    movingAverage.enabled = false;
    movingAveragePeriod.value = 9;

    const normalized = normalizeTradingViewNativeIndicatorSettings({
      ...getTradingViewNativeIndicatorSettings(value),
      schemaVersion: 2,
    });
    const restored = getTradingViewNativeIndicatorSettingsValue(normalized);
    const restoredBoll = restored.indicators.find(
      (indicator) => indicator.id === 'BOLL',
    );
    const restoredObv = restored.indicators.find(
      (indicator) => indicator.id === 'OBV',
    );

    expect(restoredBoll?.lines.find((line) => line.id === 'upper')?.color).toBe(
      '#123456',
    );
    expect(
      restoredObv?.lines.find((line) => line.id === 'plot:movingAverage'),
    ).toMatchObject({ color: '#654321', enabled: false });
    expect(
      restoredObv?.parameters?.find(
        (parameter) => parameter.id === 'movingAveragePeriod',
      )?.value,
    ).toBe(9);
  });

  it('round-trips main and sub indicator settings into renderer configs', () => {
    const value = getTradingViewNativeIndicatorSettingsValue(
      createTradingViewNativeIndicatorSettings(),
    );
    const ma = value.indicators.find((indicator) => indicator.id === 'MA');
    const macd = value.indicators.find((indicator) => indicator.id === 'MACD');
    const volume = value.indicators.find((indicator) => indicator.id === 'VOL');
    expect(ma).toBeDefined();
    expect(macd).toBeDefined();
    expect(volume).toBeDefined();
    if (!ma || !macd || !volume) {
      return;
    }

    ma.active = true;
    const firstMaLine = ma.lines[0];
    expect(firstMaLine).toBeDefined();
    if (firstMaLine) {
      firstMaLine.period = 7;
      firstMaLine.color = '#123456';
      firstMaLine.style = 'bold';
    }
    macd.active = true;
    const fastPeriod = macd.parameters?.find(
      (parameter) => parameter.id === 'fastPeriod',
    );
    const macdLine = macd.lines.find((line) => line.id === 'plot:macd');
    expect(fastPeriod).toBeDefined();
    expect(macdLine).toBeDefined();
    if (fastPeriod) {
      fastPeriod.value = 8;
    }
    if (macdLine) {
      macdLine.color = '#ABCDEF';
      macdLine.style = 'extraBold';
    }
    volume.active = true;
    volume.opacity = 65;
    volume.opacityColors = {
      downColor: '#FF0000',
      upColor: '#00FF00',
    };

    const settings = getTradingViewNativeIndicatorSettings(value);
    const mainSettings = getTradingViewNativeMainIndicatorSettings(settings);
    const subInstances = getTradingViewNativeSubIndicatorInstances(settings);
    const macdInstance = subInstances.find(
      (instance) => instance.indicator === 'MACD',
    );
    const volumeInstance = subInstances.find(
      (instance) => instance.indicator === 'VOL',
    );

    expect(getTradingViewNativeActiveMainIndicators(settings)).toEqual(
      new Set(['MA']),
    );
    expect(mainSettings.MA?.lines['line:0']).toMatchObject({
      color: '#123456',
      period: 7,
      style: 'bold',
    });
    expect(macdInstance?.settings?.inputs?.fastPeriod).toBe(8);
    expect(macdInstance?.settings?.plots?.macd).toMatchObject({
      color: '#ABCDEF',
      lineWidth: 4,
      visible: true,
    });
    expect(volumeInstance?.settings?.palettes?.volume).toEqual([
      '#FF0000',
      '#00FF00',
    ]);
    expect(volumeInstance?.settings?.plots?.volume?.transparency).toBe(65);

    const restoredValue = getTradingViewNativeIndicatorSettingsValue(settings);
    expect(
      restoredValue.indicators.find((indicator) => indicator.id === 'MA')
        ?.lines[0],
    ).toMatchObject({ color: '#123456', period: 7, style: 'bold' });
  });

  it('preserves negative sub-indicator band values through editing and rendering', () => {
    const value = createTradingViewNativeIndicatorSettingsValue();
    const nextValue = updateTradingViewSettingsMockIndicatorParameter(
      value,
      'WR',
      'band:upper',
      -30,
    );
    const wr = nextValue.indicators.find((indicator) => indicator.id === 'WR');
    if (wr) {
      wr.active = true;
    }
    const settings = getTradingViewNativeIndicatorSettings(nextValue);
    const restored = getTradingViewNativeIndicatorSettingsValue(settings);
    const instance = getTradingViewNativeSubIndicatorInstances(settings).find(
      (candidate) => candidate.indicator === 'WR',
    );

    expect(
      wr?.parameters?.find((parameter) => parameter.id === 'band:upper'),
    ).toMatchObject({ min: Number.NEGATIVE_INFINITY, value: -30 });
    expect(
      restored.indicators
        .find((indicator) => indicator.id === 'WR')
        ?.parameters?.find((parameter) => parameter.id === 'band:upper')?.value,
    ).toBe(-30);
    expect(instance?.settings?.bands?.upper?.value).toBe(-30);
  });

  it('keeps sub-indicator band width and line pattern independent', () => {
    for (const secondaryStyle of ['solid', 'dashed'] as const) {
      const value = createTradingViewNativeIndicatorSettingsValue();
      const rsi = value.indicators.find((indicator) => indicator.id === 'RSI');
      const upperBand = rsi?.lines.find((line) => line.id === 'band:upper');
      expect(upperBand).toMatchObject({
        secondaryStyle: 'dashed',
        showSecondaryStyle: true,
        style: 'solid',
      });
      if (!rsi || !upperBand) {
        return;
      }
      rsi.active = true;
      upperBand.style = 'bold';
      upperBand.secondaryStyle = secondaryStyle;

      const settings = getTradingViewNativeIndicatorSettings(value);
      const instance = getTradingViewNativeSubIndicatorInstances(settings).find(
        (candidate) => candidate.indicator === 'RSI',
      );

      expect(instance?.settings?.bands?.upper).toMatchObject({
        lineStyle: secondaryStyle,
        lineWidth: 3,
      });
      expect(
        getTradingViewNativeIndicatorSettingsValue(settings)
          .indicators.find((indicator) => indicator.id === 'RSI')
          ?.lines.find((line) => line.id === 'band:upper'),
      ).toMatchObject({ secondaryStyle, style: 'bold' });
    }
  });

  it('keeps configured values when quick controls toggle an indicator', () => {
    const value = getTradingViewNativeIndicatorSettingsValue(
      createTradingViewNativeIndicatorSettings(),
    );
    const boll = value.indicators.find((indicator) => indicator.id === 'BOLL');
    expect(boll).toBeDefined();
    if (!boll) {
      return;
    }
    const period = boll.parameters?.find(
      (parameter) => parameter.id === 'period',
    );
    expect(period).toBeDefined();
    if (period) {
      period.value = 30;
    }
    const settings = getTradingViewNativeIndicatorSettings(value);

    const activeSettings = updateTradingViewNativeIndicatorActiveState({
      active: true,
      indicator: 'BOLL',
      settings,
    });
    const inactiveSettings = updateTradingViewNativeIndicatorActiveState({
      active: false,
      indicator: 'BOLL',
      settings: activeSettings,
    });
    const restoredBoll = getTradingViewNativeIndicatorSettingsValue(
      inactiveSettings,
    ).indicators.find((indicator) => indicator.id === 'BOLL');

    expect(restoredBoll?.active).toBe(false);
    expect(
      restoredBoll?.parameters?.find((parameter) => parameter.id === 'period')
        ?.value,
    ).toBe(30);
  });
});
