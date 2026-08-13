import { useCallback, useMemo, useState } from 'react';

import { useIntl } from 'react-intl';

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

const MOBILE_CHART_HEIGHT = 500;

export function PerpMobileChartPanel({
  bottomOffset = 0,
  onExpandedChange,
}: {
  bottomOffset?: number;
  onExpandedChange?: (isExpanded: boolean) => void;
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

  const handleToggle = useCallback(() => {
    const next = !isExpanded;
    setIsExpanded(next);
    onExpandedChange?.(next);
  }, [isExpanded, onExpandedChange]);

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
      {isExpanded ? (
        <HeaderScrollGestureWrapper
          panActiveOffsetY={[-4, 4]}
          panFailOffsetX={[-40, 40]}
          excludeRightEdgeRatio={0.1}
          scrollScale={1.2}
          verticalPanMaxPointers={1}
          simultaneousWithNativeGesture
          cancelChildTouches={false}
        >
          <YStack
            testID={PerpTestIDs.MobileChartContent}
            h={MOBILE_CHART_HEIGHT}
            overflow="hidden"
          >
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
      ) : null}
      <XStack
        testID={PerpTestIDs.MobileChartToggle}
        minHeight="$12"
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
