// cspell:words heikin ashi
import { ETranslations } from '@onekeyhq/shared/src/locale';
import type { ITradingViewNativeChartType } from '@onekeyhq/shared/types/tradingViewNative';

import type {
  IChartSettingsSegmentValue,
  ITradingViewChartTypeOption,
  ITradingViewIntervalConfigData,
  ITradingViewNativeChartControlsConfigData,
} from '../types';
import type { IntlShape } from 'react-intl';

export type {
  IChartSettingsSegmentValue,
  ITradingViewNativeChartTypeControlMode,
  ITradingViewNativeControlsLayoutMode,
  ITradingViewNativeIndicatorControlMode,
  ITradingViewNativePriceMarketCapControlMode,
} from '../types';

export const HEADER_ICON_BUTTON_STYLE_PROPS = {
  m: '$0',
  bg: '$transparent',
  hoverStyle: {
    bg: '$bgHover',
  },
  pressStyle: {
    bg: '$bgActive',
  },
  iconProps: {
    color: '$iconSubdued',
  },
} as const;

const CHART_TYPE_TRANSLATIONS = {
  area: ETranslations.market_area,
  bars: ETranslations.market_bars,
  candlestick: ETranslations.market_candle,
  heikinAshi: ETranslations.market_heikin_ashi,
  line: ETranslations.market_line,
} as const satisfies Record<ITradingViewNativeChartType, ETranslations>;

const CHART_TYPE_ICONS = {
  area: 'ChartTrending2Outline',
  bars: 'TradingViewCandlesHlcOutline',
  candlestick: 'TradingViewCandlesOutline',
  heikinAshi: 'TradingViewBarsOutline',
  line: 'TradingViewLineOutline',
} as const satisfies Record<ITradingViewNativeChartType, string>;

export function buildSettingsItemTestID(
  section: string,
  value: IChartSettingsSegmentValue,
): string {
  return `trading-view-native-settings-${section}-${String(value)
    .replace(/[^a-zA-Z0-9_-]/g, '-')
    .slice(0, 80)}`;
}

export function getValidIntervalOptionCount(
  intervalConfig: ITradingViewIntervalConfigData | null,
) {
  const seenValues = new Set<string>();
  return (intervalConfig?.intervals ?? []).reduce((count, option) => {
    const value = option.value?.trim();
    const label = option.label?.trim();
    if (!value || !label || seenValues.has(value)) {
      return count;
    }

    seenValues.add(value);
    return count + 1;
  }, 0);
}

export function findChartTypeOption(
  chartTypes: ITradingViewChartTypeOption[],
  keyword: string,
) {
  return chartTypes.find(
    (chartType) =>
      chartType.id?.toLowerCase().includes(keyword) ||
      chartType.label.trim().toLowerCase().includes(keyword),
  );
}

export function formatChartTypeOptionLabel(
  intl: IntlShape,
  chartType: ITradingViewChartTypeOption,
) {
  const label = chartType.label.trim();
  if (chartType.id) {
    return intl.formatMessage({ id: CHART_TYPE_TRANSLATIONS[chartType.id] });
  }
  const normalizedLabel = label.toLowerCase();
  if (normalizedLabel === 'candle' || normalizedLabel === 'candles') {
    return intl.formatMessage({ id: ETranslations.market_candle });
  }
  if (normalizedLabel === 'heikin ashi') {
    return intl.formatMessage({ id: ETranslations.market_heikin_ashi });
  }
  if (normalizedLabel === 'bars') {
    return intl.formatMessage({ id: ETranslations.market_bars });
  }
  if (normalizedLabel === 'line') {
    return intl.formatMessage({ id: ETranslations.market_line });
  }
  if (normalizedLabel === 'area') {
    return intl.formatMessage({ id: ETranslations.market_area });
  }

  return label;
}

export function getChartTypeIconName(chartType?: ITradingViewChartTypeOption) {
  if (chartType?.id) {
    return CHART_TYPE_ICONS[chartType.id];
  }
  const normalizedLabel = chartType?.label.trim().toLowerCase() ?? '';
  if (normalizedLabel.includes('heikin')) {
    return 'TradingViewBarsOutline';
  }
  if (normalizedLabel.includes('bar')) {
    return 'TradingViewCandlesHlcOutline';
  }
  if (normalizedLabel.includes('line')) {
    return 'TradingViewLineOutline';
  }
  if (normalizedLabel.includes('area')) {
    return 'ChartTrending2Outline';
  }

  return 'TradingViewCandlesOutline';
}

export function formatPriceMarketCapOptionLabel(
  intl: IntlShape,
  option: NonNullable<
    ITradingViewNativeChartControlsConfigData['priceMarketCap']
  >['options'][number],
) {
  if (option.value === 'price') {
    return intl.formatMessage({ id: ETranslations.global_price });
  }
  if (option.value === 'marketcap') {
    return intl.formatMessage({ id: ETranslations.global_market_cap });
  }

  return option.label;
}

export function isPriceMarketCapMode(
  value: unknown,
  options: NonNullable<
    ITradingViewNativeChartControlsConfigData['priceMarketCap']
  >['options'],
): value is NonNullable<
  ITradingViewNativeChartControlsConfigData['priceMarketCap']
>['activeMode'] {
  return (
    typeof value === 'string' &&
    options.some((option) => option.value === value)
  );
}

export function formatPriceScaleOptionLabel(
  intl: IntlShape,
  option: NonNullable<
    ITradingViewNativeChartControlsConfigData['priceScale']
  >['options'][number],
) {
  if (option.value === 'auto') {
    return intl.formatMessage({ id: ETranslations.global_auto });
  }

  return option.label;
}
