import type { ReactNode } from 'react';
import { useRef } from 'react';

import { useIntl } from 'react-intl';
import { type ScrollView as ScrollViewNative } from 'react-native';

import {
  EPageType,
  ScrollView,
  SizableText,
  XStack,
  YStack,
  useMedia,
} from '@onekeyhq/components';
import type { EJotaiContextStoreNames } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { ESwapTabSwitchType } from '@onekeyhq/shared/types/swap/types';
import type {
  ESwapDirectionType,
  IFetchQuoteResult,
  ISwapAlertState,
  ISwapToken,
} from '@onekeyhq/shared/types/swap/types';

import SwapFAQ from '../../components/SwapFAQ';
import SwapProviderListPanel from '../../components/SwapProviderListPanel';
import SwapRecentTokenPairsGroup from '../../components/SwapRecentTokenPairsGroup';

import LimitInfoContainer from './LimitInfoContainer';
import LimitOrderOpenItem from './LimitOrderOpenItem';
import SwapActionsState from './SwapActionsState';
import SwapAlertContainer from './SwapAlertContainer';
import SwapHeaderRightActionContainer from './SwapHeaderRightActionContainer';
import SwapPendingHistoryListComponent from './SwapPendingHistoryList';
import SwapQuoteInput from './SwapQuoteInput';
import SwapQuoteResult from './SwapQuoteResult';
import SwapTipsContainer from './SwapTipsContainer';

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
  headerContent?: ReactNode;
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
  headerContent,
}: ISwapOldSwapBridgeLimitContainerProps) => {
  const scrollViewRef = useRef<ScrollViewNative>(null);
  const { gtLg } = useMedia();
  const intl = useIntl();

  let swapTitle: string;
  if (swapTypeSwitch === ESwapTabSwitchType.BRIDGE) {
    swapTitle = intl.formatMessage({ id: ETranslations.swap_page_bridge });
  } else if (swapTypeSwitch === ESwapTabSwitchType.LIMIT) {
    swapTitle = intl.formatMessage({ id: ETranslations.swap_page_limit });
  } else {
    swapTitle = intl.formatMessage({ id: ETranslations.swap_page_swap });
  }

  // Desktop: show provider panel on the right side
  // Show when: on large desktop (gtLg), not in modal, and not in Limit mode
  const showDesktopProviderPanel =
    gtLg &&
    pageType !== EPageType.modal &&
    swapTypeSwitch !== ESwapTabSwitchType.LIMIT;

  const showLimitDesktopCard =
    gtLg &&
    pageType !== EPageType.modal &&
    swapTypeSwitch === ESwapTabSwitchType.LIMIT;

  const mainContent = (
    <YStack
      pt="$2.5"
      px="$5"
      gap="$5"
      flex={1}
      $gtMd={{
        flex: 'unset',
      }}
      {...(pageType !== EPageType.modal && {
        $gtLg: {
          maxWidth: 480,
          alignSelf: 'center',
          width: '100%',
        },
      })}
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
    // Clone mainContent with card styling for desktop
    const mainContentWithCard = (
      <YStack
        p="$6"
        gap="$5"
        borderRadius="$6"
        borderWidth={1}
        borderColor="$borderSubdued"
        elevationAndroid="$1"
        $platform-web={{
          boxShadow: '0px 0px 24px 0px rgba(0, 0, 0, 0.06)',
        }}
        style={{
          shadowColor: 'rgba(0, 0, 0, 0.08)',
          shadowOffset: { width: 0, height: 0 },
          shadowOpacity: 1,
          shadowRadius: 24,
        }}
      >
        <XStack alignItems="center" justifyContent="space-between">
          <SizableText size="$headingLg">{swapTitle}</SizableText>
          <SwapHeaderRightActionContainer
            pageType={pageType}
            iconSize="$5"
            iconColor="$iconStrong"
          />
        </XStack>
        <LimitOrderOpenItem storeName={storeName} />
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
      <ScrollView flex={1} contentContainerStyle={{ flexGrow: 1 }}>
        <SwapTipsContainer pageType={pageType} />
        {headerContent ? (
          <YStack pt="$8" pb="$4">
            {headerContent}
          </YStack>
        ) : null}
        <XStack
          gap="$1"
          px="$5"
          flex={1}
          width="100%"
          maxWidth={1140}
          marginHorizontal="auto"
        >
          <YStack p="$5" flexBasis="50%">
            <YStack gap="$12">
              {mainContentWithCard}
              <SwapFAQ />
            </YStack>
          </YStack>
          <YStack p="$5" flexBasis="50%">
            <SwapProviderListPanel refreshAction={refreshAction} />
          </YStack>
        </XStack>
      </ScrollView>
    );
  }

  if (showLimitDesktopCard) {
    return (
      <ScrollView flex={1} contentContainerStyle={{ flexGrow: 1 }}>
        <SwapTipsContainer pageType={pageType} />
        {headerContent ? (
          <YStack pt="$8" pb="$4">
            {headerContent}
          </YStack>
        ) : null}
        <YStack
          px="$5"
          pt="$6"
          pb="$5"
          width="100%"
          maxWidth={600}
          marginHorizontal="auto"
        >
          <YStack
            p="$6"
            gap="$5"
            borderRadius="$6"
            borderWidth={1}
            borderColor="$borderSubdued"
            elevationAndroid="$1"
            $platform-web={{
              boxShadow: '0px 0px 24px 0px rgba(0, 0, 0, 0.06)',
            }}
            style={{
              shadowColor: 'rgba(0, 0, 0, 0.08)',
              shadowOffset: { width: 0, height: 0 },
              shadowOpacity: 1,
              shadowRadius: 24,
            }}
          >
            <XStack alignItems="center" justifyContent="space-between">
              <SizableText size="$headingLg">{swapTitle}</SizableText>
              <SwapHeaderRightActionContainer
                pageType={pageType}
                iconSize="$5"
                iconColor="$iconStrong"
              />
            </XStack>
            <LimitOrderOpenItem storeName={storeName} />
            <SwapQuoteInput
              onSelectToken={onSelectToken}
              selectLoading={fetchLoading}
              onSelectPercentageStage={onSelectPercentageStage}
              onBalanceMaxPress={onBalanceMaxPress}
            />
            {!isWrapped ? <LimitInfoContainer /> : null}
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
        </YStack>
      </ScrollView>
    );
  }

  return (
    <ScrollView
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="on-drag"
      ref={scrollViewRef}
    >
      <SwapTipsContainer pageType={pageType} />
      {headerContent ? (
        <YStack pt="$8" pb="$4">
          {headerContent}
        </YStack>
      ) : null}
      {mainContent}
    </ScrollView>
  );
};

export default SwapOldSwapBridgeLimitContainer;
