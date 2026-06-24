import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';

import { useIntl } from 'react-intl';

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
            title="Main-chart indicators"
            indicators={mainIndicators}
            activeIndicatorValues={activeIndicatorValues}
            onIndicatorPress={handleIndicatorPress}
          />
          <IndicatorSection
            title="Sub-chart indicators"
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
  const [selectedChartType, setSelectedChartType] = useState(
    activeChartType ?? chartTypes[0]?.value,
  );
  const [selectedPriceMarketCapMode, setSelectedPriceMarketCapMode] = useState(
    priceMarketCap?.activeMode,
  );
  const [selectedPriceScaleMode, setSelectedPriceScaleMode] = useState(
    priceScale?.activeMode,
  );

  return (
    <YStack gap="$5" pb="$2">
      {chartTypes.length ? (
        <ChartSettingsSection title="Style">
          <ChartSettingsSegmentedControl
            testIDSection="style"
            options={chartTypes}
            activeValue={selectedChartType}
            onChange={(chartType) => {
              setSelectedChartType(chartType);
              onChartTypeChange(chartType);
            }}
          />
        </ChartSettingsSection>
      ) : null}

      {priceMarketCap?.enabled && priceMarketCap.options.length ? (
        <ChartSettingsSection title={priceMarketCap.label}>
          <ChartSettingsSegmentedControl
            testIDSection="data"
            options={priceMarketCap.options}
            activeValue={selectedPriceMarketCapMode}
            onChange={(mode) => {
              setSelectedPriceMarketCapMode(mode);
              onPriceMarketCapModeChange(mode);
            }}
          />
        </ChartSettingsSection>
      ) : null}

      {priceScale?.enabled && priceScale.options.length ? (
        <ChartSettingsSection title={priceScale.label}>
          <ChartSettingsSegmentedControl
            testIDSection="price-scale"
            options={priceScale.options}
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
    onIntervalChange,
    onIndicatorSelect,
    onChartTypeChange,
    onResetLayout,
    onPriceScaleModeChange,
    onPriceMarketCapModeChange,
  }: ITradingViewNativeChartControlsProps) => {
    const [activeIndicatorValues, setActiveIndicatorValues] = useState(
      () => new Set<string>(),
    );
    const pendingIndicatorActiveStateRef = useRef(new Map<string, boolean>());
    useEffect(() => {
      const activeValues = getActiveIndicatorValueSet(
        nativeChartControlsConfig?.indicators,
      );
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
    }, [nativeChartControlsConfig?.indicators]);
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
    const chartTypeToggleIcon = isLineChartType
      ? 'TradingViewLineOutline'
      : 'TradingViewCandlesOutline';
    const indicators = useMemo(
      () =>
        APP_NATIVE_INDICATOR_OPTIONS.map((indicator) => ({
          ...indicator,
          active: activeIndicatorValues.has(indicator.value),
        })),
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
      nativeChartControlsConfig &&
      indicatorsEnabled &&
      APP_NATIVE_INDICATOR_OPTIONS.length,
    );
    const hasVisibleControls =
      hasVisibleIntervalSelector ||
      canToggleChartType ||
      settingsEnabled ||
      hasVisibleIndicators;

    const handleNativeIndicatorSelect = useCallback(
      (indicatorName: string, desiredActive: boolean) => {
        pendingIndicatorActiveStateRef.current.set(
          indicatorName,
          desiredActive,
        );
        setActiveIndicatorValues((currentValues) => {
          const nextValues = new Set(currentValues);
          if (desiredActive) {
            nextValues.add(indicatorName);
          } else {
            nextValues.delete(indicatorName);
          }
          return nextValues;
        });
        onIndicatorSelect(indicatorName, desiredActive);
      },
      [onIndicatorSelect],
    );

    const showIndicatorsDialog = useCallback(() => {
      Dialog.show({
        title: 'Indicators',
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
    }, [handleNativeIndicatorSelect, indicators, onResetLayout, resetLayout]);

    const showChartSettingsDialog = useCallback(() => {
      if (!settingsEnabled) {
        return;
      }

      Dialog.show({
        title: 'Chart settings',
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
                title={`Switch to ${nextChartType?.label ?? 'Chart Type'}`}
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
                title="Indicators"
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
                title="Chart settings"
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
