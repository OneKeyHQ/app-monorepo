import { useCallback, useMemo, useRef, useState } from 'react';

import { useIntl } from 'react-intl';

import {
  Button,
  IconButton,
  Popover,
  ScrollView,
  SizableText,
  Stack,
  XStack,
  YStack,
  useDialogInstance,
} from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';

import { HEADER_ICON_BUTTON_STYLE_PROPS } from '../utils/NativeChartControlsShared';

import {
  canToggleTradingViewNativeIndicatorOn,
  getIndicatorSections,
  getNativeIndicatorSelectionUpdates,
} from './indicatorUtils';

import type {
  ITradingViewIndicatorOption,
  ITradingViewNativeChartControlsConfigData,
} from '../types';

const INDICATOR_GRID_COLUMN_COUNT = 4;
const INDICATOR_GRID_ITEM_LAYOUT_PROPS = {
  flex: 1,
  flexBasis: 0,
  h: 32,
  minWidth: 0,
  px: '$2',
  borderWidth: 1,
} as const;

function buildIndicatorItemTestID(value: string): string {
  return `trading-view-native-indicator-item-${value
    .replace(/[^a-zA-Z0-9_-]/g, '-')
    .slice(0, 80)}`;
}

function getIndicatorTextColor({
  isActive,
  isDisabled,
}: {
  isActive: boolean;
  isDisabled: boolean;
}) {
  if (isDisabled) {
    return '$textDisabled';
  }
  return isActive ? '$text' : '$textSubdued';
}

function IndicatorPill({
  indicator,
  isActive,
  isDisabled,
  onPress,
}: {
  indicator: ITradingViewIndicatorOption;
  isActive: boolean;
  isDisabled: boolean;
  onPress?: () => void;
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
      opacity={isDisabled ? 0.45 : 1}
      cursor={isDisabled ? 'not-allowed' : 'pointer'}
      userSelect="none"
      onPress={isDisabled ? undefined : onPress}
    >
      <SizableText
        size="$bodyMdMedium"
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.82}
        color={getIndicatorTextColor({ isActive, isDisabled })}
      >
        {indicator.label}
      </SizableText>
    </XStack>
  );
}

function IndicatorGrid({
  indicators,
  activeIndicatorValues,
  maxSubIndicatorCount,
  onIndicatorPress,
}: {
  indicators: ITradingViewIndicatorOption[];
  activeIndicatorValues: Set<string>;
  maxSubIndicatorCount?: number;
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
            {row.map((indicator) => {
              const isDisabled = !canToggleTradingViewNativeIndicatorOn({
                indicatorValue: indicator.value,
                activeIndicatorValues,
                maxSubIndicatorCount,
              });

              return (
                <IndicatorPill
                  key={indicator.value}
                  indicator={indicator}
                  isActive={activeIndicatorValues.has(indicator.value)}
                  isDisabled={isDisabled}
                  onPress={() => onIndicatorPress(indicator)}
                />
              );
            })}
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
  maxSubIndicatorCount,
  onIndicatorPress,
}: {
  title: string;
  indicators: ITradingViewIndicatorOption[];
  activeIndicatorValues: Set<string>;
  maxSubIndicatorCount?: number;
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
        maxSubIndicatorCount={maxSubIndicatorCount}
        onIndicatorPress={onIndicatorPress}
      />
    </YStack>
  );
}

export function IndicatorListDialogContent({
  indicators,
  resetLayout,
  maxSubIndicatorCount,
  onSelect,
  onResetLayout,
}: {
  indicators: ITradingViewIndicatorOption[];
  resetLayout?: ITradingViewNativeChartControlsConfigData['resetLayout'];
  maxSubIndicatorCount?: number;
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
      if (
        !canToggleTradingViewNativeIndicatorOn({
          indicatorValue: indicator.value,
          activeIndicatorValues: activeIndicatorValuesRef.current,
          maxSubIndicatorCount,
        })
      ) {
        return;
      }

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
    [maxSubIndicatorCount],
  );

  const handleConfirmPress = useCallback(() => {
    const originalValues = originalActiveIndicatorValuesRef.current;
    const nextValues = activeIndicatorValuesRef.current;
    getNativeIndicatorSelectionUpdates({
      indicators,
      originalActiveIndicatorValues: originalValues,
      nextActiveIndicatorValues: nextValues,
    }).forEach(([indicatorName, desiredActive]) => {
      onSelect(indicatorName, desiredActive);
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
            maxSubIndicatorCount={maxSubIndicatorCount}
            onIndicatorPress={handleIndicatorPress}
          />
          <IndicatorSection
            title={intl.formatMessage({
              id: ETranslations.market_sub_chart_indicators,
            })}
            indicators={subIndicators}
            activeIndicatorValues={activeIndicatorValues}
            maxSubIndicatorCount={maxSubIndicatorCount}
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

function IndicatorListPopoverContent({
  indicators,
  activeIndicatorValues,
  maxSubIndicatorCount,
  onIndicatorPress,
}: {
  indicators: ITradingViewIndicatorOption[];
  activeIndicatorValues: Set<string>;
  maxSubIndicatorCount?: number;
  onIndicatorPress: (indicator: ITradingViewIndicatorOption) => void;
}) {
  const intl = useIntl();
  const { mainIndicators, subIndicators } = useMemo(
    () => getIndicatorSections(indicators),
    [indicators],
  );

  return (
    <YStack p="$3" gap="$5">
      <IndicatorSection
        title={intl.formatMessage({
          id: ETranslations.market_main_chart_indicators,
        })}
        indicators={mainIndicators}
        activeIndicatorValues={activeIndicatorValues}
        maxSubIndicatorCount={maxSubIndicatorCount}
        onIndicatorPress={onIndicatorPress}
      />
      <IndicatorSection
        title={intl.formatMessage({
          id: ETranslations.market_sub_chart_indicators,
        })}
        indicators={subIndicators}
        activeIndicatorValues={activeIndicatorValues}
        maxSubIndicatorCount={maxSubIndicatorCount}
        onIndicatorPress={onIndicatorPress}
      />
    </YStack>
  );
}

export function IndicatorPopover({
  title,
  indicators,
  activeIndicatorValues,
  maxSubIndicatorCount,
  onIndicatorPress,
  onControlInteraction,
}: {
  title: string;
  indicators: ITradingViewIndicatorOption[];
  activeIndicatorValues: Set<string>;
  maxSubIndicatorCount?: number;
  onIndicatorPress: (indicator: ITradingViewIndicatorOption) => void;
  onControlInteraction?: () => void;
}) {
  return (
    <Popover
      title={title}
      onOpenChange={(open) => {
        if (open) {
          onControlInteraction?.();
        }
      }}
      showHeader={false}
      usingSheet={false}
      placement="bottom-end"
      floatingPanelProps={{
        width: 360,
      }}
      renderTrigger={
        <IconButton
          testID="trading-view-native-indicators-trigger"
          size="small"
          variant="tertiary"
          icon="FunctionCustom"
          iconSize="$5"
          title={title}
          {...HEADER_ICON_BUTTON_STYLE_PROPS}
        />
      }
      renderContent={
        <IndicatorListPopoverContent
          indicators={indicators}
          activeIndicatorValues={activeIndicatorValues}
          maxSubIndicatorCount={maxSubIndicatorCount}
          onIndicatorPress={onIndicatorPress}
        />
      }
    />
  );
}
