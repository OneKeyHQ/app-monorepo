import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';

import BigNumber from 'bignumber.js';
import { useIntl } from 'react-intl';
import {
  type LayoutChangeEvent,
  RefreshControl,
  ScrollView,
} from 'react-native';

import type { IModalNavigationProp } from '@onekeyhq/components';
import {
  DebugRenderTracker,
  IconButton,
  SizableText,
  XStack,
  YStack,
  useScrollContentTabBarOffset,
} from '@onekeyhq/components';
import {
  usePerpsAbstractionModeAtom,
  usePerpsActiveAccountAtom,
  usePerpsActiveAccountSummaryAtom,
  usePerpsSpotBalancesAtom,
  useSpotActiveOpenOrdersAtom,
  useSpotBalancesAtom,
} from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { EModalRoutes } from '@onekeyhq/shared/src/routes';
import type { IModalPerpParamList } from '@onekeyhq/shared/src/routes/perp';
import { EModalPerpRoutes } from '@onekeyhq/shared/src/routes/perp';

import useAppNavigation from '../../../hooks/useAppNavigation';
import { useHyperliquidActions } from '../../../states/jotai/contexts/hyperliquid';
import {
  usePerpsActiveOpenOrdersLengthAtom,
  usePerpsActivePositionLengthAtom,
} from '../../../states/jotai/contexts/hyperliquid/atoms';
import { PerpOpenOrdersList } from '../components/OrderInfoPanel/List/PerpOpenOrdersList';
import { PerpPositionsList } from '../components/OrderInfoPanel/List/PerpPositionsList';
import { SpotBalanceList } from '../components/OrderInfoPanel/List/SpotBalanceList';
import { PerpMobileNetworkAlert } from '../components/PerpMobileNetworkAlert';
import { PerpOrderBook } from '../components/PerpOrderBook';
import { PerpTips } from '../components/PerpTips';
import { PerpTickerBar } from '../components/TickerBar/PerpTickerBar';
import { PerpTradingPanel } from '../components/TradingPanel/PerpTradingPanel';
import { isHyperLiquidUnifiedAccountMode } from '../utils';
import {
  type IPerpsMobileLayoutTraceRect,
  getPerpsMobileLayoutTraceRect,
  isPerpsMobileLayoutTraceRectChanged,
  tracePerpsMobileLayout,
} from '../utils/mobileLayoutTrace';

export enum ETabName {
  Positions = 'Positions',
  OpenOrders = 'OpenOrders',
  Balances = 'Balances',
  SwapProOpenOrders = 'SwapProOpenOrders',
  SwapOrderHistory = 'SwapOrderHistory',
}

const tabNameToTranslationKey: Record<
  ETabName,
  | ETranslations.perp_position_title
  | ETranslations.perp_open_orders_title
  | ETranslations.perp_holdings_tokens
  | ETranslations.Limit_open_order
  | ETranslations.Limit_order_history
> = {
  [ETabName.Positions]: ETranslations.perp_position_title,
  [ETabName.OpenOrders]: ETranslations.perp_open_orders_title,
  [ETabName.Balances]: ETranslations.perp_holdings_tokens,
  [ETabName.SwapProOpenOrders]: ETranslations.Limit_open_order,
  [ETabName.SwapOrderHistory]: ETranslations.Limit_order_history,
};

export const TabBarItem = memo(
  ({
    name,
    isFocused,
    onPress,
    tabCount,
  }: {
    name: ETabName;
    isFocused: boolean;
    onPress: (name: ETabName) => void;
    tabCount?: string;
  }) => {
    const intl = useIntl();
    const tabTitle = intl.formatMessage({
      id: tabNameToTranslationKey[name],
    });
    const displayTitle = `${tabTitle}${tabCount ? ` ${tabCount}` : ''}`;

    return (
      <DebugRenderTracker
        position="bottom-center"
        name={`PerpMobileLayout_TabBarItem_${name}`}
      >
        <XStack
          py="$2"
          borderBottomWidth={isFocused ? '$0.5' : '$0'}
          borderBottomColor="$borderActive"
          onPress={() => onPress(name)}
          mb={-2}
        >
          <SizableText size="$bodyMdMedium" pr="$0.5">
            {displayTitle}
          </SizableText>
        </XStack>
      </DebugRenderTracker>
    );
  },
);

TabBarItem.displayName = 'TabBarItem';

