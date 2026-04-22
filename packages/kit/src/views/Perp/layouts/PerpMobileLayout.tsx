import { memo, useCallback, useMemo, useState } from 'react';

import BigNumber from 'bignumber.js';
import { useIntl } from 'react-intl';
import { RefreshControl, ScrollView } from 'react-native';

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
  usePerpsActiveAccountSummaryAtom,
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
    const displayTitle =
      name === ETabName.Balances
        ? `${tabTitle}${tabCount ?? ''}`
        : `${tabTitle}${tabCount ? ` ${tabCount}` : ''}`;

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
          <SizableText size="$bodyMdMedium">{displayTitle}</SizableText>
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

  const [openOrdersLength] = usePerpsActiveOpenOrdersLengthAtom();
  const [positionsLength] = usePerpsActivePositionLengthAtom();
  const [{ balances }] = useSpotBalancesAtom();
  const [accountSummary] = usePerpsActiveAccountSummaryAtom();

  const holdingsCount = useMemo(() => {
    const nonZeroSpotBalanceCount = balances.filter(
      (item) => !new BigNumber(item.total).isZero(),
    ).length;
    const perpsUsdcCount =
      accountSummary?.totalRawUsd &&
      new BigNumber(accountSummary.totalRawUsd).gt(0)
        ? 1
        : 0;
    return nonZeroSpotBalanceCount + perpsUsdcCount;
  }, [accountSummary?.totalRawUsd, balances]);

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

  const holdingsTabCount = useMemo(() => `(${holdingsCount})`, [holdingsCount]);
  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: '$bgApp' }}
      contentContainerStyle={{ flexGrow: 1, paddingBottom: tabBarHeight }}
      showsVerticalScrollIndicator={false}
      stickyHeaderIndices={[1]}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
      }
    >
      <YStack>
        <PerpTips />
        <PerpMobileNetworkAlert />
      </YStack>

      <PerpTickerBar />
      <XStack gap="$2.5" px="$4" pb="$4">
        <YStack flexBasis="35%" flexShrink={1}>
          <PerpOrderBook />
        </YStack>
        <YStack flexBasis="65%" flexShrink={1}>
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
          variant="tertiary"
          size="small"
          borderRadius="$full"
          icon="ClockTimeHistoryOutline"
          onPress={handleViewTradesHistory}
        />
      </XStack>
      <YStack flex={1}>
        <YStack
          display={activeTab === ETabName.Positions ? 'flex' : 'none'}
          flex={1}
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
        >
          <PerpOpenOrdersList isMobile useTabsList={false} disableListScroll />
        </YStack>
        <YStack
          display={activeTab === ETabName.Balances ? 'flex' : 'none'}
          flex={1}
        >
          <SpotBalanceList isMobile useTabsList={false} disableListScroll />
        </YStack>
      </YStack>
    </ScrollView>
  );
}
