import { useRef } from 'react';

import { type ScrollView as ScrollViewNative } from 'react-native';

import {
  EPageType,
  ScrollView,
  XStack,
  YStack,
  useMedia,
} from '@onekeyhq/components';
import type { EJotaiContextStoreNames } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { ESwapTabSwitchType } from '@onekeyhq/shared/types/swap/types';
import type {
  ESwapDirectionType,
  IFetchQuoteResult,
  ISwapAlertState,
  ISwapToken,
} from '@onekeyhq/shared/types/swap/types';

import SwapProviderListPanel from '../../components/SwapProviderListPanel';
import SwapRecentTokenPairsGroup from '../../components/SwapRecentTokenPairsGroup';

import LimitInfoContainer from './LimitInfoContainer';
import LimitOrderOpenItem from './LimitOrderOpenItem';
import SwapActionsState from './SwapActionsState';
import SwapAlertContainer from './SwapAlertContainer';
import SwapPendingHistoryListComponent from './SwapPendingHistoryList';
import SwapQuoteInput from './SwapQuoteInput';
import SwapQuoteResult from './SwapQuoteResult';

interface ISwapOldSwapBridgeLimitContainerProps {
  pageType?: EPageType;
  storeName: EJotaiContextStoreNames;
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
  swapTypeSwitch: ESwapTabSwitchType;
  alerts: {
    states: ISwapAlertState[];
    quoteId: string;
  };
  isWrapped: boolean;
  onSelectRecentTokenPairs: ({
    fromToken,
    toToken,
  }: {
    fromToken: ISwapToken;
    toToken: ISwapToken;
  }) => void;
  fromTokenAmountValue: string;
  swapRecentTokenPairs: { fromToken: ISwapToken; toToken: ISwapToken }[];
}

const SwapOldSwapBridgeLimitContainer = ({
  pageType,
  storeName,
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
  swapTypeSwitch,
  alerts,
  isWrapped,
  onSelectRecentTokenPairs,
  fromTokenAmountValue,
  swapRecentTokenPairs,
}: ISwapOldSwapBridgeLimitContainerProps) => {
  const scrollViewRef = useRef<ScrollViewNative>(null);
  const { gtMd } = useMedia();

  // Desktop: show provider panel on the right side
  // Show when: on desktop (gtMd) and not in modal
  const showDesktopProviderPanel = gtMd && pageType !== EPageType.modal;

  const mainContent = (
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
      <LimitOrderOpenItem storeName={storeName} />
      <SwapQuoteInput
        onSelectToken={onSelectToken}
        selectLoading={fetchLoading}
        onSelectPercentageStage={onSelectPercentageStage}
        onBalanceMaxPress={onBalanceMaxPress}
      />
      {swapTypeSwitch === ESwapTabSwitchType.LIMIT && !isWrapped ? (
        <LimitInfoContainer />
      ) : null}
      <SwapActionsState
        onPreSwap={onPreSwap}
        onOpenRecipientAddress={onToAnotherAddressModal}
        onSelectPercentageStage={onSelectPercentageStage}
      />
      <SwapQuoteResult
        refreshAction={refreshAction}
        onOpenProviderList={
          showDesktopProviderPanel ? undefined : onOpenProviderList
        }
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
    </YStack>
  );

  if (showDesktopProviderPanel) {
    // Clone mainContent with px="$0" to avoid double padding (outer XStack already has px="$5")
    const mainContentWithoutPadding = (
      <YStack
        pt="$2.5"
        px="$0"
        gap="$5"
        flex={1}
        $gtMd={{
          flex: 'unset',
          pt: '$5',
        }}
        pb="$5"
      >
        <LimitOrderOpenItem storeName={storeName} />
        <SwapQuoteInput
          onSelectToken={onSelectToken}
          selectLoading={fetchLoading}
          onSelectPercentageStage={onSelectPercentageStage}
          onBalanceMaxPress={onBalanceMaxPress}
        />
        {swapTypeSwitch === ESwapTabSwitchType.LIMIT && !isWrapped ? (
          <LimitInfoContainer />
        ) : null}
        <SwapActionsState
          onPreSwap={onPreSwap}
          onOpenRecipientAddress={onToAnotherAddressModal}
          onSelectPercentageStage={onSelectPercentageStage}
        />
        <SwapQuoteResult
          refreshAction={refreshAction}
          onOpenProviderList={undefined}
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
      </YStack>
    );
    return (
      <XStack flex={1} gap="$5" px="$5" alignItems="flex-start">
        <ScrollView
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          ref={scrollViewRef}
          flex={1}
        >
          {mainContentWithoutPadding}
        </ScrollView>
        <YStack pt="$5" maxHeight={480}>
          <SwapProviderListPanel refreshAction={refreshAction} />
        </YStack>
      </XStack>
    );
  }

  return (
    <ScrollView
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="on-drag"
      ref={scrollViewRef}
    >
      {mainContent}
    </ScrollView>
  );
};

export default SwapOldSwapBridgeLimitContainer;
