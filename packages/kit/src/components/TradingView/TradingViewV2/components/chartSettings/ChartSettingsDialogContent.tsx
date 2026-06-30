import { useMemo, useState } from 'react';
import type { ReactNode } from 'react';

import { useIntl } from 'react-intl';

import { SizableText, XStack, YStack } from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';

import {
  buildSettingsItemTestID,
  formatChartTypeOptionLabel,
  formatPriceMarketCapOptionLabel,
  formatPriceScaleOptionLabel,
} from '../utils/NativeChartControlsShared';

import type {
  ITradingViewChartTypeOption,
  ITradingViewNativeChartControlsConfigData,
  ITradingViewPriceMarketCapMode,
  ITradingViewPriceScaleMode,
} from '../../types';
import type { IChartSettingsSegmentValue } from '../utils/NativeChartControlsShared';

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

export function ChartSettingsDialogContent({
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