export function PerpMobileLayout() {
  const tabBarHeight = useScrollContentTabBarOffset();
  const [activeTab, setActiveTab] = useState<ETabName>(ETabName.Positions);
  const [refreshing, setRefreshing] = useState(false);
  const layoutRectsRef = useRef<
    Record<string, IPerpsMobileLayoutTraceRect | undefined>
  >({});
  const contentHeightRef = useRef<number | undefined>(undefined);

  const navigation =
    useAppNavigation<IModalNavigationProp<IModalPerpParamList>>();
  const actions = useHyperliquidActions();

  const handleViewTpslOrders = useCallback(() => {
    setActiveTab(ETabName.OpenOrders);
  }, []);

  const handleViewTradesHistory = useCallback(() => {
    navigation.pushModal(EModalRoutes.PerpModal, {
      screen: EModalPerpRoutes.PerpTradersHistoryList,
    });
  }, [navigation]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await actions.current.refreshAllPerpsData();
    } finally {
      setRefreshing(false);
    }
  }, [actions]);

  const [perpOpenOrdersLength] = usePerpsActiveOpenOrdersLengthAtom();
  const [{ openOrders: spotOpenOrders }] = useSpotActiveOpenOrdersAtom();
  const openOrdersLength = perpOpenOrdersLength + spotOpenOrders.length;
  const [positionsLength] = usePerpsActivePositionLengthAtom();
  const [{ balances, isLoaded: isSpotBalancesLoaded }] = useSpotBalancesAtom();
  const [cachedSpotBalances] = usePerpsSpotBalancesAtom();
  const [accountSummary] = usePerpsActiveAccountSummaryAtom();
  const [currentUser] = usePerpsActiveAccountAtom();
  const [abstractionMode] = usePerpsAbstractionModeAtom();
  const isUnifiedAccountMode = isHyperLiquidUnifiedAccountMode(
    abstractionMode,
    currentUser?.accountAddress,
  );
  const currentUserAddress = currentUser?.accountAddress?.toLowerCase();
  const shouldUseCachedSpotBalances =
    !isSpotBalancesLoaded &&
    Boolean(currentUserAddress) &&
    cachedSpotBalances?.accountAddress?.toLowerCase() === currentUserAddress;
  const displayBalances = shouldUseCachedSpotBalances
    ? (cachedSpotBalances?.balances ?? balances)
    : balances;

  const holdingsCount = useMemo(() => {
    // Mirrors the USDC merge in SpotBalanceList.
    const nonUsdcSpotCount = displayBalances.filter(
      (item) => item.coin !== 'USDC' && !new BigNumber(item.total).isZero(),
    ).length;
    const hasSpotUsdc = displayBalances.some(
      (item) => item.coin === 'USDC' && !new BigNumber(item.total).isZero(),
    );
    const hasPerpsUsdc =
      !isUnifiedAccountMode &&
      !!accountSummary?.totalRawUsd &&
      new BigNumber(accountSummary.totalRawUsd).gt(0);
    return nonUsdcSpotCount + (hasSpotUsdc || hasPerpsUsdc ? 1 : 0);
  }, [accountSummary?.totalRawUsd, displayBalances, isUnifiedAccountMode]);

  const positionsTabCount = useMemo(() => {
    if (positionsLength > 0) {
      return `(${positionsLength})`;
    }
    return '';
  }, [positionsLength]);

  const openOrdersTabCount = useMemo(() => {
    if (openOrdersLength > 0) {
      return `(${openOrdersLength})`;
    }
    return '';
  }, [openOrdersLength]);

  const holdingsTabCount = useMemo(() => {
    if (holdingsCount > 0) {
      return `(${holdingsCount})`;
    }
    return '';
  }, [holdingsCount]);

  const handleTraceLayout = useCallback(
    (name: string, event: LayoutChangeEvent) => {
      const rect = getPerpsMobileLayoutTraceRect(event);
      if (
        isPerpsMobileLayoutTraceRectChanged(layoutRectsRef.current[name], rect)
      ) {
        tracePerpsMobileLayout(`perpTab.${name}.layout`, {
          rect,
          activeTab,
          isUnifiedAccountMode,
          openOrdersLength,
          positionsLength,
          holdingsCount,
        });
        layoutRectsRef.current[name] = rect;
      }
    },
    [
      activeTab,
      holdingsCount,
      isUnifiedAccountMode,
      openOrdersLength,
      positionsLength,
    ],
  );

  const handleContentSizeChange = useCallback(
    (_width: number, height: number) => {
      const roundedHeight = Math.round(height * 100) / 100;
      const prevHeight = contentHeightRef.current;
      if (
        prevHeight === undefined ||
        Math.abs(prevHeight - roundedHeight) > 0.5
      ) {
        tracePerpsMobileLayout('perpTab.scrollContent.height', {
          height: roundedHeight,
          prevHeight,
          delta:
            prevHeight === undefined ? undefined : roundedHeight - prevHeight,
          activeTab,
          tabBarHeight,
        });
        contentHeightRef.current = roundedHeight;
      }
    },
    [activeTab, tabBarHeight],
  );

  const handleScrollViewportLayout = useCallback(
    (event: LayoutChangeEvent) => {
      handleTraceLayout('scrollViewport', event);
    },
    [handleTraceLayout],
  );

  useEffect(() => {
    tracePerpsMobileLayout('perpTab.counts.state', {
      activeTab,
      openOrdersLength,
      positionsLength,
      holdingsCount,
      isUnifiedAccountMode,
      hasPerpsAccountSummary: Boolean(accountSummary),
      spotBalancesLength: balances.length,
    });
  }, [
    accountSummary,
    activeTab,
    balances.length,
    holdingsCount,
    isUnifiedAccountMode,
    openOrdersLength,
    positionsLength,
  ]);

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: '$bgApp' }}
      contentContainerStyle={{ flexGrow: 1, paddingBottom: tabBarHeight }}
      showsVerticalScrollIndicator={false}
      stickyHeaderIndices={[1]}
      onLayout={handleScrollViewportLayout}
      onContentSizeChange={handleContentSizeChange}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
      }
    >
      <YStack onLayout={(event) => handleTraceLayout('alerts', event)}>
        <PerpTips />
        <PerpMobileNetworkAlert />
      </YStack>

      <YStack onLayout={(event) => handleTraceLayout('tickerBar', event)}>
        <PerpTickerBar />
      </YStack>
      <XStack
        gap="$2.5"
        px="$4"
        pb="$4"
        onLayout={(event) => handleTraceLayout('firstScreenGrid', event)}
      >
        {/*
          OK-55214 follow-up: use flex-grow ratio (35:65) instead of
          flexBasis="35%" / "65%" — on iPad iOS the percentage-basis path
          caches the parent width captured during a landscape → portrait
          rotation transient (the SUB pane was briefly ~515.5pt), so the
          children render at the old half-width even after the XStack
          itself measures the full 1032pt parent. Switching to flex-grow
          ratio bypasses the basis cache.
        */}
        <YStack
          flex={35}
          minWidth={0}
          onLayout={(event) => handleTraceLayout('orderBookColumn', event)}
        >
          <PerpOrderBook />
        </YStack>
        <YStack
          flex={65}
          minWidth={0}
          onLayout={(event) => handleTraceLayout('tradingPanelColumn', event)}
        >
          <PerpTradingPanel isMobile />
        </YStack>
      </XStack>
      <XStack
        bg="$bgApp"
        borderBottomWidth="$0.5"
        borderBottomColor="$borderSubdued"
        justifyContent="space-between"
        alignItems="center"
        pr="$4"
        pl="$4"
        onLayout={(event) => handleTraceLayout('positionsTabBar', event)}
      >
        <XStack gap="$5">
          <TabBarItem
            name={ETabName.Positions}
            isFocused={activeTab === ETabName.Positions}
            onPress={setActiveTab}
            tabCount={positionsTabCount}
          />
          <TabBarItem
            name={ETabName.OpenOrders}
            isFocused={activeTab === ETabName.OpenOrders}
            onPress={setActiveTab}
            tabCount={openOrdersTabCount}
          />
          <TabBarItem
            name={ETabName.Balances}
            isFocused={activeTab === ETabName.Balances}
            onPress={setActiveTab}
            tabCount={holdingsTabCount}
          />
        </XStack>
        <IconButton
          testID="perp-icon-btn"
          variant="tertiary"
          size="small"
          borderRadius="$full"
          icon="ClockTimeHistoryOutline"
          onPress={handleViewTradesHistory}
        />
      </XStack>
      <YStack
        flex={1}
        onLayout={(event) => handleTraceLayout('tabContent', event)}
      >
        <YStack
          display={activeTab === ETabName.Positions ? 'flex' : 'none'}
          flex={1}
          onLayout={(event) => handleTraceLayout('positionsPanel', event)}
        >
          <PerpPositionsList
            handleViewTpslOrders={handleViewTpslOrders}
            isMobile
            useTabsList={false}
            disableListScroll
          />
        </YStack>
        <YStack
          display={activeTab === ETabName.OpenOrders ? 'flex' : 'none'}
          flex={1}
          onLayout={(event) => handleTraceLayout('openOrdersPanel', event)}
        >
          <PerpOpenOrdersList isMobile useTabsList={false} disableListScroll />
        </YStack>
        <YStack
          display={activeTab === ETabName.Balances ? 'flex' : 'none'}
          flex={1}
          onLayout={(event) => handleTraceLayout('balancesPanel', event)}
        >
          <SpotBalanceList isMobile useTabsList={false} disableListScroll />
        </YStack>
      </YStack>
    </ScrollView>
  );
}
