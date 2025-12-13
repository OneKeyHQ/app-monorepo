import { useCallback, useEffect, useRef, useState } from 'react';

import { RefreshControl, ScrollView } from 'react-native';

import { IconButton, XStack, YStack } from '@onekeyhq/components';
import {
  useSwapFromTokenAmountAtom,
  useSwapProErrorAlertAtom,
  useSwapProInputAmountAtom,
  useSwapProSelectTokenAtom,
  useSwapProSliderValueAtom,
} from '@onekeyhq/kit/src/states/jotai/contexts/swap';
import type {
  IFetchLimitOrderRes,
  ISwapProSpeedConfig,
  ISwapToken,
} from '@onekeyhq/shared/types/swap/types';

import { ETabName, TabBarItem } from '../../../Perp/layouts/PerpMobileLayout';
import SwapProErrorAlert from '../../components/SwapProErrorAlert';
import {
  useSwapProErrorAlert,
  useSwapProSupportNetworksTokenList,
  useSwapProTokenDetailInfo,
  useSwapProTokenInfoSync,
} from '../../hooks/useSwapPro';

import LimitOrderList from './LimitOrderList';
import SwapProCurrentSymbolEnable from './SwapProCurrentSymbolEnable';
import SwapProPositionsList from './SwapProPositionsList';
import SwapProTokenSelector from './SwapProTokenSelect';
import SwapProTradeInfoPanel from './SwapProTradeInfoPanel';
import SwapProTradingPanel from './SwapProTradingPanel';

interface ISwapProContainerProps {
  onProSelectToken: (autoSearch?: boolean) => void;
  onOpenOrdersClick: (item: IFetchLimitOrderRes) => void;
  onSwapProActionClick: () => void;
  handleSelectAccountClick: () => void;
  onProMarketDetail: () => void;
  config: {
    isLoading: boolean;
    speedConfig: ISwapProSpeedConfig;
    balanceLoading: boolean;
    isMEV: boolean;
    hasEnoughBalance: boolean;
  };
}

const SwapProContainer = ({
  onProSelectToken,
  onOpenOrdersClick,
  onSwapProActionClick,
  handleSelectAccountClick,
  onProMarketDetail,
  config,
}: ISwapProContainerProps) => {
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<ETabName | string>(
    ETabName.Positions,
  );
  const [swapProTokenSelect, setSwapProSelectToken] =
    useSwapProSelectTokenAtom();
  const [, setSwapProInputAmount] = useSwapProInputAmountAtom();
  const [, setFromInputAmount] = useSwapFromTokenAmountAtom();
  const [, setSwapProSliderValue] = useSwapProSliderValueAtom();
  const scrollViewRef = useRef<ScrollView>(null);
  const { fetchTokenMarketDetailInfo } = useSwapProTokenDetailInfo();
  const [swapProErrorAlert] = useSwapProErrorAlertAtom();
  const { syncInputTokenBalance, syncToTokenPrice, netAccountRes } =
    useSwapProTokenInfoSync();
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
    config;
  useSwapProErrorAlert();
  const cleanInputAmount = useCallback(() => {
    setSwapProInputAmount('');
    setFromInputAmount({
      value: '',
      isInput: true,
    });
    setSwapProSliderValue(0);
  }, [setSwapProInputAmount, setFromInputAmount, setSwapProSliderValue]);

  const netAccountAddress = netAccountRes.result?.addressDetail.address;
  useEffect(() => {
    cleanInputAmount();
  }, [netAccountAddress, cleanInputAmount]);

  const onTokenPress = useCallback(
    (token: ISwapToken) => {
      setSwapProSelectToken({
        networkId: token.networkId,
        contractAddress: token.contractAddress,
        decimals: token.decimals,
        symbol: token.symbol,
        logoURI: token.logoURI,
        networkLogoURI: token.networkLogoURI,
        name: token.name,
        isNative: token.isNative,
        price: token.price?.toString(),
      });
      scrollViewRef.current?.scrollTo({
        y: 0,
        animated: true,
      });
    },
    [setSwapProSelectToken],
  );
  return (
    <ScrollView
      style={{ flex: 1 }}
      ref={scrollViewRef}
      contentContainerStyle={{
        flexGrow: 1,
        paddingTop: 10,
        paddingHorizontal: 20,
      }}
      showsVerticalScrollIndicator={false}
      stickyHeaderIndices={[0, 2]}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="on-drag"
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
      }
    >
      <XStack justifyContent="space-between" pb="$4" pt="$1" bg="$bgApp">
        <SwapProTokenSelector
          onSelectTokenClick={() => {
            cleanInputAmount();
            onProSelectToken();
          }}
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
            cleanInputAmount={cleanInputAmount}
          />
        </YStack>
      </XStack>
      <SwapProErrorAlert
        title={swapProErrorAlert?.title}
        message={swapProErrorAlert?.message}
      />
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
            name={ETabName.SwapProOpenOrders}
            isFocused={activeTab === ETabName.SwapProOpenOrders}
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
          <SwapProPositionsList
            onTokenPress={onTokenPress}
            onSearchClick={() => onProSelectToken(true)}
          />
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
