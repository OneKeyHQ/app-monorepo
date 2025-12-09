import { useCallback, useState } from 'react';

import { RefreshControl, ScrollView } from 'react-native';

import { IconButton, XStack, YStack } from '@onekeyhq/components';
import { useSwapProSelectTokenAtom } from '@onekeyhq/kit/src/states/jotai/contexts/swap';
import type { IFetchLimitOrderRes } from '@onekeyhq/shared/types/swap/types';

import { ETabName, TabBarItem } from '../../../Perp/layouts/PerpMobileLayout';
import {
  useSwapProSupportNetworksTokenList,
  useSwapProTokenDetailInfo,
  useSwapProTokenInfoSync,
  useSwapProTokenInit,
} from '../../hooks/useSwapPro';

import LimitOrderList from './LimitOrderList';
import SwapProCurrentSymbolEnable from './SwapProCurrentSymbolEnable';
import SwapProPositionsList from './SwapProPositionsList';
import SwapProTokenSelector from './SwapProTokenSelect';
import SwapProTradeInfoPanel from './SwapProTradeInfoPanel';
import SwapProTradingPanel from './SwapProTradingPanel';

interface ISwapProContainerProps {
  onProSelectToken: () => void;
  onOpenOrdersClick: (item: IFetchLimitOrderRes) => void;
  onSwapProActionClick: () => void;
  handleSelectAccountClick: () => void;
  onProMarketDetail: () => void;
}

const SwapProContainer = ({
  onProSelectToken,
  onOpenOrdersClick,
  onSwapProActionClick,
  handleSelectAccountClick,
  onProMarketDetail,
}: ISwapProContainerProps) => {
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<ETabName | string>(
    ETabName.Positions,
  );
  const [swapProTokenSelect] = useSwapProSelectTokenAtom();
  const { fetchTokenMarketDetailInfo } = useSwapProTokenDetailInfo();
  const { syncInputTokenBalance, syncToTokenPrice } = useSwapProTokenInfoSync();
  const { swapProLoadSupportNetworksTokenListRun } =
    useSwapProSupportNetworksTokenList();
  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([
      fetchTokenMarketDetailInfo(),
      swapProLoadSupportNetworksTokenListRun(),
      syncInputTokenBalance(),
      syncToTokenPrice(),
    ]);
    setRefreshing(false);
  }, [
    fetchTokenMarketDetailInfo,
    swapProLoadSupportNetworksTokenListRun,
    syncInputTokenBalance,
    syncToTokenPrice,
  ]);

  const { isLoading, speedConfig, balanceLoading, isMEV, hasEnoughBalance } =
    useSwapProTokenInit();

  return (
    <ScrollView
      style={{ flex: 1 }}
      contentContainerStyle={{ flexGrow: 1 }}
      showsVerticalScrollIndicator={false}
      stickyHeaderIndices={[0, 2]}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
      }
    >
      <XStack justifyContent="space-between" pb="$4" pt="$1" bg="$bgApp">
        <SwapProTokenSelector
          onSelectTokenClick={onProSelectToken}
          configLoading={isLoading}
        />
        <IconButton
          icon="ChartTrendingUp2Outline"
          w="$6"
          h="$6"
          onPress={onProMarketDetail}
          backgroundColor="$bgApp"
        />
      </XStack>
      <XStack gap="$2.5" pb="$4" alignItems="stretch">
        <YStack flexBasis="40%" flexShrink={1} alignSelf="stretch">
          <SwapProTradeInfoPanel />
        </YStack>
        <YStack flexBasis="60%" flexShrink={1} alignSelf="stretch">
          <SwapProTradingPanel
            swapProConfig={speedConfig}
            configLoading={isLoading}
            balanceLoading={balanceLoading}
            isMev={isMEV}
            onSwapProActionClick={onSwapProActionClick}
            hasEnoughBalance={hasEnoughBalance}
            handleSelectAccountClick={handleSelectAccountClick}
          />
        </YStack>
      </XStack>
      <XStack
        bg="$bgApp"
        borderBottomWidth="$0.5"
        borderBottomColor="$borderSubdued"
        justifyContent="space-between"
        alignItems="center"
      >
        <XStack gap="$5" bg="$bgApp">
          <TabBarItem
            name={ETabName.Positions}
            isFocused={activeTab === ETabName.Positions}
            onPress={setActiveTab}
          />
          <TabBarItem
            name={ETabName.OpenOrders}
            isFocused={activeTab === ETabName.OpenOrders}
            onPress={setActiveTab}
          />
        </XStack>
      </XStack>
      <YStack flex={1}>
        <YStack
          display={activeTab === ETabName.Positions ? 'flex' : 'none'}
          flex={1}
        >
          <SwapProCurrentSymbolEnable />
          <SwapProPositionsList />
        </YStack>
        <YStack
          display={activeTab === ETabName.OpenOrders ? 'flex' : 'none'}
          flex={1}
        >
          <SwapProCurrentSymbolEnable />
          <LimitOrderList
            onClickCell={onOpenOrdersClick}
            type="open"
            filterToken={swapProTokenSelect}
          />
        </YStack>
      </YStack>
    </ScrollView>
  );
};

export default SwapProContainer;
