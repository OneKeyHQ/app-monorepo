import { useCallback, useEffect, useRef, useState } from 'react';

import { RefreshControl, ScrollView } from 'react-native';

import { IconButton, Skeleton, XStack, YStack } from '@onekeyhq/components';
import {
  useSwapFromTokenAmountAtom,
  useSwapProErrorAlertAtom,
  useSwapProInputAmountAtom,
  useSwapProSelectTokenAtom,
  useSwapProSliderValueAtom,
  useSwapProTradeTypeAtom,
} from '@onekeyhq/kit/src/states/jotai/contexts/swap';
import type { IMarketBasicConfigNetwork } from '@onekeyhq/shared/types/marketV2';
import type {
  IFetchLimitOrderRes,
  ISwapProSpeedConfig,
  ISwapToken,
} from '@onekeyhq/shared/types/swap/types';
import { ESwapProTradeType } from '@onekeyhq/shared/types/swap/types';

import SwapProErrorAlert from '../../components/SwapProErrorAlert';
import {
  useSwapPositionsSupportTokenListAction,
  useSwapProTokenDetailInfo,
  useSwapProTokenInfoSync,
} from '../../hooks/useSwapPro';

import SwapProTabListContainer from './SwapProTabListContainer';
import SwapProTokenSelector from './SwapProTokenSelect';
import SwapProTradeInfoPanel from './SwapProTradeInfoPanel';
import SwapProTradingPanel from './SwapProTradingPanel';

