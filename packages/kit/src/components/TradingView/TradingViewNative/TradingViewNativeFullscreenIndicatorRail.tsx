import { memo } from 'react';

import { useIntl } from 'react-intl';

import {
  IconButton,
  ScrollView,
  SizableText,
  Stack,
  YStack,
} from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';

import type { ITradingViewIndicatorOption } from '../TradingViewChartControls/types';

export const TRADING_VIEW_NATIVE_FULLSCREEN_INDICATOR_RAIL_WIDTH = 64;
const RAIL_ITEM_HEIGHT = 36;
const TEST_ID = 'trading-view-native-fullscreen-indicator-rail';

function buildRailItemTestID(value: string) {
  return `${TEST_ID}-item-${value.replace(/[^a-zA-Z0-9_-]/g, '-').slice(0, 80)}`;
}

function RailItem({
  indicator,
  isActive,
  isDisabled,
  onPress,
}: {
  indicator: ITradingViewIndicatorOption;
  isActive: boolean;
  isDisabled: boolean;
  onPress: () => void;
}) {
  let color = isActive ? '$text' : '$textSubdued';
  if (isDisabled) {
    color = '$textDisabled';
  }
  return (
    <Stack
      h={RAIL_ITEM_HEIGHT}
      px="$1"
      alignItems="center"
      justifyContent="center"
      opacity={isDisabled ? 0.45 : 1}
      accessibilityRole="button"
      accessibilityLabel={indicator.label}
      accessibilityState={{ selected: isActive, disabled: isDisabled }}
      onPress={isDisabled ? undefined : onPress}
      testID={buildRailItemTestID(indicator.value)}
    >
      <SizableText
        size={isActive ? '$bodyMdMedium' : '$bodyMd'}
        color={color}
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.6}
      >
        {indicator.label}
      </SizableText>
    </Stack>
  );
}

// Fullscreen charts put the indicator switches in a column beside the price
// axis, like landscape exchange charts; the bottom button opens the panel.
export const TradingViewNativeFullscreenIndicatorRail = memo(
  ({
    mainIndicators,
    subIndicators,
    activeIndicatorValues,
    canToggleIndicatorOn,
    onIndicatorPress,
    onOpenPanel,
  }: {
    mainIndicators: ITradingViewIndicatorOption[];
    subIndicators: ITradingViewIndicatorOption[];
    activeIndicatorValues: ReadonlySet<string>;
    canToggleIndicatorOn: (indicatorValue: string) => boolean;
    onIndicatorPress: (indicator: ITradingViewIndicatorOption) => void;
    onOpenPanel: () => void;
  }) => {
    const intl = useIntl();
    const renderItem = (indicator: ITradingViewIndicatorOption) => (
      <RailItem
        key={indicator.value}
        indicator={indicator}
        isActive={activeIndicatorValues.has(indicator.value)}
        isDisabled={!canToggleIndicatorOn(indicator.value)}
        onPress={() => onIndicatorPress(indicator)}
      />
    );
    return (
      <YStack
        w={TRADING_VIEW_NATIVE_FULLSCREEN_INDICATOR_RAIL_WIDTH}
        flexShrink={0}
        bg="$bgApp"
        borderLeftWidth={1}
        borderLeftColor="$borderSubdued"
        testID={TEST_ID}
      >
        <ScrollView
          flex={1}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ py: '$1' }}
        >
          {mainIndicators.map(renderItem)}
          {mainIndicators.length && subIndicators.length ? (
            <Stack h="$px" mx="$3" my="$1" bg="$borderSubdued" />
          ) : null}
          {subIndicators.map(renderItem)}
        </ScrollView>
        <YStack
          alignItems="center"
          py="$1"
          borderTopWidth={1}
          borderTopColor="$borderSubdued"
        >
          <IconButton
            icon="ChartTrending2Outline"
            variant="tertiary"
            iconSize="$5"
            accessibilityLabel={intl.formatMessage({
              id: ETranslations.market_indicators,
            })}
            onPress={onOpenPanel}
            testID={`${TEST_ID}-panel-trigger`}
          />
        </YStack>
      </YStack>
    );
  },
);

TradingViewNativeFullscreenIndicatorRail.displayName =
  'TradingViewNativeFullscreenIndicatorRail';
