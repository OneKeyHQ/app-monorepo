import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';

import { type IntlShape, useIntl } from 'react-intl';

import {
  Button,
  Dialog,
  IconButton,
  ScrollView,
  SizableText,
  Stack,
  XStack,
  YStack,
  useDialogInstance,
} from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';

import { TradingViewNativeIntervalSelector } from './TradingViewNativeIntervalSelector';

import type {
  ITradingViewChartTypeOption,
  ITradingViewIndicatorOption,
  ITradingViewIntervalConfigData,
  ITradingViewNativeChartControlsConfigData,
  ITradingViewPriceMarketCapMode,
  ITradingViewPriceScaleMode,
} from './types';

type IChartSettingsSegmentValue = number | string;

interface ITradingViewNativeChartControlsProps {
  intervalConfig: ITradingViewIntervalConfigData | null;
  nativeChartControlsConfig: ITradingViewNativeChartControlsConfigData | null;
  nativeIndicatorState: ITradingViewNativeIndicatorState;
  onIntervalChange: (interval: string) => void;
  onIndicatorSelect: (indicatorName: string, desiredActive: boolean) => void;
  onChartTypeChange: (chartType: number) => void;
  onResetLayout: () => void;
  onPriceScaleModeChange: (mode: ITradingViewPriceScaleMode) => void;
  onPriceMarketCapModeChange: (mode: ITradingViewPriceMarketCapMode) => void;
}

function buildIndicatorItemTestID(value: string): string {
  return `trading-view-native-indicator-item-${value
    .replace(/[^a-zA-Z0-9_-]/g, '-')
    .slice(0, 80)}`;
}

function buildIndicatorQuickBarItemTestID(value: string): string {
  return `trading-view-native-indicator-quick-bar-item-${value
    .replace(/[^a-zA-Z0-9_-]/g, '-')
    .slice(0, 80)}`;
}

function buildSettingsItemTestID(
  section: string,
  value: IChartSettingsSegmentValue,
): string {
  return `trading-view-native-settings-${section}-${String(value)
    .replace(/[^a-zA-Z0-9_-]/g, '-')
    .slice(0, 80)}`;
}

