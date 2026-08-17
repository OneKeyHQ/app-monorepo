import { useCallback, useEffect, useRef, useState } from 'react';

import { ScrollView } from 'react-native';

import {
  IconButton,
  RefreshControl,
  XStack,
  YStack,
  useScrollContentTabBarOffset,
} from '@onekeyhq/components';
import type { EPageType } from '@onekeyhq/components';
import {
  useSwapFromTokenAmountAtom,
  useSwapProErrorAlertAtom,
  useSwapProInputAmountAtom,
  useSwapProSelectTokenAtom,
  useSwapProTradeTypeAtom,
} from '@onekeyhq/kit/src/states/jotai/contexts/swap';
import {
  type EJotaiContextStoreNames,
  useSettingsPersistAtom,
} from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { equalTokenNoCaseSensitive } from '@onekeyhq/shared/src/utils/tokenUtils';
import type { IMarketBasicConfigNetwork } from '@onekeyhq/shared/types/marketV2';
import type {
  IFetchLimitOrderRes,
  ISwapProSpeedConfig,
  ISwapToken,
} from '@onekeyhq/shared/types/swap/types';
import {
  ESwapProAnalyticsTokenSelectFrom,
  ESwapProTradeType,
} from '@onekeyhq/shared/types/swap/types';

import {
  estimateMarketPresetGasFeeFiatValues,
  resolveMarketPresetNativeTokenPrice,
} from '../../../Market/MarketDetailV2/components/SwapPanel/hooks/marketDirectSendTx';
import SwapProErrorAlert from '../../components/SwapProErrorAlert';
import {
  useSwapPositionsSupportTokenListAction,
  useSwapProInputToken,
  useSwapProToToken,
  useSwapProTokenDetailInfo,
  useSwapProTokenInfoSync,
} from '../../hooks/useSwapPro';
import { SwapTestIDs } from '../../testIDs';

import SwapProTabListContainer from './SwapProTabListContainer';
import SwapProTokenSelector from './SwapProTokenSelect';
import SwapProTradeInfoPanel from './SwapProTradeInfoPanel';
import SwapProTradingPanel from './SwapProTradingPanel';
import SwapTipsContainer from './SwapTipsContainer';

import type {
  IEstimateMarketPresetPriorityFeeFiatValues,
  IMarketPresetPriorityFeeFiatEstimateMap,
} from '../../../Market/MarketDetailV2/components/SwapPanel/components/MarketPresetSelector';
import type { IMarketPresetSettingsState } from '../../../Market/MarketDetailV2/components/SwapPanel/hooks/useMarketPresetSettings';

interface ISwapProContainerProps {
  storeName: EJotaiContextStoreNames;
  pageType?: EPageType;
  isFocused: boolean;
  onProSelectToken: (autoSearch?: boolean) => void;
  onOpenOrdersClick: (item: IFetchLimitOrderRes) => void;
  onSwapProActionClick: () => void;
  handleSelectAccountClick: () => void;
  onProMarketDetail: () => void;
  onSelectPercentageStage: (stage: number) => void;
  onBalanceMaxPress: () => void;
  onTokenPress: (token: ISwapToken) => void;
  supportNetworksList: IMarketBasicConfigNetwork[];
  supportNetworksReady: boolean;
  marketPresetSettings?: IMarketPresetSettingsState;
  config: {
    isLoading: boolean;
    isAccountContextReady: boolean;
    speedConfigReady: boolean;
    speedConfig: ISwapProSpeedConfig;
    balanceLoading: boolean;
    supportSpeedSwap?: boolean;
    isMEV?: boolean;
    hasEnoughBalance: boolean;
  };
}

