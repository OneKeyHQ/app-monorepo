import type {
  ITradingViewIntervalConfigData,
  ITradingViewIntervalOption,
  ITradingViewNativeChartControlsConfigData,
} from '../../../types';

// TradingView defines SeriesType.HLCBars as 21; the app bridge fixture was
// introduced in c1bb2df6c5.
const REMOVED_HLC_CHART_TYPE = {
  label: 'candles hlc',
  value: 21,
} as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

export function normalizeTradingViewLayoutRestored(value: unknown) {
  return typeof value === 'boolean' ? value : undefined;
}

export function normalizeTradingViewChartTypeState(
  chartTypes: unknown,
  activeChartType: unknown,
): {
  chartTypes: ITradingViewNativeChartControlsConfigData['chartTypes'];
  activeChartType: number;
  chartTypeToSync?: number;
} | null {
  const activeValue = Number(activeChartType);
  if (!Array.isArray(chartTypes) || !Number.isFinite(activeValue)) {
    return null;
  }

  const normalizedChartTypes: ITradingViewNativeChartControlsConfigData['chartTypes'] =
    [];
  let removedActiveHlcChartType = false;
  for (const chartType of chartTypes) {
    if (!isRecord(chartType)) {
      return null;
    }

    const label =
      typeof chartType.label === 'string' ? chartType.label.trim() : '';
    const value = Number(chartType.value);
    if (!label || !Number.isFinite(value)) {
      return null;
    }

    const isRemovedHlcChartType =
      value === REMOVED_HLC_CHART_TYPE.value &&
      label.toLowerCase() === REMOVED_HLC_CHART_TYPE.label;
    if (isRemovedHlcChartType) {
      removedActiveHlcChartType ||= value === activeValue;
    } else {
      normalizedChartTypes.push({ label, value });
    }
  }

  const activeChartTypeStillExists = normalizedChartTypes.some(
    (chartType) => chartType.value === activeValue,
  );
  const fallbackChartType =
    normalizedChartTypes.find((chartType) => {
      const normalizedLabel = chartType.label.toLowerCase();
      return normalizedLabel === 'candle' || normalizedLabel === 'candles';
    }) ?? normalizedChartTypes[0];
  if (
    removedActiveHlcChartType &&
    !activeChartTypeStillExists &&
    fallbackChartType
  ) {
    return {
      chartTypes: normalizedChartTypes,
      activeChartType: fallbackChartType.value,
      chartTypeToSync: fallbackChartType.value,
    };
  }

  return {
    chartTypes: normalizedChartTypes,
    activeChartType: activeValue,
  };
}

interface INormalizedNativeChartControlsConfig {
  config: ITradingViewNativeChartControlsConfigData;
  chartTypeToSync?: number;
}

function normalizeStringOptionDisabled(option: Record<string, unknown>) {
  if (typeof option.disabled === 'boolean') {
    return option.disabled;
  }
  if (typeof option.enabled === 'boolean') {
    return !option.enabled;
  }
  if (typeof option.available === 'boolean') {
    return !option.available;
  }
  if (typeof option.selectable === 'boolean') {
    return !option.selectable;
  }
  return undefined;
}

function normalizeStringOptions(
  options: unknown,
): { label: string; value: string }[] | null {
  if (!Array.isArray(options)) {
    return null;
  }

  const normalizedOptions: { label: string; value: string }[] = [];
  for (const option of options) {
    if (!isRecord(option)) {
      return null;
    }

    const label = typeof option.label === 'string' ? option.label.trim() : '';
    const value = typeof option.value === 'string' ? option.value.trim() : '';
    if (!label || !value) {
      return null;
    }

    normalizedOptions.push({ label, value });
  }

  return normalizedOptions;
}

function normalizeIntervalOptions(
  options: unknown,
): ITradingViewIntervalOption[] | null {
  const normalizedOptions = normalizeStringOptions(options);
  if (!normalizedOptions) {
    return null;
  }

  return normalizedOptions.map((option, index) => {
    const rawOption = Array.isArray(options) ? options[index] : null;
    const disabled = isRecord(rawOption)
      ? normalizeStringOptionDisabled(rawOption)
      : undefined;
    return {
      ...option,
      ...(disabled === undefined ? {} : { disabled }),
    };
  });
}

export function normalizeIntervalConfig(
  data: unknown,
): ITradingViewIntervalConfigData | null {
  if (!isRecord(data)) {
    return null;
  }

  const intervals = normalizeIntervalOptions(data.intervals);
  const activeInterval =
    typeof data.activeInterval === 'string' ? data.activeInterval.trim() : '';
  if (!intervals?.length || !activeInterval) {
    return null;
  }

  return {
    intervals,
    activeInterval,
    ...(typeof data.persist === 'boolean' ? { persist: data.persist } : {}),
    ...(typeof data.timestamp === 'number' && Number.isFinite(data.timestamp)
      ? { timestamp: data.timestamp }
      : {}),
  };
}

function normalizeIndicators(
  indicators: unknown,
): ITradingViewNativeChartControlsConfigData['indicators'] | null {
  const options = normalizeStringOptions(indicators);
  if (!options) {
    return null;
  }

  return options.map((option, index) => {
    const rawIndicator = Array.isArray(indicators) ? indicators[index] : null;
    return {
      ...option,
      ...(isRecord(rawIndicator) && typeof rawIndicator.active === 'boolean'
        ? { active: rawIndicator.active }
        : {}),
    };
  });
}

