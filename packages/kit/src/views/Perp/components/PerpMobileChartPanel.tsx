import { useCallback, useEffect, useMemo, useState } from 'react';

import { useIntl } from 'react-intl';
import { useWindowDimensions } from 'react-native';

import {
  HeaderScrollGestureWrapper,
  Icon,
  SizableText,
  XStack,
  YStack,
} from '@onekeyhq/components';
import { TradingViewNative } from '@onekeyhq/kit/src/components/TradingView/TradingViewNative';
import { FLOAT_NAV_BAR_Z_INDEX } from '@onekeyhq/shared/src/consts/zIndexConsts';
import { ETranslations } from '@onekeyhq/shared/src/locale';

import { useActiveTradeDisplay } from '../hooks/useActiveTradeDisplay';
import { PerpTestIDs } from '../testIDs';

const MOBILE_CHART_MAX_HEIGHT = 500;
const MOBILE_CHART_MIN_HEIGHT = 240;
// Headroom above the expanded chart so short viewports keep the ticker visible.
const MOBILE_CHART_VIEWPORT_RESERVED_HEIGHT = 220;

// Scrolling content underneath must reserve the collapsed bar height.
export const PERP_MOBILE_CHART_BAR_SCROLL_INSET = 48;

export function PerpMobileChartPanel({
  bottomOffset = 0,
}: {
  bottomOffset?: number;
}) {
  const intl = useIntl();
  const { height: windowHeight } = useWindowDimensions();
  const { coin, displayName, mode } = useActiveTradeDisplay();
  const [isExpanded, setIsExpanded] = useState(false);
  const [mountedCoin, setMountedCoin] = useState<string | undefined>();
  const marketName = useMemo(() => {
    if (!displayName) {
      return '--';
    }
    return mode === 'spot' ? displayName : `${displayName}USDC`;
  }, [displayName, mode]);
  const marketTypeLabel =
    mode === 'perp'
      ? ` ${intl.formatMessage({ id: ETranslations.perp_label_perp })}`
      : '';
  const chartSource = useMemo(
    () =>
      coin
        ? ({
            kind: 'hyperliquid',
            coin,
            environment: 'mainnet',
          } as const)
        : undefined,
    [coin],
  );
  const chartHeight = Math.max(
    MOBILE_CHART_MIN_HEIGHT,
    Math.min(
      MOBILE_CHART_MAX_HEIGHT,
      windowHeight - bottomOffset - MOBILE_CHART_VIEWPORT_RESERVED_HEIGHT,
    ),
  );

  const handleToggle = useCallback(() => {
    const next = !isExpanded;
    setIsExpanded(next);
    if (next) {
      setMountedCoin(coin);
    }
  }, [coin, isExpanded]);

  // Track coin switches while expanded so collapsing keeps the visible chart.
  useEffect(() => {
    if (isExpanded && coin) {
      setMountedCoin(coin);
    }
  }, [coin, isExpanded]);

  // Keep the collapsed chart mounted only for the coin it was built for; a
  // coin switch while hidden would otherwise rebuild it fully off-screen.
  const shouldKeepMounted =
    mountedCoin !== undefined && (isExpanded || mountedCoin === coin);

  return (
    <YStack
      testID={PerpTestIDs.MobileChartOverlay}
      position="absolute"
      right={0}
      bottom={bottomOffset}
      left={0}
      zIndex={FLOAT_NAV_BAR_Z_INDEX}
      bg="$bgApp"
      borderTopWidth="$px"
      borderTopColor="$borderSubdued"
    >
      {shouldKeepMounted ? (
        // Collapsing only hides the mounted chart so reopening keeps its data,
        // subscriptions, and view state instead of a full rebuild.
        <YStack
          testID={PerpTestIDs.MobileChartContent}
          h={isExpanded ? chartHeight : 0}
          overflow="hidden"
        >
          <HeaderScrollGestureWrapper
            panActiveOffsetY={[-4, 4]}
            panFailOffsetX={[-40, 40]}
            excludeRightEdgeRatio={0.1}
            scrollScale={1.2}
            verticalPanMaxPointers={1}
            simultaneousWithNativeGesture
            cancelChildTouches={false}
          >
            <YStack h={chartHeight} overflow="hidden">
              {chartSource ? (
                <TradingViewNative
                  key={coin}
                  testID={PerpTestIDs.MobileChart}
                  source={chartSource}
                  nativeControlsLayoutMode="mobile"
                />
              ) : null}
            </YStack>
          </HeaderScrollGestureWrapper>
        </YStack>
      ) : null}
      <XStack
        testID={PerpTestIDs.MobileChartToggle}
        minHeight={PERP_MOBILE_CHART_BAR_SCROLL_INSET}
        px="$4"
        py="$3"
        alignItems="center"
        justifyContent="space-between"
        bg="$bgApp"
        borderTopWidth={isExpanded ? '$px' : 0}
        borderTopColor="$borderSubdued"
        accessibilityRole="button"
        accessibilityState={{ expanded: isExpanded }}
        onPress={handleToggle}
      >
        <SizableText size="$bodyMdMedium">
          {marketName}
          {marketTypeLabel}{' '}
          {intl.formatMessage({ id: ETranslations.market_chart })}
        </SizableText>
        <XStack alignItems="center" gap="$3">
          <Icon
            name="TradingViewCandlesOutline"
            size="$5"
            color="$iconSubdued"
          />
          <Icon
            name={
              isExpanded ? 'ChevronDownSmallOutline' : 'ChevronTopSmallOutline'
            }
            size="$4"
            color="$iconSubdued"
          />
        </XStack>
      </XStack>
    </YStack>
  );
}
