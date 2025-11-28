import { useCallback, useState } from 'react';

import { RefreshControl, ScrollView } from 'react-native';

import { IconButton, XStack, YStack } from '@onekeyhq/components';
import { TabBarItem } from '@onekeyhq/components/src/composite/Tabs/TabBar';
import type { IFetchLimitOrderRes } from '@onekeyhq/shared/types/swap/types';

import { ETabName } from '../../../Perp/layouts/PerpMobileLayout';
import {
  useSwapProSupportNetworksTokenList,
  useSwapProTokenDetailInfo,
} from '../../hooks/useSwapPro';

import LimitOrderList from './LimitOrderList';
import SwapProPositionsList from './SwapProPositionsList';
import SwapProTokenSelector from './SwapProTokenSelect';
import SwapProTradeInfoPanel from './SwapProTradeInfoPanel';
import SwapProTradingPanel from './SwapProTradingPanel';

interface ISwapProContainerProps {
  onProSelectToken: () => void;
  onOpenOrdersClick: (item: IFetchLimitOrderRes) => void;
}

const SwapProContainer = ({
  onProSelectToken,
  onOpenOrdersClick,
}: ISwapProContainerProps) => {
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<ETabName | string>(
    ETabName.Positions,
  );
  const { fetchTokenMarketDetailInfo } = useSwapProTokenDetailInfo();
  const { swapProLoadSupportNetworksTokenListRun } =
    useSwapProSupportNetworksTokenList();
  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchTokenMarketDetailInfo();
    await swapProLoadSupportNetworksTokenListRun();
    setRefreshing(false);
  }, [fetchTokenMarketDetailInfo, swapProLoadSupportNetworksTokenListRun]);

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: '$bgApp' }}
      contentContainerStyle={{ flexGrow: 1 }}
      showsVerticalScrollIndicator={false}
      stickyHeaderIndices={[0, 2]}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
      }
    >
      <XStack justifyContent="space-between" pb="$4" pt="$1" bg="$bgApp">
        <SwapProTokenSelector onSelectTokenClick={onProSelectToken} />
        <IconButton icon="AccessibilityEyeSolid" />
      </XStack>
      {/* <PerpTickerBar /> */}
      <XStack gap="$2.5" pb="$4">
        <YStack flexBasis="40%" flexShrink={1}>
          <SwapProTradeInfoPanel />
        </YStack>
        <YStack flexBasis="60%" flexShrink={1}>
          <SwapProTradingPanel />
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
        <IconButton
          variant="tertiary"
          size="small"
          borderRadius="$full"
          icon="ClockTimeHistoryOutline"
          onPress={() => {}}
        />
      </XStack>
      <YStack flex={1}>
        <YStack
          display={activeTab === ETabName.Positions ? 'flex' : 'none'}
          flex={1}
        >
          <SwapProPositionsList />
        </YStack>
        <YStack
          display={activeTab === ETabName.OpenOrders ? 'flex' : 'none'}
          flex={1}
        >
          <LimitOrderList onClickCell={onOpenOrdersClick} type="open" />
        </YStack>
      </YStack>
    </ScrollView>
  );
};

export default SwapProContainer;
