import { useCallback, useEffect, useRef, useState } from 'react';

import { RefreshControl, ScrollView } from 'react-native';

import { IconButton, XStack, YStack } from '@onekeyhq/components';
import {
  useSwapFromTokenAmountAtom,
  useSwapProEnableCurrentSymbolAtom,
  useSwapProErrorAlertAtom,
  useSwapProInputAmountAtom,
  useSwapProSelectTokenAtom,
  useSwapProSliderValueAtom,
} from '@onekeyhq/kit/src/states/jotai/contexts/swap';
import { appEventBus } from '@onekeyhq/shared/src/eventBus/appEventBus';
import { EAppEventBusNames } from '@onekeyhq/shared/src/eventBus/appEventBusNames';
import type { IMarketBasicConfigNetwork } from '@onekeyhq/shared/types/marketV2';
import type {
  IFetchLimitOrderRes,
  ISwapProSpeedConfig,
  ISwapToken,
} from '@onekeyhq/shared/types/swap/types';

import { ETabName, TabBarItem } from '../../../Perp/layouts/PerpMobileLayout';
import SwapProErrorAlert from '../../components/SwapProErrorAlert';
import {
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
    networkList: IMarketBasicConfigNetwork[];
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
  const {
    isLoading,
    speedConfig,
    balanceLoading,
    isMEV,
    hasEnoughBalance,
    networkList,
  } = config;
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
  const [swapCurrentSymbolEnable] = useSwapProEnableCurrentSymbolAtom();
  const { syncInputTokenBalance, syncToTokenPrice, netAccountRes } =
    useSwapProTokenInfoSync();
  const { swapProLoadSupportNetworksTokenListRun } =
    useSwapProSupportNetworksTokenList(networkList);
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

  const changeTabToLimitOrderList = useCallback(() => {
    setActiveTab(ETabName.SwapProOpenOrders);
  }, [setActiveTab]);

  useEffect(() => {
    appEventBus.off(
      EAppEventBusNames.SwapLimitOrderBuildSuccess,
      changeTabToLimitOrderList,
    );
    appEventBus.on(
      EAppEventBusNames.SwapLimitOrderBuildSuccess,
      changeTabToLimitOrderList,
    );
    return () => {
      appEventBus.off(
        EAppEventBusNames.SwapLimitOrderBuildSuccess,
        changeTabToLimitOrderList,
      );
    };
  }, [changeTabToLimitOrderList]);

  return (
    <ScrollView
      style={{ flex: 1 }}
      ref={scrollViewRef}
      contentContainerStyle={{
        flexGrow: 1,
        paddingHorizontal: 20,
      }}
      showsVerticalScrollIndicator={false}
      stickyHeaderIndices={[0, 3]}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="on-drag"
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
      }
    >
      <XStack
        justifyContent="space-between"
        pb="$2"
        pt="$2"
        alignItems="center"
        bg="$bgApp"
      >
        <SwapProTokenSelector
          onSelectTokenClick={() => {
            cleanInputAmount();
            onProSelectToken();
          }}
          configLoading={isLoading}
        />
        <IconButton
          icon="TradingViewCandlesOutline"
          variant="tertiary"
          flexShrink={0}
          onPress={onProMarketDetail}
        />
      </XStack>
      <XStack mt="$2" gap="$4" pb="$4" alignItems="stretch">
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
            onSearchClick={() => {
              onProSelectToken(true);
              scrollViewRef.current?.scrollTo({
                y: 0,
                animated: false,
              });
            }}
          />
        </YStack>
        <YStack
          display={activeTab === ETabName.SwapProOpenOrders ? 'flex' : 'none'}
          flex={1}
        >
          <SwapProCurrentSymbolEnable />
          <LimitOrderList
            onClickCell={onOpenOrdersClick}
            type="open"
            filterToken={
              swapCurrentSymbolEnable ? swapProTokenSelect : undefined
            }
          />
        </YStack>
      </YStack>
    </ScrollView>
  );
};

export default SwapProContainer;
