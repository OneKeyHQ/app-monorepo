import { useCallback, useRef, useState } from 'react';

import {
  EPageType,
  KEYBOARD_AWARE_SCROLL_BOTTOM_OFFSET,
  Keyboard,
  YStack,
  useScrollContentTabBarOffset,
} from '@onekeyhq/components';
import { ANIMATE_ONLY_OPACITY } from '@onekeyhq/components/src/utils/animationConstants';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { ESwapDirectionType } from '@onekeyhq/shared/types/swap/types';
import type {
  IFetchLimitOrderRes,
  IFetchQuoteResult,
  ISwapAlertState,
  ISwapNetwork,
  ISwapToken,
} from '@onekeyhq/shared/types/swap/types';

import SwapProviderListPanel from '../../components/SwapProviderListPanel';
import SwapRecentTokenPairsGroup from '../../components/SwapRecentTokenPairsGroup';
import { SwapThirdPartyNotice } from '../../components/SwapThirdPartyNotice';

import SwapActionsState from './SwapActionsState';
import SwapAlertContainer from './SwapAlertContainer';
import { useSwapHistoryScrollToTop } from './SwapHistoryTradeAgainContext';
import SwapProTabListContainer from './SwapProTabListContainer';
import SwapQuoteInput from './SwapQuoteInput';
import SwapQuoteResult from './SwapQuoteResult';
import { SwapQuoteStockMarketStatusAlert } from './SwapQuoteStockMarketStatusAlert';
import SwapTipsContainer from './SwapTipsContainer';

import type { LayoutChangeEvent } from 'react-native';
import type { KeyboardAwareScrollViewRef } from 'react-native-keyboard-controller';

// Width of the form beside the provider panel. It equals the form's width on
// a foldable iPhone's folded screen (466pt screen, 84pt tab bar, 20pt page
// padding on each side), so the form keeps its size when the device unfolds
// and nothing inside it shifts.
export const SWAP_TWO_PANE_FORM_WIDTH = 342;
// The $5 gap between the form and the panel, in points.
const SWAP_TWO_PANE_GAP = 20;
// Narrowest width the panel is shown at. A row without room for it beside the
// form hides it.
const SWAP_TWO_PANE_MIN_PANEL_WIDTH = 340;

interface ISwapSwapMbContainerProps {
  pageType: EPageType;
  swapTipsPageType?: EPageType;
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
  supportNetworksList: ISwapNetwork[];
  supportNetworksReady: boolean;
  showThirdPartyNotice?: boolean;
  // Devices whose screen can become wide (a foldable): when the row is wide
  // enough, the quote providers sit beside the form instead of behind a modal
  // and the positions list spans the page below both.
  providerPanelCapable?: boolean;
}

const SwapSwapMbContainer = ({
  pageType,
  swapTipsPageType,
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
  supportNetworksList,
  supportNetworksReady,
  showThirdPartyNotice,
  providerPanelCapable,
}: ISwapSwapMbContainerProps) => {
  // Whether the row has room for the panel beside the form. It is read from
  // the laid out row rather than from the window size: while a foldable folds
  // or unfolds the two disagree for a few frames.
  const [panelBeside, setPanelBeside] = useState(false);
  const handleRowLayout = useCallback((event: LayoutChangeEvent) => {
    setPanelBeside(
      event.nativeEvent.layout.width >=
        SWAP_TWO_PANE_FORM_WIDTH +
          SWAP_TWO_PANE_GAP +
          SWAP_TWO_PANE_MIN_PANEL_WIDTH,
    );
  }, []);
  const showProviderPanel = !!providerPanelCapable && panelBeside;
  const tabBarHeight = useScrollContentTabBarOffset();
  const scrollViewRef = useRef<KeyboardAwareScrollViewRef>(null);
  useSwapHistoryScrollToTop(scrollViewRef);
  const bottomOffset = KEYBOARD_AWARE_SCROLL_BOTTOM_OFFSET + 60;
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
  const formContent = (
    <>
      <SwapQuoteInput
        autoFocusFromInput
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
        // The panel beside the form already lists the providers.
        onOpenProviderList={showProviderPanel ? undefined : onOpenProviderList}
        quoteResult={quoteResult}
      />
      <SwapQuoteStockMarketStatusAlert onMarketReopen={refreshAction} />
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
      {showThirdPartyNotice ? <SwapThirdPartyNotice /> : null}
    </>
  );
  const proTabList = (
    <SwapProTabListContainer
      onTokenPress={onTokenPressCallback}
      onOpenOrdersClick={onOpenOrdersClick}
      onSearchClick={onSearchClickCallback}
      supportNetworksList={supportNetworksList}
      supportNetworksReady={supportNetworksReady}
    />
  );
  return (
    <Keyboard.AwareScrollView
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="on-drag"
      ref={scrollViewRef}
      showsVerticalScrollIndicator={false}
      contentContainerStyle={{ paddingBottom: tabBarHeight }}
      bottomOffset={bottomOffset}
    >
      <SwapTipsContainer pageType={swapTipsPageType} />
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
        <YStack onLayout={providerPanelCapable ? handleRowLayout : undefined}>
          {/* The form is capped at one width in every posture, so it is never
              remounted or resized when a foldable folds. */}
          <YStack
            width="100%"
            maxWidth={
              providerPanelCapable ? SWAP_TWO_PANE_FORM_WIDTH : undefined
            }
            gap="$5"
          >
            {formContent}
          </YStack>
          {providerPanelCapable ? (
            // Out of the flow, so the form alone sets the row height and the
            // panel matches it and scrolls inside. It keeps its place and a
            // minimum width when the row gets too narrow, running off the
            // screen edge, and fades instead of being cut: right after a fold
            // its edge is still on screen for a few frames. It stays mounted
            // while hidden, so unfolding fades it in without a mount delay.
            <YStack
              position="absolute"
              top={0}
              bottom={0}
              left={SWAP_TWO_PANE_FORM_WIDTH + SWAP_TWO_PANE_GAP}
              right={0}
              minWidth={SWAP_TWO_PANE_MIN_PANEL_WIDTH}
              opacity={panelBeside ? 1 : 0}
              pointerEvents={panelBeside ? 'auto' : 'none'}
              transition="quick"
              animateOnly={ANIMATE_ONLY_OPACITY}
            >
              <SwapProviderListPanel compact refreshAction={refreshAction} />
            </YStack>
          ) : null}
        </YStack>
        {/* Phones hide the positions list once an amount is entered. Foldable
            phones keep it in both postures, so folding does not drop it. */}
        {platformEnv.isNative && (providerPanelCapable || !fromTokenAmountValue)
          ? proTabList
          : null}
      </YStack>
    </Keyboard.AwareScrollView>
  );
};

export default SwapSwapMbContainer;
