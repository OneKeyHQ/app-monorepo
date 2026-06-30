import { useMemo } from 'react';

import { useIntl } from 'react-intl';

import type { IKeyOfIcons } from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';

import { getAppNativeIndicators } from '../../indicatorControls/hooks/useNativeIndicatorActiveValues';
import {
  findChartTypeOption,
  formatChartTypeOptionLabel,
  getValidIntervalOptionCount,
} from '../../utils/NativeChartControlsShared';

import type {
  ITradingViewIntervalConfigData,
  ITradingViewNativeChartControlsConfigData,
} from '../../../types';
import type { ITradingViewNativeIndicatorState } from '../../indicatorControls/hooks/useNativeIndicatorActiveValues';
import type {
  ITradingViewNativeChartTypeControlMode,
  ITradingViewNativeIndicatorControlMode,
  ITradingViewNativePriceMarketCapControlMode,
} from '../../utils/NativeChartControlsShared';

export function useNativeChartControls({
  intervalConfig,
  nativeChartControlsConfig,
  nativeIndicatorState,
  chartTypeControlMode,
  indicatorControlMode,
  priceMarketCapControlMode,
}: {
  intervalConfig: ITradingViewIntervalConfigData | null;
  nativeChartControlsConfig: ITradingViewNativeChartControlsConfigData | null;
  nativeIndicatorState: ITradingViewNativeIndicatorState;
  chartTypeControlMode: ITradingViewNativeChartTypeControlMode;
  indicatorControlMode: ITradingViewNativeIndicatorControlMode;
  priceMarketCapControlMode: ITradingViewNativePriceMarketCapControlMode;
}) {
  const intl = useIntl();
  const { activeIndicatorValues } = nativeIndicatorState;
  const chartTypesEnabled =
    nativeChartControlsConfig?.chartTypesEnabled !== false;
  const chartTypes = useMemo(
    () =>
      chartTypesEnabled ? (nativeChartControlsConfig?.chartTypes ?? []) : [],
    [chartTypesEnabled, nativeChartControlsConfig?.chartTypes],
  );
  const candleChartType =
    findChartTypeOption(chartTypes, 'candle') ?? chartTypes[0];
  const lineChartType =
    findChartTypeOption(chartTypes, 'line') ??
    chartTypes.find((chartType) => chartType.value !== candleChartType?.value);
  const canToggleChartType = Boolean(candleChartType && lineChartType);
  const canSelectChartType = chartTypes.length > 1;
  const activeChartType = nativeChartControlsConfig?.activeChartType;
  const isLineChartType = activeChartType === lineChartType?.value;
  const nextChartType = isLineChartType ? candleChartType : lineChartType;
  const nextChartTypeLabel = nextChartType
    ? formatChartTypeOptionLabel(intl, nextChartType)
    : intl.formatMessage({ id: ETranslations.market_chart_style });
  const chartTypeToggleIcon: IKeyOfIcons = isLineChartType
    ? 'TradingViewLineOutline'
    : 'TradingViewCandlesOutline';
  const indicatorsTitle = intl.formatMessage({
    id: ETranslations.market_indicators,
  });
  const chartSettingsTitle = intl.formatMessage({
    id: ETranslations.market_chart_settings,
  });
  const chartStyleTitle = intl.formatMessage({
    id: ETranslations.market_chart_style,
  });
  const indicators = useMemo(
    () => getAppNativeIndicators(activeIndicatorValues),
    [activeIndicatorValues],
  );
  const indicatorsEnabled =
    nativeChartControlsConfig?.indicatorsEnabled !== false;
  const resetLayout = nativeChartControlsConfig?.resetLayout;
  const priceMarketCap = nativeChartControlsConfig?.priceMarketCap;
  const priceScale = nativeChartControlsConfig?.priceScale;
  const hasPriceMarketCapSettings = Boolean(
    priceMarketCap?.enabled && priceMarketCap.options.length,
  );
  const canSelectPriceMarketCap = Boolean(
    priceMarketCap?.enabled && priceMarketCap.options.length > 1,
  );
  const hasPriceScaleSettings = Boolean(
    priceScale?.enabled && priceScale.options.length,
  );
  const showChartTypeSelect =
    chartTypeControlMode === 'select' && canSelectChartType;
  const showChartTypeToggle =
    chartTypeControlMode !== 'select' && canToggleChartType;
  const showPriceMarketCapSelect =
    priceMarketCapControlMode === 'select' && canSelectPriceMarketCap;
  const priceMarketCapSettings =
    showPriceMarketCapSelect || !hasPriceMarketCapSettings
      ? undefined
      : priceMarketCap;
  const showIndicatorPopover = indicatorControlMode === 'popover';
  const hasChartTypeSettings = canToggleChartType;
  const hasPriceMarketCapSettingsInDialog = Boolean(priceMarketCapSettings);
  const hasAnyChartSettings =
    hasChartTypeSettings ||
    hasPriceMarketCapSettingsInDialog ||
    hasPriceScaleSettings;
  const settingsEnabled = Boolean(
    nativeChartControlsConfig && hasAnyChartSettings,
  );
  const hasVisibleIntervalSelector =
    getValidIntervalOptionCount(intervalConfig) > 1;
  const hasVisibleIndicators = Boolean(
    nativeChartControlsConfig && indicatorsEnabled && indicators.length,
  );
  const hasVisibleControls =
    hasVisibleIntervalSelector ||
    showChartTypeSelect ||
    showChartTypeToggle ||
    showPriceMarketCapSelect ||
    settingsEnabled ||
    hasVisibleIndicators;

  return {
    activeChartType,
    activeIndicatorValues,
    chartSettingsTitle,
    chartStyleTitle,
    chartTypeToggleIcon,
    chartTypes,
    hasVisibleControls,
    hasVisibleIndicators,
    hasVisibleIntervalSelector,
    indicators,
    indicatorsTitle,
    nextChartType,
    nextChartTypeLabel,
    priceMarketCap,
    priceMarketCapSettings,
    priceScale,
    resetLayout,
    settingsEnabled,
    showChartTypeSelect,
    showChartTypeToggle,
    showIndicatorPopover,
    showPriceMarketCapSelect,
  };
}
