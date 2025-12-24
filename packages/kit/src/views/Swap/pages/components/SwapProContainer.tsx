import { useEffect, useState } from 'react';

import { Skeleton, XStack, YStack } from '@onekeyhq/components';
import {
  useSwapProErrorAlertAtom,
  useSwapProSelectTokenAtom,
  useSwapProTradeTypeAtom,
} from '@onekeyhq/kit/src/states/jotai/contexts/swap';
import type {
  IFetchLimitOrderRes,
  ISwapProSpeedConfig,
  ISwapToken,
} from '@onekeyhq/shared/types/swap/types';
import { ESwapProTradeType } from '@onekeyhq/shared/types/swap/types';

import SwapProErrorAlert from '../../components/SwapProErrorAlert';

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
  cleanProInputAmount: () => void;
  onTokenPress: (token: ISwapToken) => void;
  swapProLoadSupportNetworksTokenListRun: () => void;
  config: {
    isLoading: boolean;
    speedConfig: ISwapProSpeedConfig;
    balanceLoading: boolean;
    isMEV: boolean;
    hasEnoughBalance: boolean;
  };
}

const SwapProContainer = ({
  onSwapProActionClick,
  handleSelectAccountClick,
  onBalanceMaxPress,
  onSelectPercentageStage,
  cleanProInputAmount,
  config,
}: ISwapProContainerProps) => {
  const { isLoading, speedConfig, balanceLoading, isMEV, hasEnoughBalance } =
    config;
  const [limitPriceUseMarketPrice, setLimitPriceUseMarketPrice] = useState({
    value: '',
    change: false,
  });
  const [swapProErrorAlert] = useSwapProErrorAlertAtom();
  const [swapProTradeType] = useSwapProTradeTypeAtom();
  const [swapProSelectToken] = useSwapProSelectTokenAtom();
  // Delay rendering heavy components to improve initial render performance
  const [shouldRenderHeavyComponents, setShouldRenderHeavyComponents] =
    useState(false);
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
    <YStack px="$5">
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
              cleanInputAmount={cleanProInputAmount}
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
    </YStack>
  );
};

export default SwapProContainer;
