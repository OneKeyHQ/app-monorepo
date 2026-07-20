import { memo } from 'react';

import { ScrollView, SizableText, Stack, XStack } from '@onekeyhq/components';

import { useNativeIndicatorControls } from './hooks/useNativeIndicatorActiveValues';

import type { ITradingViewNativeIndicatorState } from './hooks/useNativeIndicatorActiveValues';
import type {
  ITradingViewIndicatorOption,
  ITradingViewNativeChartControlsConfigData,
} from '../../types';

export const TRADING_VIEW_NATIVE_INDICATOR_QUICK_BAR_HEIGHT = 31;

function buildIndicatorQuickBarItemTestID(value: string): string {
  return `trading-view-native-indicator-quick-bar-item-${value
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

function IndicatorQuickBarItem({
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
  const content = (
    <SizableText
      size={isActive ? '$bodySmMedium' : '$bodySm'}
      numberOfLines={1}
      adjustsFontSizeToFit
      minimumFontScale={0.82}
      color={getIndicatorTextColor({ isActive, isDisabled })}
    >
      {indicator.label}
    </SizableText>
  );

  return (
    <XStack
      testID={buildIndicatorQuickBarItemTestID(indicator.value)}
      h={TRADING_VIEW_NATIVE_INDICATOR_QUICK_BAR_HEIGHT}
      alignItems="center"
      justifyContent="center"
      opacity={isDisabled ? 0.45 : 1}
      cursor={isDisabled ? 'not-allowed' : 'pointer'}
      userSelect="none"
      accessibilityRole="button"
      accessibilityState={{ selected: isActive, disabled: isDisabled }}
      onPress={isDisabled ? undefined : onPress}
    >
      {content}
    </XStack>
  );
}

export const TradingViewNativeIndicatorQuickBar = memo(
  ({
    nativeChartControlsConfig,
    nativeIndicatorState,
    maxSubIndicatorCount,
    onIndicatorSelect,
    onControlInteraction,
  }: {
    nativeChartControlsConfig: ITradingViewNativeChartControlsConfigData | null;
    nativeIndicatorState: ITradingViewNativeIndicatorState;
    maxSubIndicatorCount?: number;
    onIndicatorSelect: (indicatorName: string, desiredActive: boolean) => void;
    onControlInteraction?: () => void;
  }) => {
    const {
      activeIndicatorValues,
      mainIndicators,
      subIndicators,
      hasVisibleIndicators,
      canToggleIndicatorOn,
      handleIndicatorPress,
    } = useNativeIndicatorControls({
      nativeChartControlsConfig,
      nativeIndicatorState,
      maxSubIndicatorCount,
      onIndicatorSelect,
    });

    if (!hasVisibleIndicators) {
      return null;
    }

    const quickBarContent = (
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
            isDisabled={!canToggleIndicatorOn(indicator.value)}
            onPress={() => {
              onControlInteraction?.();
              handleIndicatorPress(indicator);
            }}
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
            isDisabled={!canToggleIndicatorOn(indicator.value)}
            onPress={() => {
              onControlInteraction?.();
              handleIndicatorPress(indicator);
            }}
          />
        ))}
      </XStack>
    );

    return (
      <Stack
        testID="trading-view-native-indicator-quick-bar"
        h={TRADING_VIEW_NATIVE_INDICATOR_QUICK_BAR_HEIGHT}
        bg="$bgApp"
        zIndex={3}
      >
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          {quickBarContent}
        </ScrollView>
      </Stack>
    );
  },
);

TradingViewNativeIndicatorQuickBar.displayName =
  'TradingViewNativeIndicatorQuickBar';

export {
  IndicatorListDialogContent,
  IndicatorPopover,
} from '../../../TradingViewChartControls/indicatorSelector/NativeIndicatorSelector';
