import { useCallback, useEffect, useRef, useState } from 'react';

import { type ScrollView as ScrollViewNative } from 'react-native';

import { EPageType, ScrollView, YStack } from '@onekeyhq/components';
import type { EJotaiContextStoreNames } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { ESwapDirectionType } from '@onekeyhq/shared/types/swap/types';
import type {
  IFetchLimitOrderRes,
  IFetchQuoteResult,
  ISwapAlertState,
  ISwapToken,
} from '@onekeyhq/shared/types/swap/types';

import SwapRecentTokenPairsGroup from '../../components/SwapRecentTokenPairsGroup';

import SwapActionsState from './SwapActionsState';
import SwapAlertContainer from './SwapAlertContainer';
import SwapPendingHistoryListComponent from './SwapPendingHistoryList';
import SwapProTabListContainer from './SwapProTabListContainer';
import SwapQuoteInput from './SwapQuoteInput';
import SwapQuoteResult from './SwapQuoteResult';

interface ISwapSwapMbContainerProps {
  pageType: EPageType;
  onSelectToken: (type: ESwapDirectionType) => void;
  fetchLoading: boolean;
  onSelectPercentageStage: (stage: number) => void;
  onBalanceMaxPress: () => void;
  onPreSwap: () => void;
  onToAnotherAddressModal: () => void;
  onOpenProviderList: () => void;
  refreshAction: () => void;
  quoteResult?: IFetchQuoteResult;
  quoteLoading: boolean;
  quoteEventFetching: boolean;
  alerts: {
    states: ISwapAlertState[];
    quoteId: string;
  };
  onTokenPress: (token: ISwapToken) => void;
  onSelectRecentTokenPairs: ({
    fromToken,
    toToken,
  }: {
    fromToken: ISwapToken;
    toToken: ISwapToken;
  }) => void;
  onOpenOrdersClick: (item: IFetchLimitOrderRes) => void;
  fromTokenAmountValue: string;
  swapRecentTokenPairs: { fromToken: ISwapToken; toToken: ISwapToken }[];
}

const SwapSwapMbContainer = ({
  pageType,
  onSelectToken,
  fetchLoading,
  onSelectPercentageStage,
  onBalanceMaxPress,
  onPreSwap,
  onToAnotherAddressModal,
  onOpenProviderList,
  refreshAction,
  quoteResult,
  quoteLoading,
  quoteEventFetching,
  alerts,
  onTokenPress,
  onSelectRecentTokenPairs,
  onOpenOrdersClick,
  fromTokenAmountValue,
  swapRecentTokenPairs,
}: ISwapSwapMbContainerProps) => {
  const [shouldRenderHeavyComponents, setShouldRenderHeavyComponents] =
    useState(false);
  const scrollViewRef = useRef<ScrollViewNative>(null);
  const onSearchClickCallback = useCallback(() => {
    onSelectToken(ESwapDirectionType.FROM);
    scrollViewRef.current?.scrollTo({
      y: 0,
      animated: false,
    });
  }, [onSelectToken]);
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
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="on-drag"
      ref={scrollViewRef}
      showsVerticalScrollIndicator={false}
    >
      <YStack
        pt="$2.5"
        px="$5"
        gap="$5"
        flex={1}
        $gtMd={{
          flex: 'unset',
          pt: pageType === EPageType.modal ? '$2.5' : '$5',
        }}
        pb="$5"
      >
        <SwapQuoteInput
          onSelectToken={onSelectToken}
          selectLoading={fetchLoading}
          onSelectPercentageStage={onSelectPercentageStage}
          onBalanceMaxPress={onBalanceMaxPress}
        />
        <SwapActionsState
          onPreSwap={onPreSwap}
          onOpenRecipientAddress={onToAnotherAddressModal}
          onSelectPercentageStage={onSelectPercentageStage}
        />
        <SwapQuoteResult
          refreshAction={refreshAction}
          onOpenProviderList={onOpenProviderList}
          quoteResult={quoteResult}
          onOpenRecipient={onToAnotherAddressModal}
        />
        {alerts.states.length > 0 &&
        !quoteLoading &&
        !quoteEventFetching &&
        alerts?.quoteId === (quoteResult?.quoteId ?? '') ? (
          <SwapAlertContainer alerts={alerts.states} />
        ) : null}
        <SwapRecentTokenPairsGroup
          onSelectTokenPairs={onSelectRecentTokenPairs}
          tokenPairs={swapRecentTokenPairs}
          fromTokenAmount={fromTokenAmountValue}
        />
        <SwapPendingHistoryListComponent pageType={pageType} />
        {shouldRenderHeavyComponents ? (
          <>
            {platformEnv.isNative && !fromTokenAmountValue ? (
              <SwapProTabListContainer
                onTokenPress={onTokenPressCallback}
                onOpenOrdersClick={onOpenOrdersClick}
                onSearchClick={onSearchClickCallback}
              />
            ) : null}
          </>
        ) : null}
      </YStack>
    </ScrollView>
  );
};

export default SwapSwapMbContainer;
