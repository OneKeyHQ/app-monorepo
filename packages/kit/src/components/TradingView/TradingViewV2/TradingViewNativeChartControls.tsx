import { memo, useCallback, useMemo, useRef, useState } from 'react';
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

const EMPTY_INDICATORS: ITradingViewIndicatorOption[] = [];
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
        onSelect(indicator.value, desiredActive);
      }
    });
    void dialog.close();
  }, [dialog, indicators, onSelect]);

  const confirmText = intl.formatMessage({
    id: ETranslations.global_confirm,
  });

  const resetButton = resetLayout?.enabled ? (
    <Button
      flex={1}
      testID="trading-view-native-indicators-reset-layout-button"
      variant="secondary"
      size="medium"
      icon="RefreshCcwOutline"
      onPress={() => {
        onResetLayout();
        void dialog.close();
      }}
    >
      {resetLayout.label}
    </Button>
  ) : null;

  const confirmButton = (
    <Button
      flex={1}
      testID="trading-view-native-indicators-confirm-button"
      variant="primary"
      size="medium"
      onPress={handleConfirmPress}
    >
      {confirmText}
    </Button>
  );

  return (
    <Stack gap="$3">
      <ScrollView maxHeight={240} showsVerticalScrollIndicator>
        <XStack flexWrap="wrap" gap="$2" pb="$2">
          {indicators.map((indicator) => {
            const isActive = activeIndicatorValues.has(indicator.value);
            return (
              <XStack
                key={indicator.value}
                testID={buildIndicatorItemTestID(indicator.value)}
                h={30}
                minWidth={72}
                px="$3"
                borderRadius="$full"
                borderCurve="continuous"
                borderWidth={1}
                borderColor={isActive ? '$borderStrong' : 'transparent'}
                alignItems="center"
                justifyContent="center"
                bg={isActive ? '$bgStrong' : '$transparent'}
                hoverStyle={{
                  bg: isActive ? '$bgStrongHover' : '$bgHover',
                }}
                pressStyle={{
                  bg: isActive ? '$bgStrongActive' : '$bgActive',
                }}
                cursor="pointer"
                userSelect="none"
                onPress={() => handleIndicatorPress(indicator)}
              >
                <SizableText
                  size="$bodyMdMedium"
                  numberOfLines={1}
                  color={isActive ? '$text' : '$textSubdued'}
                >
                  {indicator.label}
                </SizableText>
              </XStack>
            );
          })}
        </XStack>
      </ScrollView>
      <XStack gap="$2">
        {resetButton}
        {confirmButton}
      </XStack>
    </Stack>
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
            borderColor={isActive ? '$borderStrong' : 'transparent'}
            alignItems="center"
            justifyContent="center"
            bg={isActive ? '$bgStrong' : '$transparent'}
            hoverStyle={{ bg: isActive ? '$bgStrongHover' : '$bgHover' }}
            pressStyle={{ bg: isActive ? '$bgStrongActive' : '$bgActive' }}
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
    const indicators =
      nativeChartControlsConfig?.indicators ?? EMPTY_INDICATORS;
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

    const showIndicatorsDialog = useCallback(() => {
      Dialog.show({
        title: 'Indicators',
        showFooter: false,
        testID: 'trading-view-native-indicators-dialog',
        renderContent: (
          <IndicatorListDialogContent
            indicators={indicators}
            resetLayout={resetLayout}
            onSelect={onIndicatorSelect}
            onResetLayout={onResetLayout}
          />
        ),
      });
    }, [indicators, onIndicatorSelect, onResetLayout, resetLayout]);

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
