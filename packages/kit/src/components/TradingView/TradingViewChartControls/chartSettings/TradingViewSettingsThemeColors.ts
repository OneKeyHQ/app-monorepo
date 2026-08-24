import { useMemo } from 'react';

import { colord } from 'colord';

import { useTheme } from '@onekeyhq/components';
import {
  type ITradingViewNativeThemeColor,
  TRADING_VIEW_NATIVE_THEME_COLORS,
} from '@onekeyhq/shared/types/tradingViewNative';

export type ITradingViewSettingsThemeColorMap = Record<
  ITradingViewNativeThemeColor,
  string
>;

function getTradingViewColorChannels(color: string, fallbackHex: string) {
  const rawHex = color
    .trim()
    .match(/^#([\da-f]{3,4}|[\da-f]{6}|[\da-f]{8})$/i)?.[1];
  const hex =
    rawHex && rawHex.length <= 4
      ? rawHex
          .split('')
          .map((character) => `${character}${character}`)
          .join('')
      : (rawHex ?? fallbackHex.slice(1));
  return {
    r: Number.parseInt(hex.slice(0, 2), 16),
    g: Number.parseInt(hex.slice(2, 4), 16),
    b: Number.parseInt(hex.slice(4, 6), 16),
    a: hex.length === 8 ? Number.parseInt(hex.slice(6, 8), 16) / 255 : 1,
  };
}

export function resolveTradingViewSettingsThemeColor(
  color: string,
  themeColors: ITradingViewSettingsThemeColorMap,
) {
  return themeColors[color as ITradingViewNativeThemeColor] ?? color;
}

export function flattenTradingViewSettingsThemeColor(
  color: string,
  background: string,
) {
  const foregroundColor = colord(color);
  const backgroundColor = colord(background);
  if (!foregroundColor.isValid() || !backgroundColor.isValid()) {
    return color;
  }

  const foreground = getTradingViewColorChannels(
    color,
    foregroundColor.toHex(),
  );
  const backdrop = getTradingViewColorChannels(
    background,
    backgroundColor.toHex(),
  );
  if (foreground.a >= 1 || backdrop.a < 1) {
    return color;
  }

  // Theme primitives use alpha colors that CSS composites once against a
  // surface. Chart renderers layer candle fills, wicks, and borders, so they
  // need the equivalent opaque result to avoid blending the same color twice.
  return colord({
    r: Math.round(
      foreground.r * foreground.a + backdrop.r * (1 - foreground.a),
    ),
    g: Math.round(
      foreground.g * foreground.a + backdrop.g * (1 - foreground.a),
    ),
    b: Math.round(
      foreground.b * foreground.a + backdrop.b * (1 - foreground.a),
    ),
    a: 1,
  }).toHex();
}

export function useTradingViewSettingsThemeColors(): ITradingViewSettingsThemeColorMap {
  const theme = useTheme();
  const background = theme.bgApp.val;
  const backgroundSubduedValue = theme.bgSubdued.val;
  const bandValue = theme.neutral9.val;
  const brandValue = theme.brand9.val;
  const crosshairValue = theme.textSubdued.val;
  const gridValue = theme.borderSubdued.val;
  const indicatorPrimaryValue = theme.blue9.val;
  const indicatorPrimarySubduedValue = theme.blue3.val;
  const indicatorSecondaryValue = theme.orange9.val;
  const indicatorTertiaryValue = theme.purple9.val;
  const negativeValue = theme.red9.val;
  const negativeSubduedValue = theme.red6.val;
  const positiveValue = theme.green9.val;
  const positiveSubduedValue = theme.green6.val;
  const quaternaryValue = theme.pink9.val;
  const quinaryValue = theme.cyan9.val;
  const warningValue = theme.amber9.val;

  return useMemo(() => {
    const flatten = (color: string) =>
      flattenTradingViewSettingsThemeColor(color, background);

    return {
      [TRADING_VIEW_NATIVE_THEME_COLORS.background]: background,
      [TRADING_VIEW_NATIVE_THEME_COLORS.backgroundSubdued]: flatten(
        backgroundSubduedValue,
      ),
      [TRADING_VIEW_NATIVE_THEME_COLORS.band]: flatten(bandValue),
      [TRADING_VIEW_NATIVE_THEME_COLORS.brand]: flatten(brandValue),
      [TRADING_VIEW_NATIVE_THEME_COLORS.crosshair]: flatten(crosshairValue),
      [TRADING_VIEW_NATIVE_THEME_COLORS.grid]: flatten(gridValue),
      [TRADING_VIEW_NATIVE_THEME_COLORS.indicatorPrimary]: flatten(
        indicatorPrimaryValue,
      ),
      [TRADING_VIEW_NATIVE_THEME_COLORS.indicatorPrimarySubdued]: flatten(
        indicatorPrimarySubduedValue,
      ),
      [TRADING_VIEW_NATIVE_THEME_COLORS.indicatorSecondary]: flatten(
        indicatorSecondaryValue,
      ),
      [TRADING_VIEW_NATIVE_THEME_COLORS.indicatorTertiary]: flatten(
        indicatorTertiaryValue,
      ),
      [TRADING_VIEW_NATIVE_THEME_COLORS.negative]: flatten(negativeValue),
      [TRADING_VIEW_NATIVE_THEME_COLORS.negativeSubdued]:
        flatten(negativeSubduedValue),
      [TRADING_VIEW_NATIVE_THEME_COLORS.positive]: flatten(positiveValue),
      [TRADING_VIEW_NATIVE_THEME_COLORS.positiveSubdued]:
        flatten(positiveSubduedValue),
      [TRADING_VIEW_NATIVE_THEME_COLORS.quaternary]: flatten(quaternaryValue),
      [TRADING_VIEW_NATIVE_THEME_COLORS.quinary]: flatten(quinaryValue),
      [TRADING_VIEW_NATIVE_THEME_COLORS.warning]: flatten(warningValue),
    };
  }, [
    background,
    backgroundSubduedValue,
    bandValue,
    brandValue,
    crosshairValue,
    gridValue,
    indicatorPrimaryValue,
    indicatorPrimarySubduedValue,
    indicatorSecondaryValue,
    indicatorTertiaryValue,
    negativeValue,
    negativeSubduedValue,
    positiveValue,
    positiveSubduedValue,
    quaternaryValue,
    quinaryValue,
    warningValue,
  ]);
}
