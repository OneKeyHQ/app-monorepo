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
import { deferHeavyWorkUntilUIIdle } from '@onekeyhq/kit/src/utils/deferHeavyWork';
import { FLOAT_NAV_BAR_Z_INDEX } from '@onekeyhq/shared/src/consts/zIndexConsts';
import { ETranslations } from '@onekeyhq/shared/src/locale';

import { useActiveTradeDisplay } from '../hooks/useActiveTradeDisplay';
import { PerpTestIDs } from '../testIDs';

const MOBILE_CHART_MAX_HEIGHT = 250;
const MOBILE_CHART_MIN_HEIGHT = 200;
// Headroom above the expanded chart so short viewports keep the ticker visible.
const MOBILE_CHART_VIEWPORT_RESERVED_HEIGHT = 220;
const MOBILE_CHART_CONTENT_OFFSET = -4;
const MOBILE_CHART_FOOTER_SPACING = 8;

// Scrolling content underneath must reserve the collapsed bar height.
export const PERP_MOBILE_CHART_BAR_SCROLL_INSET = 48;

function PerpMobileChartContent({
  chartHeight,
  coin,
  contentOffsetTop = 0,
  contentTestID,
  isExpanded,
  onClose,
  preloadWhenCollapsed = false,
  showCloseControl = true,
}: {
  chartHeight: number;
  coin: string | undefined;
  contentOffsetTop?: number;
  contentTestID: string;
  isExpanded: boolean;
  onClose: () => void;
  preloadWhenCollapsed?: boolean;
  showCloseControl?: boolean;
}) {
  const [mountedCoin, setMountedCoin] = useState<string | undefined>();

  useEffect(() => {
    if (isExpanded && coin) {
      setMountedCoin(coin);
    }
  }, [coin, isExpanded]);

  // Bottom charts should forget hidden stale content. Top charts retain it
  // until their deferred prewarm atomically replaces it with the active coin.
  useEffect(() => {
    if (
      !preloadWhenCollapsed &&
      !isExpanded &&
      mountedCoin !== undefined &&
      mountedCoin !== coin
    ) {
      setMountedCoin(undefined);
    }
  }, [coin, isExpanded, mountedCoin, preloadWhenCollapsed]);

  useEffect(() => {
    if (!preloadWhenCollapsed || isExpanded || !coin || mountedCoin === coin) {
      return;
    }

    let isCancelled = false;
    // Warm the selected top chart after the initial screen interaction so the
    // first explicit reveal does not also pay the data and Skia mount costs.
    void deferHeavyWorkUntilUIIdle().then(() => {
      if (!isCancelled) {
        setMountedCoin(coin);
      }
    });
    return () => {
      isCancelled = true;
    };
  }, [coin, isExpanded, mountedCoin, preloadWhenCollapsed]);

  const chartCoin = isExpanded ? coin : mountedCoin;
  const chartSource = useMemo(
    () =>
      chartCoin
        ? ({
            kind: 'hyperliquid',
            coin: chartCoin,
            environment: 'mainnet',
          } as const)
        : undefined,
    [chartCoin],
  );
  // Drop a stale hidden chart until the selected coin's deferred prewarm runs.
  const shouldKeepMounted =
    chartSource !== undefined && (isExpanded || mountedCoin === coin);

  if (!shouldKeepMounted) {
    return null;
  }

  return (
    <YStack
      testID={contentTestID}
      h={isExpanded ? chartHeight : 0}
      overflow="hidden"
    >
      <YStack h={chartHeight} mt={contentOffsetTop}>
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
            <TradingViewNative
              key={chartCoin}
              testID={PerpTestIDs.MobileChart}
              source={chartSource}
              nativeChartDisplayMode="compact"
              nativeControlsLayoutMode="mobile"
              onNativeChartClose={onClose}
              showNativeChartCloseControl={showCloseControl}
            />
          </YStack>
        </HeaderScrollGestureWrapper>
      </YStack>
    </YStack>
  );
}

function useMobileChartHeight(bottomOffset = 0) {
  const { height: windowHeight } = useWindowDimensions();
  return Math.max(
    MOBILE_CHART_MIN_HEIGHT,
    Math.min(
      MOBILE_CHART_MAX_HEIGHT,
      windowHeight - bottomOffset - MOBILE_CHART_VIEWPORT_RESERVED_HEIGHT,
    ),
  );
}

