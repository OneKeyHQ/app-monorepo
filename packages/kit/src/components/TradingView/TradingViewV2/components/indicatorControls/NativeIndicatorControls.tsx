import { memo, useCallback, useMemo, useRef, useState } from 'react';

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
  getIndicatorSections,
  useNativeIndicatorControls,
} from './hooks/useNativeIndicatorActiveValues';

import type { ITradingViewNativeIndicatorState } from './hooks/useNativeIndicatorActiveValues';
import type {
  ITradingViewIndicatorOption,
  ITradingViewNativeChartControlsConfigData,
} from '../../types';

const INDICATOR_GRID_COLUMN_COUNT = 4;
const INDICATOR_GRID_ITEM_LAYOUT_PROPS = {
  flex: 1,
  flexBasis: 0,
  h: 32,
  minWidth: 0,
  px: '$2',
  borderWidth: 1,
} as const;
export const TRADING_VIEW_NATIVE_INDICATOR_QUICK_BAR_HEIGHT = 31;

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
  }: {
    nativeChartControlsConfig: ITradingViewNativeChartControlsConfigData | null;
    nativeIndicatorState: ITradingViewNativeIndicatorState;
    onIndicatorSelect: (indicatorName: string, desiredActive: boolean) => void;
  }) => {
    const {
      activeIndicatorValues,
      mainIndicators,
      subIndicators,
      hasVisibleIndicators,
      handleIndicatorPress,
    } = useNativeIndicatorControls({
      nativeChartControlsConfig,
      nativeIndicatorState,
      onIndicatorSelect,
    });

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

export function IndicatorListDialogContent({
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

function IndicatorListPopoverContent({
  indicators,
  activeIndicatorValues,
  onIndicatorPress,
}: {
  indicators: ITradingViewIndicatorOption[];
  activeIndicatorValues: Set<string>;
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
        onIndicatorPress={onIndicatorPress}
      />
      <IndicatorSection
        title={intl.formatMessage({
          id: ETranslations.market_sub_chart_indicators,
        })}
        indicators={subIndicators}
        activeIndicatorValues={activeIndicatorValues}
        onIndicatorPress={onIndicatorPress}
      />
    </YStack>
  );
}

export function IndicatorPopover({
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
  return (
    <Popover
      title={title}
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
          onIndicatorPress={onIndicatorPress}
        />
      }
    />
  );
}