function normalizeResetLayout(
  resetLayout: unknown,
): ITradingViewNativeChartControlsConfigData['resetLayout'] | undefined {
  if (!isRecord(resetLayout)) {
    return undefined;
  }

  const label =
    typeof resetLayout.label === 'string' ? resetLayout.label.trim() : '';
  if (typeof resetLayout.enabled !== 'boolean' || !label) {
    return undefined;
  }

  return {
    enabled: resetLayout.enabled,
    label,
  };
}

type IPriceMarketCapConfig = NonNullable<
  ITradingViewNativeChartControlsConfigData['priceMarketCap']
>;

function normalizePriceMarketCapOptions(
  options: unknown,
): IPriceMarketCapConfig['options'] | null {
  if (!Array.isArray(options)) {
    return null;
  }

  const normalizedOptions: IPriceMarketCapConfig['options'] = [];
  for (const option of options) {
    if (!isRecord(option)) {
      return null;
    }

    const label = typeof option.label === 'string' ? option.label.trim() : '';
    const value = option.value;
    if (!label || (value !== 'price' && value !== 'marketcap')) {
      return null;
    }

    normalizedOptions.push({ label, value });
  }

  return normalizedOptions;
}

function normalizePriceMarketCap(
  priceMarketCap: unknown,
): ITradingViewNativeChartControlsConfigData['priceMarketCap'] | undefined {
  if (!isRecord(priceMarketCap)) {
    return undefined;
  }

  const label =
    typeof priceMarketCap.label === 'string' ? priceMarketCap.label.trim() : '';
  const options = normalizePriceMarketCapOptions(priceMarketCap.options);
  const activeMode = priceMarketCap.activeMode;
  if (
    typeof priceMarketCap.enabled !== 'boolean' ||
    !label ||
    !options ||
    (activeMode !== 'price' && activeMode !== 'marketcap')
  ) {
    return undefined;
  }

  return {
    enabled: priceMarketCap.enabled,
    label,
    options,
    activeMode,
  };
}

type IPriceScaleConfig = NonNullable<
  ITradingViewNativeChartControlsConfigData['priceScale']
>;

function normalizePriceScaleOptions(
  options: unknown,
): IPriceScaleConfig['options'] | null {
  if (!Array.isArray(options)) {
    return null;
  }

  const normalizedOptions: IPriceScaleConfig['options'] = [];
  for (const option of options) {
    if (!isRecord(option)) {
      return null;
    }

    const label = typeof option.label === 'string' ? option.label.trim() : '';
    const value = option.value;
    if (
      !label ||
      (value !== 'auto' && value !== 'log' && value !== 'percentage')
    ) {
      return null;
    }

    normalizedOptions.push({ label, value });
  }

  return normalizedOptions;
}

function normalizePriceScale(
  priceScale: unknown,
): ITradingViewNativeChartControlsConfigData['priceScale'] | undefined {
  if (!isRecord(priceScale)) {
    return undefined;
  }

  const label =
    typeof priceScale.label === 'string' ? priceScale.label.trim() : '';
  const options = normalizePriceScaleOptions(priceScale.options);
  const activeMode = priceScale.activeMode;
  if (
    typeof priceScale.enabled !== 'boolean' ||
    !label ||
    !options ||
    (activeMode !== 'auto' &&
      activeMode !== 'log' &&
      activeMode !== 'percentage')
  ) {
    return undefined;
  }

  return {
    enabled: priceScale.enabled,
    label,
    options,
    activeMode,
  };
}

export function normalizeNativeChartControlsConfig(
  data: unknown,
): INormalizedNativeChartControlsConfig | null {
  if (!isRecord(data)) {
    return null;
  }

  const indicators = normalizeIndicators(data.indicators);
  const chartTypeState = normalizeTradingViewChartTypeState(
    data.chartTypes,
    data.activeChartType,
  );
  if (!indicators || !chartTypeState) {
    return null;
  }

  const intervals =
    data.intervals === undefined
      ? undefined
      : normalizeIntervalOptions(data.intervals);
  if (data.intervals !== undefined && !intervals) {
    return null;
  }

  const activeInterval =
    typeof data.activeInterval === 'string' ? data.activeInterval.trim() : '';
  const resetLayout = normalizeResetLayout(data.resetLayout);
  const priceMarketCap = normalizePriceMarketCap(data.priceMarketCap);
  const priceScale = normalizePriceScale(data.priceScale);
  const layoutRestored = normalizeTradingViewLayoutRestored(
    data.layoutRestored,
  );

  return {
    config: {
      ...(intervals?.length ? { intervals } : {}),
      ...(activeInterval ? { activeInterval } : {}),
      ...(typeof data.indicatorsEnabled === 'boolean'
        ? { indicatorsEnabled: data.indicatorsEnabled }
        : {}),
      indicators,
      ...(typeof data.chartTypesEnabled === 'boolean'
        ? { chartTypesEnabled: data.chartTypesEnabled }
        : {}),
      chartTypes: chartTypeState.chartTypes,
      activeChartType: chartTypeState.activeChartType,
      ...(resetLayout ? { resetLayout } : {}),
      ...(priceMarketCap ? { priceMarketCap } : {}),
      ...(priceScale ? { priceScale } : {}),
      ...(layoutRestored !== undefined ? { layoutRestored } : {}),
      ...(typeof data.timestamp === 'number' && Number.isFinite(data.timestamp)
        ? { timestamp: data.timestamp }
        : {}),
    },
    ...(chartTypeState.chartTypeToSync !== undefined
      ? { chartTypeToSync: chartTypeState.chartTypeToSync }
      : {}),
  };
}