export function PerpMobileTopChartPanel({
  isExpanded,
  onClose,
}: {
  isExpanded: boolean;
  onClose: () => void;
}) {
  const { coin } = useActiveTradeDisplay();
  const chartHeight = useMobileChartHeight();

  return (
    <YStack
      bg="$bgApp"
      mb={isExpanded ? '$3' : 0}
      borderTopWidth={isExpanded ? 0.5 : 0}
      borderTopColor="$borderSubdued"
      borderBottomWidth={isExpanded ? 0.5 : 0}
      borderBottomColor="$borderSubdued"
    >
      <PerpMobileChartContent
        chartHeight={chartHeight}
        coin={coin}
        contentOffsetTop={MOBILE_CHART_CONTENT_OFFSET}
        contentTestID={PerpTestIDs.MobileTopChartContent}
        isExpanded={isExpanded}
        onClose={onClose}
        preloadWhenCollapsed
        showCloseControl={false}
      />
    </YStack>
  );
}

export function PerpMobileChartPanel({
  bottomOffset = 0,
  onScrollInsetChange,
}: {
  bottomOffset?: number;
  onScrollInsetChange?: (inset: number) => void;
}) {
  const intl = useIntl();
  const { coin, displayName, mode } = useActiveTradeDisplay();
  const [isExpanded, setIsExpanded] = useState(false);
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
  const footerSpacing = isExpanded ? MOBILE_CHART_FOOTER_SPACING : 0;
  const chartHeight = useMobileChartHeight(bottomOffset + footerSpacing);
  const scrollInset = isExpanded
    ? chartHeight + footerSpacing
    : PERP_MOBILE_CHART_BAR_SCROLL_INSET;

  useEffect(() => {
    onScrollInsetChange?.(scrollInset);
  }, [onScrollInsetChange, scrollInset]);

  const handleToggle = useCallback(() => {
    setIsExpanded((currentValue) => !currentValue);
  }, []);
  const handleClose = useCallback(() => {
    setIsExpanded(false);
  }, []);

  return (
    <YStack
      testID={PerpTestIDs.MobileChartOverlay}
      position="absolute"
      right={0}
      bottom={bottomOffset}
      left={0}
      zIndex={FLOAT_NAV_BAR_Z_INDEX}
      bg="$bgApp"
      pb={footerSpacing}
      overflow="hidden"
      borderTopLeftRadius="$2"
      borderTopRightRadius="$2"
    >
      <YStack
        testID={PerpTestIDs.MobileChartCornerBorder}
        position="absolute"
        top={0}
        right={0}
        left={0}
        zIndex={1}
        h={12}
        pointerEvents="none"
        borderWidth={0.5}
        borderBottomWidth={0}
        borderColor="$borderSubdued"
        borderTopLeftRadius="$2"
        borderTopRightRadius="$2"
      />
      <PerpMobileChartContent
        chartHeight={chartHeight}
        coin={coin}
        contentOffsetTop={MOBILE_CHART_CONTENT_OFFSET}
        contentTestID={PerpTestIDs.MobileChartContent}
        isExpanded={isExpanded}
        onClose={handleClose}
      />
      {!isExpanded ? (
        <XStack
          testID={PerpTestIDs.MobileChartToggle}
          minHeight={PERP_MOBILE_CHART_BAR_SCROLL_INSET}
          px="$4"
          py="$2"
          alignItems="center"
          justifyContent="space-between"
          bg="$bgApp"
          borderTopWidth={isExpanded ? '$px' : 0}
          borderTopColor="$borderSubdued"
          accessibilityRole="button"
          accessibilityState={{ expanded: isExpanded }}
          onPress={handleToggle}
        >
          <SizableText size="$bodySmMedium">
            {marketName}
            {marketTypeLabel}{' '}
            {intl.formatMessage({ id: ETranslations.market_chart })}
          </SizableText>
          <XStack alignItems="center" gap="$3">
            <Icon
              name={
                isExpanded
                  ? 'ChevronDownSmallOutline'
                  : 'ChevronTopSmallOutline'
              }
              size="$5"
              color="$iconSubdued"
            />
          </XStack>
        </XStack>
      ) : null}
    </YStack>
  );
}
