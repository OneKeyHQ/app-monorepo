import { memo, useCallback, useRef } from 'react';

import { ScrollView, SizableText, Stack, XStack } from '@onekeyhq/components';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { useNativeIndicatorControls } from './hooks/useNativeIndicatorActiveValues';

import type { ITradingViewNativeIndicatorState } from './hooks/useNativeIndicatorActiveValues';
import type {
  ITradingViewIndicatorOption,
  ITradingViewNativeChartControlsConfigData,
} from '../../types';
import type { GestureResponderEvent } from 'react-native';

export const TRADING_VIEW_NATIVE_INDICATOR_QUICK_BAR_HEIGHT = 31;
const TRADING_VIEW_NATIVE_MAIN_INDICATOR_QUICK_BAR_WIDTH = 184;
const INDICATOR_QUICK_BAR_VERTICAL_PAN_THRESHOLD = 4;

type IIndicatorQuickBarTouchState = {
  direction: 'pending' | 'horizontal' | 'vertical';
  previousY: number;
  startX: number;
  startY: number;
};

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

function IndicatorQuickBarItems({
  indicators,
  activeIndicatorValues,
  canToggleIndicatorOn,
  handleIndicatorPress,
  onControlInteraction,
}: {
  indicators: ITradingViewIndicatorOption[];
  activeIndicatorValues: ReadonlySet<string>;
  canToggleIndicatorOn: (indicatorValue: string) => boolean;
  handleIndicatorPress: (indicator: ITradingViewIndicatorOption) => void;
  onControlInteraction?: () => void;
}) {
  return (
    <XStack
      h={TRADING_VIEW_NATIVE_INDICATOR_QUICK_BAR_HEIGHT}
      px="$5"
      gap="$4"
      alignItems="center"
      flexShrink={0}
    >
      {indicators.map((indicator) => (
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
}

export const TradingViewNativeIndicatorQuickBar = memo(
  ({
    nativeChartControlsConfig,
    nativeIndicatorState,
    maxSelectableSubIndicatorCount,
    splitSections = false,
    onIndicatorSelect,
    onControlInteraction,
    onTouchScroll,
  }: {
    nativeChartControlsConfig: ITradingViewNativeChartControlsConfigData | null;
    nativeIndicatorState: ITradingViewNativeIndicatorState;
    maxSelectableSubIndicatorCount?: number;
    splitSections?: boolean;
    onIndicatorSelect: (indicatorName: string, desiredActive: boolean) => void;
    onControlInteraction?: () => void;
    onTouchScroll?: (deltaY: number) => void;
  }) => {
    const touchStateRef = useRef<IIndicatorQuickBarTouchState | null>(null);
    const handleTouchStart = useCallback((event: GestureResponderEvent) => {
      const { pageX, pageY } = event.nativeEvent;
      touchStateRef.current = {
        direction: 'pending',
        previousY: pageY,
        startX: pageX,
        startY: pageY,
      };
    }, []);
    const handleTouchMove = useCallback(
      (event: GestureResponderEvent) => {
        const touchState = touchStateRef.current;
        if (!touchState || !onTouchScroll) {
          return;
        }

        const { pageX, pageY } = event.nativeEvent;
        if (touchState.direction === 'pending') {
          const absDx = Math.abs(pageX - touchState.startX);
          const absDy = Math.abs(pageY - touchState.startY);
          if (
            Math.max(absDx, absDy) <= INDICATOR_QUICK_BAR_VERTICAL_PAN_THRESHOLD
          ) {
            return;
          }
          touchState.direction = absDy > absDx ? 'vertical' : 'horizontal';
        }

        if (touchState.direction === 'vertical') {
          onTouchScroll(touchState.previousY - pageY);
          touchState.previousY = pageY;
        }
      },
      [onTouchScroll],
    );
    const handleTouchEnd = useCallback(() => {
      touchStateRef.current = null;
    }, []);

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
      maxSelectableSubIndicatorCount,
      onIndicatorSelect,
    });

    if (!hasVisibleIndicators) {
      return null;
    }

    const shouldSplitSections =
      splitSections && mainIndicators.length > 0 && subIndicators.length > 0;

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
        onTouchStart={onTouchScroll ? handleTouchStart : undefined}
        onTouchMove={onTouchScroll ? handleTouchMove : undefined}
        onTouchEnd={onTouchScroll ? handleTouchEnd : undefined}
        onTouchCancel={onTouchScroll ? handleTouchEnd : undefined}
      >
        {shouldSplitSections ? (
          <XStack
            h={TRADING_VIEW_NATIVE_INDICATOR_QUICK_BAR_HEIGHT}
            width="100%"
            alignItems="center"
          >
            <Stack
              testID="trading-view-native-indicator-quick-bar-main"
              width={TRADING_VIEW_NATIVE_MAIN_INDICATOR_QUICK_BAR_WIDTH}
              h={TRADING_VIEW_NATIVE_INDICATOR_QUICK_BAR_HEIGHT}
              flexShrink={0}
              overflow="hidden"
            >
              <IndicatorQuickBarItems
                indicators={mainIndicators}
                activeIndicatorValues={activeIndicatorValues}
                canToggleIndicatorOn={canToggleIndicatorOn}
                handleIndicatorPress={handleIndicatorPress}
                onControlInteraction={onControlInteraction}
              />
            </Stack>
            <Stack
              testID="trading-view-native-indicator-quick-bar-divider"
              h="$4"
              w="$px"
              flexShrink={0}
              bg="$borderSubdued"
              pointerEvents="none"
            />
            <ScrollView
              testID="trading-view-native-indicator-quick-bar-sub"
              horizontal
              flex={1}
              flexBasis={0}
              minWidth={0}
              showsHorizontalScrollIndicator={false}
              directionalLockEnabled={platformEnv.isNativeIOS}
            >
              <IndicatorQuickBarItems
                indicators={subIndicators}
                activeIndicatorValues={activeIndicatorValues}
                canToggleIndicatorOn={canToggleIndicatorOn}
                handleIndicatorPress={handleIndicatorPress}
                onControlInteraction={onControlInteraction}
              />
            </ScrollView>
          </XStack>
        ) : (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            directionalLockEnabled={platformEnv.isNativeIOS}
          >
            {quickBarContent}
          </ScrollView>
        )}
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