function getValidIntervalOptionCount(
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

function findChartTypeOption(
  chartTypes: ITradingViewChartTypeOption[],
  keyword: string,
) {
  return chartTypes.find((chartType) =>
    chartType.label.trim().toLowerCase().includes(keyword),
  );
}

function formatChartTypeOptionLabel(
  intl: IntlShape,
  chartType: ITradingViewChartTypeOption,
) {
  const normalizedLabel = chartType.label.trim().toLowerCase();
  if (normalizedLabel.includes('candle')) {
    return intl.formatMessage({ id: ETranslations.market_candle });
  }
  if (normalizedLabel.includes('line')) {
    return intl.formatMessage({ id: ETranslations.market_line });
  }

  return chartType.label;
}

function formatPriceMarketCapOptionLabel(
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

function formatPriceScaleOptionLabel(
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

const HEADER_ICON_BUTTON_STYLE_PROPS = {
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

const INDICATOR_GRID_COLUMN_COUNT = 4;
const INDICATOR_GRID_ITEM_LAYOUT_PROPS = {
  flex: 1,
  flexBasis: 0,
  h: 32,
  minWidth: 0,
  px: '$2',
  borderWidth: 1,
} as const;
const APP_NATIVE_INDICATOR_OPTIONS: ITradingViewIndicatorOption[] = [
  { label: 'MA', value: 'MA' },
  { label: 'EMA', value: 'EMA' },
  { label: 'BOLL', value: 'BOLL' },
  { label: 'SAR', value: 'SAR' },
  { label: 'VOL', value: 'VOL' },
  { label: 'MACD', value: 'MACD' },
  { label: 'RSI', value: 'RSI' },
  { label: 'StochRSI', value: 'StochRSI' },
  { label: 'OBV', value: 'OBV' },
  { label: 'MFI', value: 'MFI' },
  { label: 'TRIX', value: 'TRIX' },
  { label: 'EMV', value: 'EMV' },
  { label: 'WR', value: 'WR' },
  { label: 'ROC', value: 'ROC' },
  { label: 'MTM', value: 'MTM' },
  { label: 'DMI', value: 'DMI' },
  { label: 'CCI', value: 'CCI' },
];
const APP_NATIVE_INDICATOR_VALUE_SET = new Set(
  APP_NATIVE_INDICATOR_OPTIONS.map((indicator) => indicator.value),
);
const MAIN_CHART_INDICATOR_LABELS = ['MA', 'EMA', 'BOLL', 'SAR'];
const MAIN_CHART_INDICATOR_LABEL_SET = new Set<string>(
  MAIN_CHART_INDICATOR_LABELS,
);
export const TRADING_VIEW_NATIVE_INDICATOR_QUICK_BAR_HEIGHT = 31;

export interface ITradingViewNativeIndicatorState {
  activeIndicatorValues: Set<string>;
  updateActiveIndicatorValue: (
    indicatorValue: string,
    desiredActive: boolean,
  ) => void;
}

function getAppNativeIndicatorValue(indicator: ITradingViewIndicatorOption) {
  if (APP_NATIVE_INDICATOR_VALUE_SET.has(indicator.label)) {
    return indicator.label;
  }

  if (APP_NATIVE_INDICATOR_VALUE_SET.has(indicator.value)) {
    return indicator.value;
  }

  return null;
}

function getActiveIndicatorValueSet(
  indicators: ITradingViewIndicatorOption[] | undefined,
) {
  const activeValues = new Set<string>();
  indicators?.forEach((indicator) => {
    if (!indicator.active) {
      return;
    }

    const indicatorValue = getAppNativeIndicatorValue(indicator);
    if (indicatorValue) {
      activeValues.add(indicatorValue);
    }
  });
  return activeValues;
}

function getAppNativeIndicators(activeIndicatorValues: Set<string>) {
  return APP_NATIVE_INDICATOR_OPTIONS.map((indicator) => ({
    ...indicator,
    active: activeIndicatorValues.has(indicator.value),
  }));
}

export function useNativeIndicatorActiveValues(
  indicators: ITradingViewIndicatorOption[] | undefined,
): ITradingViewNativeIndicatorState {
  const [activeIndicatorValues, setActiveIndicatorValues] = useState(
    () => new Set<string>(),
  );
  const pendingIndicatorActiveStateRef = useRef(new Map<string, boolean>());

  useEffect(() => {
    if (!indicators) {
      pendingIndicatorActiveStateRef.current.clear();
      setActiveIndicatorValues(new Set<string>());
      return;
    }

    const activeValues = getActiveIndicatorValueSet(indicators);
    const pendingActiveState = pendingIndicatorActiveStateRef.current;
    pendingActiveState.forEach((desiredActive, indicatorValue) => {
      if (activeValues.has(indicatorValue) === desiredActive) {
        pendingActiveState.delete(indicatorValue);
      }
    });

    pendingActiveState.forEach((desiredActive, indicatorValue) => {
      if (desiredActive) {
        activeValues.add(indicatorValue);
      } else {
        activeValues.delete(indicatorValue);
      }
    });
    setActiveIndicatorValues(activeValues);
  }, [indicators]);

  const updateActiveIndicatorValue = useCallback(
    (indicatorValue: string, desiredActive: boolean) => {
      pendingIndicatorActiveStateRef.current.set(indicatorValue, desiredActive);
      setActiveIndicatorValues((currentValues) => {
        const nextValues = new Set(currentValues);
        if (desiredActive) {
          nextValues.add(indicatorValue);
        } else {
          nextValues.delete(indicatorValue);
        }
        return nextValues;
      });
    },
    [],
  );

  return {
    activeIndicatorValues,
    updateActiveIndicatorValue,
  };
}

function getIndicatorSections(indicators: ITradingViewIndicatorOption[]) {
  const mainIndicators: ITradingViewIndicatorOption[] = [];
  const subIndicators: ITradingViewIndicatorOption[] = [];

  indicators.forEach((indicator) => {
    if (MAIN_CHART_INDICATOR_LABEL_SET.has(indicator.label)) {
      mainIndicators.push(indicator);
    } else {
      subIndicators.push(indicator);
    }
  });

  return {
    mainIndicators,
    subIndicators,
  };
}

function IndicatorPill({
  indicator,
  isActive,
  onPress,
}: {
  indicator: ITradingViewIndicatorOption;
  isActive: boolean;
  onPress: () => void;
}) {
  return (
    <XStack
      key={indicator.value}
      testID={buildIndicatorItemTestID(indicator.value)}
      {...INDICATOR_GRID_ITEM_LAYOUT_PROPS}
      borderRadius="$full"
      borderCurve="continuous"
      borderColor={isActive ? '$bgReverse' : 'transparent'}
      alignItems="center"
      justifyContent="center"
      bg="$bgStrong"
      hoverStyle={{
        bg: '$bgStrongHover',
      }}
      pressStyle={{
        bg: '$bgStrongActive',
      }}
      cursor="pointer"
      userSelect="none"
      onPress={onPress}
    >
      <SizableText
        size="$bodyMdMedium"
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.82}
        color={isActive ? '$text' : '$textSubdued'}
      >
        {indicator.label}
      </SizableText>
    </XStack>
  );
}

function IndicatorGrid({
  indicators,
  activeIndicatorValues,
  onIndicatorPress,
}: {
  indicators: ITradingViewIndicatorOption[];
  activeIndicatorValues: Set<string>;
  onIndicatorPress: (indicator: ITradingViewIndicatorOption) => void;
}) {
  const rows = useMemo(() => {
    const result: ITradingViewIndicatorOption[][] = [];
    for (
      let index = 0;
      index < indicators.length;
      index += INDICATOR_GRID_COLUMN_COUNT
    ) {
      result.push(indicators.slice(index, index + INDICATOR_GRID_COLUMN_COUNT));
    }
    return result;
  }, [indicators]);

  return (
    <YStack gap="$2">
      {rows.map((row, rowIndex) => {
        const placeholderCount = INDICATOR_GRID_COLUMN_COUNT - row.length;
        return (
          <XStack key={`indicator-row-${rowIndex}`} gap="$2">
            {row.map((indicator) => (
              <IndicatorPill
                key={indicator.value}
                indicator={indicator}
                isActive={activeIndicatorValues.has(indicator.value)}
                onPress={() => onIndicatorPress(indicator)}
              />
            ))}
            {Array.from({ length: placeholderCount }).map((_, index) => (
              <Stack
                key={`indicator-placeholder-${rowIndex}-${index}`}
                {...INDICATOR_GRID_ITEM_LAYOUT_PROPS}
                borderColor="transparent"
                opacity={0}
                pointerEvents="none"
              />
            ))}
          </XStack>
        );
      })}
    </YStack>
  );
}

function IndicatorSection({
  title,
  indicators,
  activeIndicatorValues,
  onIndicatorPress,
}: {
  title: string;
  indicators: ITradingViewIndicatorOption[];
  activeIndicatorValues: Set<string>;
  onIndicatorPress: (indicator: ITradingViewIndicatorOption) => void;
}) {
  if (!indicators.length) {
    return null;
  }

  return (
    <YStack gap="$3">
      <SizableText size="$bodyMd" color="$textSubdued">
        {title}
      </SizableText>
      <IndicatorGrid
        indicators={indicators}
        activeIndicatorValues={activeIndicatorValues}
        onIndicatorPress={onIndicatorPress}
      />
    </YStack>
  );
}

function IndicatorQuickBarItem({
  indicator,
  isActive,
  onPress,
}: {
  indicator: ITradingViewIndicatorOption;
  isActive: boolean;
  onPress: () => void;
}) {
  return (
    <XStack
      testID={buildIndicatorQuickBarItemTestID(indicator.value)}
      h={TRADING_VIEW_NATIVE_INDICATOR_QUICK_BAR_HEIGHT}
      alignItems="center"
      justifyContent="center"
      cursor="pointer"
      userSelect="none"
      onPress={onPress}
    >
      <SizableText
        size={isActive ? '$bodySmMedium' : '$bodySm'}
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.82}
        color={isActive ? '$text' : '$textSubdued'}
      >
        {indicator.label}
      </SizableText>
    </XStack>
  );
}

export const TradingViewNativeIndicatorQuickBar = memo(
  ({
    nativeChartControlsConfig,
    nativeIndicatorState,
    onIndicatorSelect,
  }: Pick<
    ITradingViewNativeChartControlsProps,
    'nativeChartControlsConfig' | 'nativeIndicatorState' | 'onIndicatorSelect'
  >) => {
    const { activeIndicatorValues, updateActiveIndicatorValue } =
      nativeIndicatorState;
    const indicators = useMemo(
      () => getAppNativeIndicators(activeIndicatorValues),
      [activeIndicatorValues],
    );
    const { mainIndicators, subIndicators } = useMemo(
      () => getIndicatorSections(indicators),
      [indicators],
    );
    const indicatorsEnabled =
      nativeChartControlsConfig?.indicatorsEnabled !== false;
    const hasVisibleIndicators = Boolean(
      nativeChartControlsConfig && indicatorsEnabled && indicators.length,
    );

    const handleIndicatorPress = useCallback(
      (indicator: ITradingViewIndicatorOption) => {
        const desiredActive = !activeIndicatorValues.has(indicator.value);
        updateActiveIndicatorValue(indicator.value, desiredActive);
        onIndicatorSelect(indicator.label, desiredActive);
      },
      [activeIndicatorValues, onIndicatorSelect, updateActiveIndicatorValue],
    );

    if (!hasVisibleIndicators) {
      return null;
    }

    return (
      <Stack
        testID="trading-view-native-indicator-quick-bar"
        h={TRADING_VIEW_NATIVE_INDICATOR_QUICK_BAR_HEIGHT}
        bg="$bgApp"
        zIndex={3}
      >
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <XStack
            h={TRADING_VIEW_NATIVE_INDICATOR_QUICK_BAR_HEIGHT}
            px="$5"
            gap="$4"
            alignItems="center"
          >
            {mainIndicators.map((indicator) => (
              <IndicatorQuickBarItem
                key={indicator.value}
                indicator={indicator}
                isActive={activeIndicatorValues.has(indicator.value)}
                onPress={() => handleIndicatorPress(indicator)}
              />
            ))}
            {subIndicators.length ? (
              <Stack h="$4" w="$px" bg="$borderSubdued" />
            ) : null}
            {subIndicators.map((indicator) => (
              <IndicatorQuickBarItem
                key={indicator.value}
                indicator={indicator}
                isActive={activeIndicatorValues.has(indicator.value)}
                onPress={() => handleIndicatorPress(indicator)}
              />
            ))}
          </XStack>
        </ScrollView>
      </Stack>
    );
  },
);

TradingViewNativeIndicatorQuickBar.displayName =
  'TradingViewNativeIndicatorQuickBar';

function IndicatorListDialogContent({
  indicators,
  resetLayout,
  onSelect,
  onResetLayout,
}: {
  indicators: ITradingViewIndicatorOption[];
  resetLayout?: ITradingViewNativeChartControlsConfigData['resetLayout'];
  onSelect: (indicatorName: string, desiredActive: boolean) => void;
  onResetLayout: () => void;
}) {
  const intl = useIntl();
  const dialog = useDialogInstance();
  const [activeIndicatorValues, setActiveIndicatorValues] = useState(
    () =>
      new Set(
        indicators
          .filter((indicator) => indicator.active)
          .map((indicator) => indicator.value),
      ),
  );
  const originalActiveIndicatorValuesRef = useRef(activeIndicatorValues);
  const activeIndicatorValuesRef = useRef(activeIndicatorValues);
  const { mainIndicators, subIndicators } = useMemo(
    () => getIndicatorSections(indicators),
    [indicators],
  );

  const handleIndicatorPress = useCallback(
    (indicator: ITradingViewIndicatorOption) => {
      const nextValues = new Set(activeIndicatorValuesRef.current);
      const desiredActive = !nextValues.has(indicator.value);
      if (desiredActive) {
        nextValues.add(indicator.value);
      } else {
        nextValues.delete(indicator.value);
      }

      activeIndicatorValuesRef.current = nextValues;
      setActiveIndicatorValues(nextValues);
    },
    [],
  );

  const handleConfirmPress = useCallback(() => {
    const originalValues = originalActiveIndicatorValuesRef.current;
    const nextValues = activeIndicatorValuesRef.current;
    indicators.forEach((indicator) => {
      const desiredActive = nextValues.has(indicator.value);
      if (originalValues.has(indicator.value) !== desiredActive) {
        onSelect(indicator.label, desiredActive);
      }
    });
    void dialog.close();
  }, [dialog, indicators, onSelect]);

  const confirmText = intl.formatMessage({
    id: ETranslations.global_confirm,
  });
  const resetText = intl.formatMessage({
    id: ETranslations.global_reset,
  });

  const resetButton = resetLayout?.enabled ? (
    <Button
      flex={1}
      testID="trading-view-native-indicators-reset-layout-button"
      variant="secondary"
      size="large"
      onPress={() => {
        onResetLayout();
        void dialog.close();
      }}
    >
      {resetText}
    </Button>
  ) : null;

  const confirmButton = (
    <Button
      flex={1}
      testID="trading-view-native-indicators-confirm-button"
      variant="primary"
      size="large"
      onPress={handleConfirmPress}
    >
      {confirmText}
    </Button>
  );

  return (
    <YStack gap="$6" pb="$2">
      <ScrollView maxHeight={320} showsVerticalScrollIndicator={false}>
        <YStack gap="$6">
          <IndicatorSection
            title={intl.formatMessage({
              id: ETranslations.market_main_chart_indicators,
            })}
            indicators={mainIndicators}
            activeIndicatorValues={activeIndicatorValues}
            onIndicatorPress={handleIndicatorPress}
          />
          <IndicatorSection
            title={intl.formatMessage({
              id: ETranslations.market_sub_chart_indicators,
            })}
            indicators={subIndicators}
            activeIndicatorValues={activeIndicatorValues}
            onIndicatorPress={handleIndicatorPress}
          />
        </YStack>
      </ScrollView>
      <XStack gap="$3" pt="$2">
        {resetButton}
        {confirmButton}
      </XStack>
    </YStack>
  );
}

function ChartSettingsSegmentedControl<
  TValue extends IChartSettingsSegmentValue,
>({
  options,
  activeValue,
  testIDSection,
  onChange,
}: {
  options: {
    label: string;
    value: TValue;
  }[];
  activeValue: TValue | undefined;
  testIDSection: string;
  onChange: (value: TValue) => void;
}) {
  return (
    <XStack gap="$2">
      {options.map((option) => {
        const isActive = option.value === activeValue;
        return (
          <XStack
            key={String(option.value)}
            testID={buildSettingsItemTestID(testIDSection, option.value)}
            flex={1}
            h={44}
            minWidth={0}
            px="$3"
            borderWidth={1}
            borderRadius="$full"
            borderCurve="continuous"
            borderColor={isActive ? '$bgReverse' : 'transparent'}
            alignItems="center"
            justifyContent="center"
            bg="$bgStrong"
            overflow="hidden"
            hoverStyle={{ bg: '$bgStrongHover' }}
            pressStyle={{ bg: '$bgStrongActive' }}
            cursor="pointer"
            userSelect="none"
            onPress={() => {
              onChange(option.value);
            }}
          >
            <SizableText
              size="$bodyMdMedium"
              color={isActive ? '$text' : '$textSubdued'}
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.82}
            >
              {option.label}
            </SizableText>
          </XStack>
        );
      })}
    </XStack>
  );
}

function ChartSettingsSection({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <YStack gap="$2">
      <SizableText size="$bodySm" color="$textSubdued">
        {title}
      </SizableText>
      {children}
    </YStack>
  );
}

function ChartSettingsDialogContent({
  chartTypes,
  activeChartType,
  priceMarketCap,
  priceScale,
  onChartTypeChange,
  onPriceMarketCapModeChange,
  onPriceScaleModeChange,
}: {
  chartTypes: ITradingViewChartTypeOption[];
  activeChartType: number | undefined;
  priceMarketCap?: ITradingViewNativeChartControlsConfigData['priceMarketCap'];
  priceScale?: ITradingViewNativeChartControlsConfigData['priceScale'];
  onChartTypeChange: (chartType: number) => void;
  onPriceMarketCapModeChange: (mode: ITradingViewPriceMarketCapMode) => void;
  onPriceScaleModeChange: (mode: ITradingViewPriceScaleMode) => void;
}) {
  const intl = useIntl();
  const [selectedChartType, setSelectedChartType] = useState(
    activeChartType ?? chartTypes[0]?.value,
  );
  const [selectedPriceMarketCapMode, setSelectedPriceMarketCapMode] = useState(
    priceMarketCap?.activeMode,
  );
  const [selectedPriceScaleMode, setSelectedPriceScaleMode] = useState(
    priceScale?.activeMode,
  );
  const localizedChartTypes = useMemo(
    () =>
      chartTypes.map((chartType) => ({
        ...chartType,
        label: formatChartTypeOptionLabel(intl, chartType),
      })),
    [chartTypes, intl],
  );
  const localizedPriceMarketCapOptions = useMemo(
    () =>
      (priceMarketCap?.options ?? []).map((option) => ({
        ...option,
        label: formatPriceMarketCapOptionLabel(intl, option),
      })),
    [intl, priceMarketCap?.options],
  );
  const localizedPriceScaleOptions = useMemo(
    () =>
      (priceScale?.options ?? []).map((option) => ({
        ...option,
        label: formatPriceScaleOptionLabel(intl, option),
      })),
    [intl, priceScale?.options],
  );

  return (
    <YStack gap="$5" pb="$2">
      {chartTypes.length ? (
        <ChartSettingsSection
          title={intl.formatMessage({ id: ETranslations.market_chart_style })}
        >
          <ChartSettingsSegmentedControl
            testIDSection="style"
            options={localizedChartTypes}
            activeValue={selectedChartType}
            onChange={(chartType) => {
              setSelectedChartType(chartType);
              onChartTypeChange(chartType);
            }}
          />
        </ChartSettingsSection>
      ) : null}

      {priceMarketCap?.enabled && priceMarketCap.options.length ? (
        <ChartSettingsSection
          title={intl.formatMessage({ id: ETranslations.market_data_display })}
        >
          <ChartSettingsSegmentedControl
            testIDSection="data"
            options={localizedPriceMarketCapOptions}
            activeValue={selectedPriceMarketCapMode}
            onChange={(mode) => {
              setSelectedPriceMarketCapMode(mode);
              onPriceMarketCapModeChange(mode);
            }}
          />
        </ChartSettingsSection>
      ) : null}

      {priceScale?.enabled && priceScale.options.length ? (
        <ChartSettingsSection
          title={intl.formatMessage({ id: ETranslations.market_price_scale })}
        >
          <ChartSettingsSegmentedControl
            testIDSection="price-scale"
            options={localizedPriceScaleOptions}
            activeValue={selectedPriceScaleMode}
            onChange={(mode) => {
              setSelectedPriceScaleMode(mode);
              onPriceScaleModeChange(mode);
            }}
          />
        </ChartSettingsSection>
      ) : null}
    </YStack>
  );
}

export const TradingViewNativeChartControls = memo(
  ({
    intervalConfig,
    nativeChartControlsConfig,
    nativeIndicatorState,
    onIntervalChange,
    onIndicatorSelect,
    onChartTypeChange,
    onResetLayout,
    onPriceScaleModeChange,
    onPriceMarketCapModeChange,
  }: ITradingViewNativeChartControlsProps) => {
    const intl = useIntl();
    const { activeIndicatorValues, updateActiveIndicatorValue } =
      nativeIndicatorState;
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
      chartTypes.find(
        (chartType) => chartType.value !== candleChartType?.value,
      );
    const canToggleChartType = Boolean(candleChartType && lineChartType);
    const activeChartType = nativeChartControlsConfig?.activeChartType;
    const isLineChartType = activeChartType === lineChartType?.value;
    const nextChartType = isLineChartType ? candleChartType : lineChartType;
    const nextChartTypeLabel = nextChartType
      ? formatChartTypeOptionLabel(intl, nextChartType)
      : intl.formatMessage({ id: ETranslations.market_chart_style });
    const chartTypeToggleIcon = isLineChartType
      ? 'TradingViewLineOutline'
      : 'TradingViewCandlesOutline';
    const indicatorsTitle = intl.formatMessage({
      id: ETranslations.market_indicators,
    });
    const chartSettingsTitle = intl.formatMessage({
      id: ETranslations.market_chart_settings,
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
    const hasPriceScaleSettings = Boolean(
      priceScale?.enabled && priceScale.options.length,
    );
    const hasChartTypeSettings = canToggleChartType;
    const hasAnyChartSettings =
      hasChartTypeSettings ||
      hasPriceMarketCapSettings ||
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
      canToggleChartType ||
      settingsEnabled ||
      hasVisibleIndicators;

    const handleNativeIndicatorSelect = useCallback(
      (indicatorName: string, desiredActive: boolean) => {
        updateActiveIndicatorValue(indicatorName, desiredActive);
        onIndicatorSelect(indicatorName, desiredActive);
      },
      [onIndicatorSelect, updateActiveIndicatorValue],
    );

    const showIndicatorsDialog = useCallback(() => {
      Dialog.show({
        title: indicatorsTitle,
        showFooter: false,
        testID: 'trading-view-native-indicators-dialog',
        renderContent: (
          <IndicatorListDialogContent
            indicators={indicators}
            resetLayout={resetLayout}
            onSelect={handleNativeIndicatorSelect}
            onResetLayout={onResetLayout}
          />
        ),
      });
    }, [
      handleNativeIndicatorSelect,
      indicators,
      indicatorsTitle,
      onResetLayout,
      resetLayout,
    ]);

    const showChartSettingsDialog = useCallback(() => {
      if (!settingsEnabled) {
        return;
      }

      Dialog.show({
        title: chartSettingsTitle,
        showFooter: false,
        testID: 'trading-view-native-chart-settings-dialog',
        renderContent: (
          <ChartSettingsDialogContent
            chartTypes={chartTypes}
            activeChartType={activeChartType}
            priceMarketCap={priceMarketCap}
            priceScale={priceScale}
            onChartTypeChange={onChartTypeChange}
            onPriceMarketCapModeChange={onPriceMarketCapModeChange}
            onPriceScaleModeChange={onPriceScaleModeChange}
          />
        ),
      });
    }, [
      activeChartType,
      chartSettingsTitle,
      chartTypes,
      onChartTypeChange,
      onPriceMarketCapModeChange,
      onPriceScaleModeChange,
      priceMarketCap,
      priceScale,
      settingsEnabled,
    ]);

    const handleChartTypeToggle = useCallback(() => {
      if (nextChartType) {
        onChartTypeChange(nextChartType.value);
      }
    }, [nextChartType, onChartTypeChange]);

    if (!hasVisibleControls) {
      return null;
    }

    return (
      <Stack bg="$bgApp" px="$2" py="$2" zIndex={3}>
        <XStack
          alignItems="center"
          justifyContent="space-between"
          width="100%"
          gap="$2"
        >
          <XStack flex={1} minWidth={0} alignItems="center">
            {hasVisibleIntervalSelector ? (
              <TradingViewNativeIntervalSelector
                intervalConfig={intervalConfig}
                onIntervalChange={onIntervalChange}
              />
            ) : null}
          </XStack>

          <XStack gap="$2" alignItems="center" justifyContent="flex-end">
            {canToggleChartType ? (
              <IconButton
                testID="trading-view-native-chart-type-toggle"
                size="small"
                variant="tertiary"
                icon={chartTypeToggleIcon}
                iconSize="$5"
                title={nextChartTypeLabel}
                onPress={handleChartTypeToggle}
                {...HEADER_ICON_BUTTON_STYLE_PROPS}
              />
            ) : null}

            {hasVisibleIndicators ? (
              <IconButton
                testID="trading-view-native-indicators-trigger"
                size="small"
                variant="tertiary"
                icon="FunctionCustom"
                iconSize="$5"
                title={indicatorsTitle}
                onPress={showIndicatorsDialog}
                {...HEADER_ICON_BUTTON_STYLE_PROPS}
              />
            ) : null}

            {settingsEnabled ? (
              <IconButton
                testID="trading-view-native-chart-settings-trigger"
                size="small"
                variant="tertiary"
                icon="SliderHorOutline"
                iconSize="$5"
                title={chartSettingsTitle}
                onPress={showChartSettingsDialog}
                {...HEADER_ICON_BUTTON_STYLE_PROPS}
              />
            ) : null}
          </XStack>
        </XStack>
      </Stack>
    );
  },
);

TradingViewNativeChartControls.displayName = 'TradingViewNativeChartControls';
