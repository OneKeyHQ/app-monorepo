import {
  type ITradingViewNativeIndicatorSettingsItem,
  TRADING_VIEW_NATIVE_THEME_COLORS,
  createTradingViewNativeChartSettings,
} from '@onekeyhq/shared/types/tradingViewNative';

import {
  resolveTradingViewNativeChartThemeColors,
  resolveTradingViewNativeMainIndicatorThemeColors,
  resolveTradingViewNativeSubIndicatorThemeColors,
} from './chartThemeColors';

import type { ITradingViewSettingsThemeColorMap } from '../../TradingViewChartControls/chartSettings/TradingViewSettingsThemeColors';

const themeColors = {
  [TRADING_VIEW_NATIVE_THEME_COLORS.background]: '#010101',
  [TRADING_VIEW_NATIVE_THEME_COLORS.backgroundSubdued]: '#020202',
  [TRADING_VIEW_NATIVE_THEME_COLORS.band]: '#030303',
  [TRADING_VIEW_NATIVE_THEME_COLORS.brand]: '#040404',
  [TRADING_VIEW_NATIVE_THEME_COLORS.crosshair]: '#050505',
  [TRADING_VIEW_NATIVE_THEME_COLORS.grid]: '#060606',
  [TRADING_VIEW_NATIVE_THEME_COLORS.indicatorPrimary]: '#070707',
  [TRADING_VIEW_NATIVE_THEME_COLORS.indicatorPrimarySubdued]: '#071107',
  [TRADING_VIEW_NATIVE_THEME_COLORS.indicatorSecondary]: '#080808',
  [TRADING_VIEW_NATIVE_THEME_COLORS.indicatorTertiary]: '#090909',
  [TRADING_VIEW_NATIVE_THEME_COLORS.negative]: '#101010',
  [TRADING_VIEW_NATIVE_THEME_COLORS.negativeSubdued]: '#111111',
  [TRADING_VIEW_NATIVE_THEME_COLORS.positive]: '#121212',
  [TRADING_VIEW_NATIVE_THEME_COLORS.positiveSubdued]: '#131313',
  [TRADING_VIEW_NATIVE_THEME_COLORS.quaternary]: '#141414',
  [TRADING_VIEW_NATIVE_THEME_COLORS.quinary]: '#151515',
  [TRADING_VIEW_NATIVE_THEME_COLORS.warning]: '#161616',
} satisfies ITradingViewSettingsThemeColorMap;

describe('TradingViewNative theme colors', () => {
  it('resolves chart tokens while preserving custom colors', () => {
    const settings = createTradingViewNativeChartSettings();
    settings.candles.border.upColor = '#ABCDEF';

    const resolved = resolveTradingViewNativeChartThemeColors(
      settings,
      themeColors,
    );

    expect(resolved.background.colors).toEqual(['#010101', '#020202']);
    expect(resolved.grid.horizontalColor).toBe('#060606');
    expect(resolved.crossLine.color).toBe('#050505');
    expect(resolved.candles.body).toMatchObject({
      downColor: '#101010',
      upColor: '#121212',
    });
    expect(resolved.candles.border.upColor).toBe('#ABCDEF');
  });

  it('resolves main and sub indicator tokens before rendering', () => {
    const mainIndicator: ITradingViewNativeIndicatorSettingsItem = {
      active: true,
      id: 'MA',
      lines: {
        'line:0': {
          color: TRADING_VIEW_NATIVE_THEME_COLORS.brand,
          enabled: true,
          period: 5,
          style: 'solid',
        },
      },
      opacityColors: {
        downColor: TRADING_VIEW_NATIVE_THEME_COLORS.negative,
        upColor: TRADING_VIEW_NATIVE_THEME_COLORS.positive,
      },
      parameters: {},
      transparency: 0,
    };

    const main = resolveTradingViewNativeMainIndicatorThemeColors(
      { MA: mainIndicator },
      themeColors,
    );
    const sub = resolveTradingViewNativeSubIndicatorThemeColors(
      [
        {
          id: 'VOL',
          indicator: 'VOL',
          settings: {
            palettes: {
              volume: [
                TRADING_VIEW_NATIVE_THEME_COLORS.negative,
                TRADING_VIEW_NATIVE_THEME_COLORS.positive,
              ],
            },
            plots: {
              movingAverage: {
                color: TRADING_VIEW_NATIVE_THEME_COLORS.indicatorPrimary,
              },
            },
          },
        },
      ],
      themeColors,
    );

    expect(main.MA?.lines['line:0']?.color).toBe('#040404');
    expect(main.MA?.opacityColors).toEqual({
      downColor: '#101010',
      upColor: '#121212',
    });
    expect(sub[0]?.settings?.palettes?.volume).toEqual(['#101010', '#121212']);
    expect(sub[0]?.settings?.plots?.movingAverage?.color).toBe('#070707');
  });
});