interface ISwapProContainerProps {
  onProSelectToken: (autoSearch?: boolean) => void;
  onOpenOrdersClick: (item: IFetchLimitOrderRes) => void;
  onSwapProActionClick: () => void;
  handleSelectAccountClick: () => void;
  onProMarketDetail: () => void;
  onSelectPercentageStage: (stage: number) => void;
  onBalanceMaxPress: () => void;
  onTokenPress: (token: ISwapToken) => void;
  supportNetworksList: IMarketBasicConfigNetwork[];
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
  onBalanceMaxPress,
  onSelectPercentageStage,
  onTokenPress,
  supportNetworksList,
  config,
}: ISwapProContainerProps) => {
  const { isLoading, speedConfig, balanceLoading, isMEV, hasEnoughBalance } =
    config;
  const [refreshing, setRefreshing] = useState(false);
  const [limitPriceUseMarketPrice, setLimitPriceUseMarketPrice] = useState({
    value: '',
    change: false,
  });
  const [, setSwapProInputAmount] = useSwapProInputAmountAtom();
  const [, setFromInputAmount] = useSwapFromTokenAmountAtom();
  const [, setSwapProSliderValue] = useSwapProSliderValueAtom();
  const scrollViewRef = useRef<ScrollView>(null);
  const { fetchTokenMarketDetailInfo } = useSwapProTokenDetailInfo();
  const [swapProErrorAlert] = useSwapProErrorAlertAtom();
  const [swapProTradeType] = useSwapProTradeTypeAtom();
  const [swapProSelectToken] = useSwapProSelectTokenAtom();
  const { syncInputTokenBalance, syncToTokenPrice, netAccountRes } =
    useSwapProTokenInfoSync();
  // Delay rendering heavy components to improve initial render performance
  const [shouldRenderHeavyComponents, setShouldRenderHeavyComponents] =
    useState(false);

  const { swapProLoadSupportNetworksTokenListRun } =
    useSwapPositionsSupportTokenListAction();
  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([
      fetchTokenMarketDetailInfo(),
      swapProLoadSupportNetworksTokenListRun(supportNetworksList),
      syncInputTokenBalance(),
      syncToTokenPrice(),
    ]);
    setRefreshing(false);
  }, [
    fetchTokenMarketDetailInfo,
    swapProLoadSupportNetworksTokenListRun,
    syncInputTokenBalance,
    syncToTokenPrice,
    supportNetworksList,
  ]);
  const cleanInputAmount = useCallback(() => {
    setSwapProInputAmount('');
    setFromInputAmount({
      value: '',
      isInput: true,
    });
    setSwapProSliderValue(0);
  }, [setSwapProInputAmount, setFromInputAmount, setSwapProSliderValue]);

  const onSearchClickCallback = useCallback(() => {
    onProSelectToken(true);
    scrollViewRef.current?.scrollTo({
      y: 0,
      animated: false,
    });
  }, [onProSelectToken]);

  const onTokenPressCallback = useCallback(
    (token: ISwapToken) => {
      onTokenPress(token);
      scrollViewRef.current?.scrollTo({
        y: 0,
        animated: true,
      });
    },
    [onTokenPress],
  );

  const netAccountAddress = netAccountRes.result?.addressDetail.address;
  useEffect(() => {
    cleanInputAmount();
  }, [netAccountAddress, cleanInputAmount]);

  // Delay rendering heavy components after initial render
  useEffect(() => {
    const timer = setTimeout(() => {
      setShouldRenderHeavyComponents(true);
    }, 100);
    return () => {
      clearTimeout(timer);
    };
  }, []);

  return (
    <ScrollView
      style={{ flex: 1 }}
      ref={scrollViewRef}
      contentContainerStyle={{
        flexGrow: 1,
        paddingHorizontal: 20,
      }}
      showsVerticalScrollIndicator={false}
      stickyHeaderIndices={[0]}
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
          {shouldRenderHeavyComponents ? (
            <SwapProTradeInfoPanel
              onPricePress={(price) => {
                if (swapProTradeType === ESwapProTradeType.LIMIT) {
                  setLimitPriceUseMarketPrice((prev) => ({
                    value: price,
                    change: !prev.change,
                  }));
                }
              }}
            />
          ) : (
            <YStack gap="$6" flex={1} p="$3">
              <Skeleton w="100%" h="$20" borderRadius="$2" />
              <Skeleton w="100%" h="$32" borderRadius="$2" />
              <Skeleton w="100%" h="$20" borderRadius="$2" />
            </YStack>
          )}
        </YStack>
        <YStack flexBasis="60%" flexShrink={1} alignSelf="stretch">
          {shouldRenderHeavyComponents ? (
            <SwapProTradingPanel
              swapProConfig={speedConfig}
              configLoading={isLoading}
              balanceLoading={balanceLoading}
              limitPriceUseMarketPrice={limitPriceUseMarketPrice}
              isMev={isMEV}
              onBalanceMax={onBalanceMaxPress}
              onSelectPercentageStage={onSelectPercentageStage}
              onSwapProActionClick={onSwapProActionClick}
              hasEnoughBalance={hasEnoughBalance}
              handleSelectAccountClick={handleSelectAccountClick}
              cleanInputAmount={cleanInputAmount}
            />
          ) : (
            <YStack gap="$6" flex={1} p="$3">
              <Skeleton w="100%" h="$8" borderRadius="$2" />
              <Skeleton w="100%" h="$8" borderRadius="$2" />
              <Skeleton w="100%" h="$18" borderRadius="$2" />
              <Skeleton w="100%" h="$28" borderRadius="$2" />
              <Skeleton w="100%" h="$8" borderRadius="$2" />
            </YStack>
          )}
        </YStack>
      </XStack>
      <SwapProErrorAlert
        isNative={swapProSelectToken?.isNative}
        title={swapProErrorAlert?.title}
        message={swapProErrorAlert?.message}
      />
      {shouldRenderHeavyComponents ? (
        <SwapProTabListContainer
          onTokenPress={onTokenPressCallback}
          onOpenOrdersClick={onOpenOrdersClick}
          onSearchClick={onSearchClickCallback}
          supportNetworksList={supportNetworksList}
          disableDelayRender
        />
      ) : null}
    </ScrollView>
  );
};

export default SwapProContainer;