const SwapProContainer = ({
  storeName,
  pageType,
  isFocused,
  onProSelectToken,
  onOpenOrdersClick,
  onSwapProActionClick,
  handleSelectAccountClick,
  onProMarketDetail,
  onBalanceMaxPress,
  onSelectPercentageStage,
  onTokenPress,
  supportNetworksList,
  supportNetworksReady,
  marketPresetSettings,
  config,
}: ISwapProContainerProps) => {
  const {
    isLoading,
    isAccountContextReady,
    speedConfigReady,
    speedConfig,
    balanceLoading,
    isMEV,
    hasEnoughBalance,
    supportSpeedSwap,
  } = config;
  const [refreshing, setRefreshing] = useState(false);
  const [limitPriceUseMarketPrice, setLimitPriceUseMarketPrice] = useState({
    value: '',
    change: false,
  });
  const [swapProInputAmount, setSwapProInputAmount] =
    useSwapProInputAmountAtom();
  const [, setFromInputAmount] = useSwapFromTokenAmountAtom();
  const tabBarHeight = useScrollContentTabBarOffset();
  const scrollViewRef = useRef<ScrollView>(null);
  const { fetchTokenMarketDetailInfo } = useSwapProTokenDetailInfo();
  const [swapProErrorAlert] = useSwapProErrorAlertAtom();
  const [swapProSelectToken] = useSwapProSelectTokenAtom();
  const [swapProTradeType] = useSwapProTradeTypeAtom();
  const [settingsAtom] = useSettingsPersistAtom();
  const { syncInputTokenBalance, syncToTokenPrice, netAccountRes } =
    useSwapProTokenInfoSync();
  const inputToken = useSwapProInputToken();
  const toToken = useSwapProToToken();
  const { swapProLoadSupportNetworksTokenListRun } =
    useSwapPositionsSupportTokenListAction();
  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await Promise.all([
        fetchTokenMarketDetailInfo(),
        supportNetworksReady
          ? swapProLoadSupportNetworksTokenListRun(supportNetworksList, {
              forceRefresh: true,
            })
          : Promise.resolve(),
        syncInputTokenBalance(),
        syncToTokenPrice(),
      ]);
    } finally {
      setRefreshing(false);
    }
  }, [
    fetchTokenMarketDetailInfo,
    swapProLoadSupportNetworksTokenListRun,
    syncInputTokenBalance,
    syncToTokenPrice,
    supportNetworksList,
    supportNetworksReady,
  ]);
  const cleanInputAmount = useCallback(() => {
    setSwapProInputAmount('');
    setFromInputAmount({
      value: '',
      isInput: true,
    });
  }, [setSwapProInputAmount, setFromInputAmount]);

  const onSearchClickCallback = useCallback(() => {
    onProSelectToken(true);
    scrollViewRef.current?.scrollTo({
      y: 0,
      animated: false,
    });
  }, [onProSelectToken]);

  const onTokenPressCallback = useCallback(
    (token: ISwapToken) => {
      if (
        !token.isStock &&
        !equalTokenNoCaseSensitive({
          token1: token,
          token2: swapProSelectToken,
        })
      ) {
        defaultLogger.swap.swapPro.swapProTokenSwitch({
          selectFrom: ESwapProAnalyticsTokenSelectFrom.POSITIONS,
          tokenSymbol: token.symbol,
          network: token.networkId,
        });
      }
      onTokenPress(token);
      scrollViewRef.current?.scrollTo({
        y: 0,
        animated: true,
      });
    },
    [onTokenPress, swapProSelectToken],
  );

  const netAccountAddress = netAccountRes.result?.addressDetail.address;
  useEffect(() => {
    cleanInputAmount();
  }, [netAccountAddress, cleanInputAmount]);

  const showMarketPresetSelector =
    swapProTradeType === ESwapProTradeType.MARKET &&
    !!marketPresetSettings?.enabled;
  const estimatePriorityFeeFiatValues =
    useCallback<IEstimateMarketPresetPriorityFeeFiatValues>(
      async ({ items }) => {
        const estimates: IMarketPresetPriorityFeeFiatEstimateMap = {};
        const accountAddress =
          netAccountRes.result?.addressDetail.address ?? '';
        const accountId = netAccountRes.result?.id ?? '';
        const networkId = inputToken?.networkId ?? '';

        if (!accountAddress || !accountId || !networkId || !inputToken) {
          items.forEach((item) => {
            estimates[item.type] = undefined;
          });
          return estimates;
        }

        const nativeTokenPrice = await resolveMarketPresetNativeTokenPrice({
          networkId,
          currencyId: settingsAtom.currencyInfo.id,
          tokens: [inputToken, toToken],
        });

        const feeValues = await estimateMarketPresetGasFeeFiatValues({
          accountAddress,
          accountId,
          amount: swapProInputAmount,
          networkId,
          nativeTokenPrice,
          token: inputToken,
          items: items.map((item) => ({
            customPriorityFee: item.customPriorityFee,
            networkFeeLevel: item.networkFeeLevel,
          })),
        });

        items.forEach((item, index) => {
          estimates[item.type] = feeValues[index];
        });

        return estimates;
      },
      [
        inputToken,
        netAccountRes.result?.addressDetail.address,
        netAccountRes.result?.id,
        settingsAtom.currencyInfo.id,
        swapProInputAmount,
        toToken,
      ],
    );

  return (
    <ScrollView
      testID={SwapTestIDs.proContainer}
      style={{ flex: 1 }}
      ref={scrollViewRef}
      contentContainerStyle={{
        flexGrow: 1,
        paddingHorizontal: 20,
        paddingBottom: tabBarHeight,
      }}
      showsVerticalScrollIndicator={false}
      stickyHeaderIndices={[1]}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="on-drag"
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
      }
    >
      <YStack mx="$-5">
        <SwapTipsContainer pageType={pageType} />
      </YStack>
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
        {/* On mobile this candlestick button moved up into the top header
            capsule (SwapProKLineHeaderButton); keep it inline on desktop. */}
        {platformEnv.isNative ? null : (
          <IconButton
            testID="swap-icon-btn"
            icon="TradingViewCandlesOutline"
            variant="tertiary"
            flexShrink={0}
            onPress={onProMarketDetail}
          />
        )}
      </XStack>
      <XStack mt="$2" gap="$4" pb="$2.5" alignItems="stretch">
        <YStack flexBasis="40%" flexShrink={1} alignSelf="stretch">
          <SwapProTradeInfoPanel
            isFocused={isFocused}
            supportSpeedSwap={supportSpeedSwap}
            onPricePress={(price) => {
              if (swapProTradeType === ESwapProTradeType.LIMIT) {
                setLimitPriceUseMarketPrice((prev) => ({
                  value: price,
                  change: !prev.change,
                }));
              }
            }}
          />
        </YStack>
        <YStack flexBasis="60%" flexShrink={1} alignSelf="stretch">
          <SwapProTradingPanel
            storeName={storeName}
            supportSpeedSwap={!!supportSpeedSwap}
            swapProConfig={speedConfig}
            configLoading={isLoading}
            configReady={speedConfigReady}
            balanceLoading={balanceLoading}
            limitPriceUseMarketPrice={limitPriceUseMarketPrice}
            onBalanceMax={onBalanceMaxPress}
            onSelectPercentageStage={onSelectPercentageStage}
            onSwapProActionClick={onSwapProActionClick}
            hasEnoughBalance={hasEnoughBalance}
            handleSelectAccountClick={handleSelectAccountClick}
            cleanInputAmount={cleanInputAmount}
            marketPresetSettings={marketPresetSettings}
            showMarketPresetSelector={showMarketPresetSelector}
            antiMEV={isMEV}
            estimatePriorityFeeFiatValues={estimatePriorityFeeFiatValues}
          />
        </YStack>
      </XStack>
      <SwapProErrorAlert
        title={isAccountContextReady ? swapProErrorAlert?.title : undefined}
        message={isAccountContextReady ? swapProErrorAlert?.message : undefined}
      />
      <SwapProTabListContainer
        onTokenPress={onTokenPressCallback}
        onOpenOrdersClick={onOpenOrdersClick}
        onSearchClick={onSearchClickCallback}
        supportNetworksList={supportNetworksList}
        supportNetworksReady={supportNetworksReady}
      />
    </ScrollView>
  );
};

export default SwapProContainer;
