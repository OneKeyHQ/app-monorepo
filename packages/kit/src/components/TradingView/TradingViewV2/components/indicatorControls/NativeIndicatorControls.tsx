import { memo, useCallback, useMemo, useRef, useState } from 'react';

import { useIntl } from 'react-intl';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { runOnJS } from 'react-native-reanimated';

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
import platformEnv from '@onekeyhq/shared/src/platformEnv';

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
import type {
  LayoutChangeEvent,
  NativeScrollEvent,
  NativeSyntheticEvent,
} from 'react-native';

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
const QUICK_BAR_TAP_MOVE_THRESHOLD = 8;

type IQuickBarItemLayout = {
  x: number;
  width: number;
};

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
  onLayout,
}: {
  indicator: ITradingViewIndicatorOption;
  isActive: boolean;
  onPress: () => void;
  onLayout?: (event: LayoutChangeEvent) => void;
}) {
  const content = (
    <SizableText
      size={isActive ? '$bodySmMedium' : '$bodySm'}
      numberOfLines={1}
      adjustsFontSizeToFit
      minimumFontScale={0.82}
      color={isActive ? '$text' : '$textSubdued'}
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
      cursor="pointer"
      userSelect="none"
      accessibilityRole="button"
      accessibilityState={{ selected: isActive }}
      onLayout={onLayout}
      onPress={onPress}
    >
      {content}
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
    const quickBarScrollXRef = useRef(0);
    const quickBarPressHandledRef = useRef(false);
    const quickBarItemLayoutsRef = useRef(
      new Map<string, IQuickBarItemLayout>(),
    );

    const handleQuickBarScroll = useCallback(
      (event: NativeSyntheticEvent<NativeScrollEvent>) => {
        quickBarScrollXRef.current = event.nativeEvent.contentOffset.x;
      },
      [],
    );

    const handleQuickBarItemLayout = useCallback(
      (indicatorValue: string, event: LayoutChangeEvent) => {
        const { x, width } = event.nativeEvent.layout;
        quickBarItemLayoutsRef.current.set(indicatorValue, { x, width });
      },
      [],
    );

    const handleQuickBarTouchStart = useCallback(() => {
      quickBarPressHandledRef.current = false;
    }, []);

    const handleQuickBarIndicatorPress = useCallback(
      (indicator: ITradingViewIndicatorOption) => {
        if (platformEnv.isNativeAndroid) {
          if (quickBarPressHandledRef.current) {
            return;
          }
          quickBarPressHandledRef.current = true;
        }

        handleIndicatorPress(indicator);
      },
      [handleIndicatorPress],
    );

    const handleQuickBarTap = useCallback(
      (locationX: number) => {
        const touchContentX = locationX + quickBarScrollXRef.current;
        const indicator = [...mainIndicators, ...subIndicators].find((item) => {
          const layout = quickBarItemLayoutsRef.current.get(item.value);
          return (
            layout &&
            touchContentX >= layout.x &&
            touchContentX <= layout.x + layout.width
          );
        });

        if (indicator) {
          handleQuickBarIndicatorPress(indicator);
        }
      },
      [handleQuickBarIndicatorPress, mainIndicators, subIndicators],
    );

    const quickBarGesture = useMemo(
      () =>
        Gesture.Simultaneous(
          Gesture.Native().shouldActivateOnStart(true),
          Gesture.Tap()
            .maxDistance(QUICK_BAR_TAP_MOVE_THRESHOLD)
            .onEnd((event, success) => {
              'worklet';

              if (success) {
                runOnJS(handleQuickBarTap)(event.x);
              }
            }),
        ),
      [handleQuickBarTap],
    );

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
            onPress={() => handleQuickBarIndicatorPress(indicator)}
            onLayout={(event) =>
              handleQuickBarItemLayout(indicator.value, event)
            }
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
            onPress={() => handleQuickBarIndicatorPress(indicator)}
            onLayout={(event) =>
              handleQuickBarItemLayout(indicator.value, event)
            }
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
        {platformEnv.isNativeAndroid ? (
          <GestureDetector gesture={quickBarGesture}>
            <ScrollView
              horizontal
              nestedScrollEnabled
              scrollEventThrottle={16}
              onScroll={handleQuickBarScroll}
              onTouchStart={handleQuickBarTouchStart}
              showsHorizontalScrollIndicator={false}
            >
              {quickBarContent}
            </ScrollView>
          </GestureDetector>
        ) : (
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {quickBarContent}
          </ScrollView>
        )}
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
