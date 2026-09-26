import type { ReactNode } from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import BigNumber from 'bignumber.js';
import { useIntl } from 'react-intl';
import { InputAccessoryView } from 'react-native';

import type { EPageType } from '@onekeyhq/components';
import {
  Button,
  Icon,
  KEYBOARD_AWARE_SCROLL_BOTTOM_OFFSET,
  Keyboard,
  NumberSizeableText,
  Page,
  Popover,
  ScrollView,
  SizableText,
  Skeleton,
  Spinner,
  Stack,
  XStack,
  YStack,
  resetToRoute,
  useIsOverlayPage,
  useMedia,
  usePopoverContext,
  useScrollContentTabBarOffset,
} from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { AccountSelectorProviderMirror } from '@onekeyhq/kit/src/components/AccountSelector';
import { AmountInput } from '@onekeyhq/kit/src/components/AmountInput';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { useDebounce } from '@onekeyhq/kit/src/hooks/useDebounce';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import {
  useSwapActions,
  useSwapFromTokenAmountAtom,
  useSwapQuoteActionLockAtom,
  useSwapQuoteEventCompletedAtom,
  useSwapQuoteEventErrorAtom,
  useSwapToTokenAmountAtom,
} from '@onekeyhq/kit/src/states/jotai/contexts/swap';
import { shouldRedirectOnboardingToTravelMode } from '@onekeyhq/kit/src/utils/onboardingEntryGate';
import { BaseMarketTokenPrice } from '@onekeyhq/kit/src/views/Market/components/MarketTokenPrice';
import { TokenList } from '@onekeyhq/kit/src/views/Market/MarketDetailV2/components/SwapPanel/components/TokenInputSection/TokenList';
import { TradeTypeSelector } from '@onekeyhq/kit/src/views/Market/MarketDetailV2/components/SwapPanel/components/TradeTypeSelector';
import { ESwapDirection } from '@onekeyhq/kit/src/views/Market/MarketDetailV2/components/SwapPanel/hooks/useTradeType';
import type { IToken } from '@onekeyhq/kit/src/views/Market/MarketDetailV2/components/SwapPanel/types';
import { resolveMarketStockId } from '@onekeyhq/kit/src/views/Market/MarketDetailV2/utils/resolveIsStockToken';
import {
  type EJotaiContextStoreNames,
  useInAppNotificationAtom,
} from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import {
  EModalRoutes,
  EOnboardingPages,
  EOnboardingPagesV2,
  EOnboardingV2Routes,
  ERootRoutes,
} from '@onekeyhq/shared/src/routes';
import { swrKeys } from '@onekeyhq/shared/src/utils/swrCacheUtils';
import { EAccountSelectorSceneName } from '@onekeyhq/shared/types';
import type { IMarketBasicConfigNetwork } from '@onekeyhq/shared/types/marketV2';
import {
  EProtocolOfExchange,
  ESwapDirectionType,
  ESwapTabSwitchType,
  type IFetchQuoteResult,
  type ISwapAlertState,
  type ISwapNetwork,
  type ISwapStockSpeedConfig,
  type ISwapStockTradeConfig,
  type ISwapToken,
  SwapAmountInputAccessoryViewID,
} from '@onekeyhq/shared/types/swap/types';

import { SwapRateDifferenceText } from '../../components/SwapRateDifferenceText';
import SwapRecentTokenPairsGroup from '../../components/SwapRecentTokenPairsGroup';
import { getTokenIdentityKey } from '../../hooks/swapStockChannelUtils';
import { useRefreshQuoteWhenStockMarketReopens } from '../../hooks/useRefreshQuoteWhenStockMarketReopens';
import { useSwapAddressInfo } from '../../hooks/useSwapAccount';
import { useShouldShowSwapLocalData } from '../../hooks/useSwapLocalDataVisibility';
import {
  ESwapStockChannelAsyncStatus,
  ESwapStockChannelStage,
  ESwapStockTradeSide,
  type IUseSwapStockChannelReturn,
} from '../../hooks/useSwapStockChannel';
import {
  useSwapStockAmountInputState,
  useSwapStockEstimatedReceiveState,
} from '../../hooks/useSwapStockTradeInputs';
import { SwapTestIDs } from '../../testIDs';
import { getSwapBalanceActionProps } from '../../utils/swapBalanceActionUtils';
import {
  SWAP_DESKTOP_CARD_SHADOW_NATIVE_STYLE,
  SWAP_DESKTOP_CARD_SHADOW_WEB_STYLE,
} from '../../utils/swapDesktopCardShadow';
import {
  type ISwapRecentTokenPair,
  buildSwapRecentTokenPairsFromHistory,
  getSwapMarketPendingHistoryKey,
} from '../../utils/swapMarketHistory';
import { calculateSwapStockEstimatedShares } from '../../utils/swapStockReviewUtils';
import {
  getStockQuoteTradeControl,
  isQuoteRequestForStockTrade,
} from '../../utils/swapStockTradeControl';

import SwapActionsState from './SwapActionsState';
import { SwapStockHeaderRightActionContainer } from './SwapHeaderRightActionContainer';
import SwapInputActions from './SwapInputActions';
import { PercentageStageOnKeyboard } from './SwapInputContainer';
import SwapPendingHistoryListComponent from './SwapPendingHistoryList';
import SwapQuoteResult from './SwapQuoteResult';
import {
  STOCK_DESKTOP_HEADER_SLOT_PROPS,
  getStockDisabledActionButtonProps,
  shouldDeferStockInitialContent,
  shouldResetStockTradeQuoteState,
  shouldShowStockQuoteActionLoading,
} from './SwapStockDesktopContainer.utils';
import {
  SwapStockMarketPanel,
  SwapStockMobileHeader,
  SwapStockVariantSelector,
} from './SwapStockMarketPanel';
import {
  SwapStockMarketProvider,
  useSwapStockSelection,
} from './SwapStockMarketProvider';
import { SwapStockPortfolioProvider } from './SwapStockPortfolio';
import {
  SwapStockPositions,
  SwapStockPositionsProvider,
} from './SwapStockPositions';
import { SwapStockTradeAlert } from './SwapStockTradeAlert';
import {
  isCurrentStockMarketClosedQuoteEventError,
  isCurrentStockQuoteEventError,
} from './SwapStockTradeAlertUtils';
import {
  SwapStockTradeProvider,
  useSwapStockTradeContext,
} from './SwapStockTradeProvider';
import SwapTipsContainer from './SwapTipsContainer';

import type { KeyboardAwareScrollViewRef } from 'react-native-keyboard-controller';

interface ISwapStockDesktopContainerProps {
  pageType?: EPageType;
  headerContent?: ReactNode;
  storeName: EJotaiContextStoreNames;
  onSelectToken: (type: ESwapDirectionType) => void;
  onTokenPress?: (token: ISwapToken) => void;
  supportNetworksList: (IMarketBasicConfigNetwork | ISwapNetwork)[];
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
  /** Keep the shared stock ticket while omitting Swap's page-level shell. */
  embedded?: boolean;
  stockSpeedConfig?: ISwapStockSpeedConfig;
  stockTradeConfig?: ISwapStockTradeConfig;
  stockTradeHeader?: ReactNode;
  stockTradeIdentityLoading?: boolean;
  stockTradeToken?: ISwapToken;
}

const STOCK_ESTIMATED_RECEIVE_PRIMARY_ROW_HEIGHT = 24;
const STOCK_ESTIMATED_RECEIVE_SECONDARY_ROW_HEIGHT = 20;
const STOCK_ESTIMATED_RECEIVE_CONTENT_HEIGHT =
  STOCK_ESTIMATED_RECEIVE_PRIMARY_ROW_HEIGHT +
  STOCK_ESTIMATED_RECEIVE_SECONDARY_ROW_HEIGHT;
const STOCK_TRADE_SIDE_SWITCH_WIDTH = 176;
const STOCK_DESKTOP_CONTENT_MAX_WIDTH = 1364;
const STOCK_RECENT_TOKEN_PAIR_SWAP_TYPES = [ESwapTabSwitchType.STOCK] as const;

function StockTradeSideSwitch({
  value,
  onChange,
}: {
  value: ESwapStockTradeSide;
  onChange: (value: ESwapStockTradeSide) => void;
}) {
  const tradeType =
    value === ESwapStockTradeSide.Sell
      ? ESwapDirection.SELL
      : ESwapDirection.BUY;
  const handleChange = useCallback(
    (nextValue: ESwapDirection | undefined) => {
      if (nextValue === ESwapDirection.BUY) {
        onChange(ESwapStockTradeSide.Buy);
      } else if (nextValue === ESwapDirection.SELL) {
        onChange(ESwapStockTradeSide.Sell);
      }
    },
    [onChange],
  );
  return (
    <XStack w={STOCK_TRADE_SIDE_SWITCH_WIDTH}>
      <TradeTypeSelector
        value={tradeType}
        onChange={handleChange}
        size="small"
        preventTextWrap
        buyTestID={SwapTestIDs.stockBuyTab}
        sellTestID={SwapTestIDs.stockSellTab}
      />
    </XStack>
  );
}

function StockEstimatedReceive({
  forceLoading,
  quoteResult,
  quoteLoading,
  quoteEventFetching,
  stockChannel,
  showEstimatedShares,
  stockTradeConfig,
}: {
  forceLoading?: boolean;
  quoteResult?: IFetchQuoteResult;
  quoteLoading: boolean;
  quoteEventFetching: boolean;
  stockChannel: IUseSwapStockChannelReturn;
  showEstimatedShares?: boolean;
  stockTradeConfig?: ISwapStockTradeConfig;
}) {
  const intl = useIntl();
  const [fromTokenAmount] = useSwapFromTokenAmountAtom();
  const [quoteEventError] = useSwapQuoteEventErrorAtom();
  const shouldHideQuoteResult = useMemo(() => {
    const hasStockQuoteControl = Boolean(
      getStockQuoteTradeControl({
        quoteResult,
        fromTokenAmount: fromTokenAmount.value,
        fromTokenSymbol: stockChannel.fromToken?.symbol,
        intl,
      }),
    );
    return (
      hasStockQuoteControl ||
      isCurrentStockQuoteEventError({
        fromToken: stockChannel.fromToken,
        fromTokenAmount: fromTokenAmount.value,
        quoteEventError,
        toToken: stockChannel.toToken,
      })
    );
  }, [
    fromTokenAmount.value,
    intl,
    quoteEventError,
    quoteResult,
    stockChannel.fromToken,
    stockChannel.toToken,
  ]);
  const receiveQuoteLoading = Boolean(
    forceLoading || quoteLoading || (quoteEventFetching && !quoteResult),
  );
  const {
    canSelectReceiveToken,
    currencySymbol,
    isLoading,
    isSellSide,
    isReceiveTokenPopoverOpen,
    onReceiveTokenPress,
    quoteMatchesStockTrade,
    rateDifference,
    receiveAmount,
    receiveFiatValue,
    receiveToken,
    setIsReceiveTokenPopoverOpen,
  } = useSwapStockEstimatedReceiveState({
    forceHideQuote: shouldHideQuoteResult || forceLoading,
    quoteEventFetching: false,
    quoteLoading: receiveQuoteLoading,
    quoteResult,
    stockChannel,
  });
  const receiveTokenSymbol = receiveToken?.symbol ?? '';
  const estimatedStockTokenAmount =
    stockChannel.tradeSide === ESwapStockTradeSide.Buy
      ? quoteResult?.toAmount
      : quoteResult?.fromAmount;
  const estimatedShares = calculateSwapStockEstimatedShares({
    stockTokenAmount: quoteMatchesStockTrade
      ? estimatedStockTokenAmount
      : undefined,
    tokenToAssetRatio:
      stockTradeConfig?.tokenToAssetRatio ??
      stockChannel.activeStockTokenDetail?.stock?.tokenToAssetRatio ??
      stockChannel.currentStockToken?.stock?.tokenToAssetRatio,
  });
  const stockUnderlyingSymbol =
    stockTradeConfig?.underlyingSymbol ??
    stockChannel.activeStockTokenDetail?.stock?.underlyingAssetTicker ??
    stockChannel.currentStockToken?.symbol ??
    '';
  const shouldShowEstimatedShares = Boolean(showEstimatedShares);
  const hasReceiveAmount = Boolean(receiveAmount && receiveTokenSymbol);
  const shouldShowReceiveToken = Boolean(
    hasReceiveAmount || (isSellSide && receiveTokenSymbol),
  );
  const labelText = intl.formatMessage({
    id:
      isSellSide && !hasReceiveAmount
        ? ETranslations.promode_limit_sell_for
        : ETranslations.private_send_estimated_received,
  });
  let estimatedSharesContent: ReactNode = (
    <SizableText size="$bodyMdMedium">--</SizableText>
  );
  if (isLoading) {
    estimatedSharesContent = <Skeleton h="$5" w="$20" />;
  } else if (estimatedShares) {
    estimatedSharesContent = (
      <XStack alignItems="center" justifyContent="flex-end" gap="$1">
        <NumberSizeableText
          size="$bodyMdMedium"
          formatter="balance"
          numberOfLines={1}
        >
          {estimatedShares}
        </NumberSizeableText>
        <SizableText size="$bodyMdMedium" numberOfLines={1}>
          {stockUnderlyingSymbol}
        </SizableText>
      </XStack>
    );
  }
  const receiveTokenDisplay = shouldShowReceiveToken ? (
    <XStack
      h={STOCK_ESTIMATED_RECEIVE_PRIMARY_ROW_HEIGHT}
      alignItems="center"
      justifyContent="flex-end"
      gap="$1"
      maxWidth="100%"
      minWidth={0}
      px="$1"
      py="$0.5"
      borderRadius="$2"
      {...(canSelectReceiveToken
        ? {
            onPress: () => setIsReceiveTokenPopoverOpen(true),
            hoverStyle: { bg: '$bgHover' },
            pressStyle: { bg: '$bgActive' },
            userSelect: 'none',
          }
        : undefined)}
    >
      <XStack
        alignItems="center"
        justifyContent="flex-end"
        gap="$1"
        maxWidth="100%"
        minWidth={0}
      >
        {hasReceiveAmount ? (
          <NumberSizeableText
            size="$bodyMdMedium"
            formatter="balance"
            numberOfLines={1}
            textAlign="right"
            flexShrink={0}
          >
            {receiveAmount}
          </NumberSizeableText>
        ) : null}
        <SizableText
          size="$bodyMdMedium"
          color="$text"
          numberOfLines={1}
          flexShrink={0}
        >
          {receiveTokenSymbol}
        </SizableText>
      </XStack>
      {canSelectReceiveToken ? (
        <Icon
          name="ChevronDownSmallOutline"
          size="$4"
          color="$iconSubdued"
          flexShrink={0}
        />
      ) : null}
    </XStack>
  ) : null;
  let receiveTokenContent: ReactNode = (
    <XStack
      h={STOCK_ESTIMATED_RECEIVE_PRIMARY_ROW_HEIGHT}
      alignItems="center"
      justifyContent="flex-end"
    >
      <SizableText
        size="$bodyMdMedium"
        color="$text"
        numberOfLines={1}
        textAlign="right"
      >
        --
      </SizableText>
    </XStack>
  );
  if (shouldShowReceiveToken) {
    receiveTokenContent = canSelectReceiveToken ? (
      <Popover
        floatingPanelProps={{
          width: 288,
        }}
        title={intl.formatMessage({
          id: ETranslations.dexmarket_select_token,
        })}
        open={isReceiveTokenPopoverOpen}
        onOpenChange={setIsReceiveTokenPopoverOpen}
        renderTrigger={receiveTokenDisplay}
        renderContent={
          <StockPayTokenPopoverContent
            tokens={stockChannel.payTokens}
            currentSelectToken={stockChannel.payToken}
            disableNativeToken={false}
            disableCurrentToken={false}
            onTokenPress={onReceiveTokenPress}
          />
        }
      />
    ) : (
      receiveTokenDisplay
    );
  }

  return (
    <YStack gap="$4">
      <XStack
        testID={SwapTestIDs.stockEstimatedReceive}
        h={stockTradeConfig ? 40 : 48}
        alignItems="center"
        justifyContent="space-between"
        gap="$2"
      >
        <XStack alignItems="center" gap="$1" flexShrink={0} h="$5">
          {stockTradeConfig ? null : (
            <Icon name="HandCoinsOutline" size="$4.5" color="$iconSubdued" />
          )}
          <SizableText size="$bodyMd" color="$text">
            {labelText}
          </SizableText>
        </XStack>
        <YStack
          h={STOCK_ESTIMATED_RECEIVE_CONTENT_HEIGHT}
          flex={1}
          maxWidth={360}
          alignItems="flex-end"
          minWidth={0}
        >
          {isLoading ? (
            <>
              <XStack
                h={STOCK_ESTIMATED_RECEIVE_PRIMARY_ROW_HEIGHT}
                alignItems="center"
                justifyContent="flex-end"
              >
                <Skeleton h="$5" w="$20" />
              </XStack>
              <XStack
                h={STOCK_ESTIMATED_RECEIVE_SECONDARY_ROW_HEIGHT}
                alignItems="center"
                justifyContent="flex-end"
              >
                <Skeleton h="$5" w="$16" />
              </XStack>
            </>
          ) : (
            <>
              {receiveTokenContent}
              <XStack
                h={STOCK_ESTIMATED_RECEIVE_SECONDARY_ROW_HEIGHT}
                alignItems="center"
                justifyContent="flex-end"
                gap="$1"
                pr="$1"
              >
                <NumberSizeableText
                  size="$bodyMd"
                  color="$textSubdued"
                  formatter="value"
                  formatterOptions={{
                    currency: currencySymbol,
                  }}
                  numberOfLines={1}
                >
                  {receiveFiatValue || '0'}
                </NumberSizeableText>
                <SwapRateDifferenceText
                  loading={isLoading}
                  rateDifference={rateDifference}
                  size="$bodyMd"
                />
              </XStack>
            </>
          )}
        </YStack>
      </XStack>
      {shouldShowEstimatedShares ? (
        <XStack
          testID="stock-trade-estimated-shares"
          minHeight={40}
          alignItems="center"
          justifyContent="space-between"
          gap="$2"
        >
          <SizableText size="$bodyMd">
            {intl.formatMessage({ id: ETranslations.market_est_shares })}
          </SizableText>
          {estimatedSharesContent}
        </XStack>
      ) : null}
    </YStack>
  );
}

function StockActionGate({
  alerts,
  balanceActionsReady,
  stockChannel,
  stockTradeIdentityLoading,
  onPreSwap,
  onToAnotherAddressModal,
  onSelectPercentageStage,
}: {
  alerts: ISwapStockDesktopContainerProps['alerts'];
  balanceActionsReady: boolean;
  stockChannel: IUseSwapStockChannelReturn;
  stockTradeIdentityLoading?: boolean;
  onPreSwap: () => void;
  onToAnotherAddressModal: () => void;
  onSelectPercentageStage: (stage: number) => void;
}) {
  const stockSelection = useSwapStockSelection();
  const intl = useIntl();
  const navigation = useAppNavigation();
  const isModalPage = useIsOverlayPage();
  const { md } = useMedia();
  const swapFromAddressInfo = useSwapAddressInfo(ESwapDirectionType.FROM);
  const swapToAddressInfo = useSwapAddressInfo(ESwapDirectionType.TO);
  const [fromTokenAmount] = useSwapFromTokenAmountAtom();
  const [quoteActionLock] = useSwapQuoteActionLockAtom();
  const [quoteEventCompleted] = useSwapQuoteEventCompletedAtom();
  const accountInfo = swapFromAddressInfo.accountInfo;
  const isDesktopModalPage = isModalPage && !md;
  const isWebDappModeWithNoWallet = Boolean(
    platformEnv.isWebDappMode &&
    accountInfo &&
    !accountInfo.wallet &&
    !accountInfo.accountName,
  );
  const shouldShowConnectWalletAction =
    alerts.states.some((item) => item.noConnectWallet) ||
    isWebDappModeWithNoWallet ||
    Boolean(accountInfo?.ready && !accountInfo.wallet);
  const handleConnectWalletPress = useCallback(() => {
    if (platformEnv.isWebDappMode) {
      navigation.pushModal(EModalRoutes.OnboardingModal, {
        screen: EOnboardingPages.ConnectWalletOptions,
      });
      return;
    }
    resetToRoute(ERootRoutes.Onboarding, {
      screen: EOnboardingV2Routes.OnboardingV2,
      params: {
        screen: EOnboardingPagesV2.GetStarted,
      },
    });
  }, [navigation]);
  const keyboardPercentageStage = useMemo(
    () =>
      !platformEnv.isNativeIOS && balanceActionsReady ? (
        <PercentageStageOnKeyboard
          onSelectPercentageStage={onSelectPercentageStage}
        />
      ) : null,
    [balanceActionsReady, onSelectPercentageStage],
  );
  const renderActionButton = useCallback(
    (button: ReactNode) => {
      if (!isDesktopModalPage) {
        return (
          <>
            {button}
            {keyboardPercentageStage}
          </>
        );
      }

      return (
        <Page.Footer>
          <Stack p="$5" bg="$bgApp">
            <XStack width="100%" justifyContent="flex-end">
              {button}
            </XStack>
          </Stack>
          {keyboardPercentageStage}
        </Page.Footer>
      );
    },
    [isDesktopModalPage, keyboardPercentageStage],
  );
  const isStockChannelInitializing =
    stockChannel.stockTokenStatus ===
      ESwapStockChannelAsyncStatus.Initializing ||
    stockChannel.payTokenStatus === ESwapStockChannelAsyncStatus.Initializing ||
    stockChannel.channelStage === ESwapStockChannelStage.CheckingMarketStatus;
  const hasPositiveInputAmount = new BigNumber(fromTokenAmount.value).gt(0);
  const forceQuoteActionLoading = Boolean(
    hasPositiveInputAmount &&
    (stockTradeIdentityLoading ||
      shouldShowStockQuoteActionLoading({
        inputAmount: fromTokenAmount.value,
        quoteEventCompleted,
        quoteRequestMatchesStockTrade: isQuoteRequestForStockTrade({
          currentAccountId: swapFromAddressInfo.accountInfo?.account?.id,
          currentAddress: swapFromAddressInfo.address,
          currentReceivingAddress: swapToAddressInfo.address,
          quoteRequest: quoteActionLock,
          receiveToken: stockChannel.toToken,
          sendAmount: fromTokenAmount.value,
          sendToken: stockChannel.fromToken,
        }),
      })),
  );
  // Keep the action subtree mounted after the first ready state. A Stock
  // variant switch temporarily reinitializes its network-scoped pay token;
  // unmounting here would replay the recipient reveal animation.
  const hasRenderedStockActionsStateRef = useRef(false);
  if (stockChannel.readyForQuote) {
    hasRenderedStockActionsStateRef.current = true;
  }
  const shouldPreserveStockActionsState = Boolean(
    hasRenderedStockActionsStateRef.current &&
    (stockSelection?.availability === 'pending' ||
      stockTradeIdentityLoading ||
      isStockChannelInitializing),
  );
  const disabledLabel = useMemo(() => {
    switch (stockChannel.channelStage) {
      case ESwapStockChannelStage.MissingStock:
        return intl.formatMessage({
          id: ETranslations.swap_page_button_select_token,
        });
      case ESwapStockChannelStage.MissingPayToken:
      case ESwapStockChannelStage.MarketUnavailable:
        return intl.formatMessage({
          id: ETranslations.swap_page_alert_no_provider_supports_trade,
        });
      default:
        return intl.formatMessage({
          id: ETranslations.swap_page_button_enter_amount,
        });
    }
  }, [intl, stockChannel.channelStage]);

  if (shouldShowConnectWalletAction) {
    return renderActionButton(
      <Button
        testID={SwapTestIDs.swapButton}
        onPress={handleConnectWalletPress}
        disabled={shouldRedirectOnboardingToTravelMode()}
        size={isDesktopModalPage ? 'medium' : 'large'}
        variant="primary"
        borderRadius="$full"
      >
        {intl.formatMessage({
          id: ETranslations.global_connect_wallet,
        })}
      </Button>,
    );
  }

  if (
    stockSelection?.availability === 'unavailable' ||
    stockSelection?.availability === 'error'
  ) {
    return renderActionButton(
      <Button
        testID={SwapTestIDs.swapButton}
        size={isDesktopModalPage ? 'medium' : 'large'}
        variant="primary"
        disabled
        borderRadius="$full"
      >
        {intl.formatMessage({
          id:
            stockSelection.availability === 'error'
              ? ETranslations.global_unknown_error_retry_message
              : ETranslations.swap_page_alert_no_provider_supports_trade,
        })}
      </Button>,
    );
  }

  if (
    !shouldPreserveStockActionsState &&
    (stockSelection?.availability === 'pending' ||
      stockTradeIdentityLoading ||
      isStockChannelInitializing)
  ) {
    return renderActionButton(
      <Button
        testID={SwapTestIDs.swapButton}
        size={isDesktopModalPage ? 'medium' : 'large'}
        variant="primary"
        disabled
        borderRadius="$full"
        childrenAsText={!hasPositiveInputAmount}
      >
        {hasPositiveInputAmount ? (
          <Spinner
            h="$6"
            alignItems="center"
            justifyContent="center"
            size="small"
            color="$iconInverse"
          />
        ) : (
          intl.formatMessage({
            id: ETranslations.swap_page_button_enter_amount,
          })
        )}
      </Button>,
    );
  }

  if (stockChannel.readyForQuote || shouldPreserveStockActionsState) {
    return (
      <SwapActionsState
        disabled={stockTradeIdentityLoading || !stockChannel.readyForQuote}
        forceQuoteActionLoading={
          forceQuoteActionLoading ||
          (hasPositiveInputAmount && shouldPreserveStockActionsState)
        }
        onPreSwap={onPreSwap}
        onOpenRecipientAddress={onToAnotherAddressModal}
        onSelectPercentageStage={
          balanceActionsReady ? onSelectPercentageStage : undefined
        }
      />
    );
  }

  const disabledButtonProps = getStockDisabledActionButtonProps(
    stockChannel.tradeSide,
    stockChannel.channelStage,
  );

  return renderActionButton(
    <Button
      testID={SwapTestIDs.swapButton}
      size={isDesktopModalPage ? 'medium' : 'large'}
      variant="primary"
      disabled
      borderRadius="$full"
      {...disabledButtonProps}
    >
      {disabledLabel}
    </Button>,
  );
}

function StockPayTokenPopoverContent({
  tokens,
  currentSelectToken,
  disableNativeToken,
  disableCurrentToken = true,
  onTokenPress,
}: {
  tokens: IToken[];
  currentSelectToken?: ISwapToken;
  disableNativeToken?: boolean;
  disableCurrentToken?: boolean;
  onTokenPress: (token: IToken) => void;
}) {
  const { closePopover } = usePopoverContext();
  return (
    <AccountSelectorProviderMirror
      config={{
        sceneName: EAccountSelectorSceneName.swap,
        sceneUrl: '',
      }}
      enabledNum={[0]}
    >
      <TokenList
        currentSelectToken={
          disableCurrentToken ? currentSelectToken : undefined
        }
        tokens={tokens}
        onTokenPress={(token) => {
          onTokenPress(token);
          void closePopover?.();
        }}
        onTradePress={() => {
          void closePopover?.();
        }}
        disabledOnSwitchToTrade
        disableNativeToken={disableNativeToken}
        disableInternalTokenDetailFetch
        sortTokensByValue={false}
      />
    </AccountSelectorProviderMirror>
  );
}

function StockTradeHeaderSkeleton({
  stockTokenPrice,
}: {
  stockTokenPrice?: string;
}) {
  return (
    <XStack
      testID={SwapTestIDs.stockTradeHeaderSkeleton}
      height={44}
      px="$1"
      alignItems="center"
      justifyContent="space-between"
      gap="$2"
    >
      <XStack alignItems="center" gap="$2">
        <Skeleton w="$8" h="$8" radius="round" />
        <YStack gap="$1">
          <Skeleton h="$5" w="$20" />
          <Skeleton h="$4" w="$16" />
        </YStack>
      </XStack>
      {stockTokenPrice ? (
        <Button
          testID="stock-token-info-trigger-disabled"
          iconAfter="InfoCircleOutline"
          size="small"
          variant="tertiary"
          childrenAsText={false}
          disabled
        >
          <BaseMarketTokenPrice
            price={stockTokenPrice}
            tokenName=""
            tokenSymbol=""
            currency="$"
            size="$bodyLgMedium"
          />
        </Button>
      ) : (
        <Skeleton h="$5" w="$16" />
      )}
    </XStack>
  );
}

function StockAmountInput({
  fetchLoading,
  amountInputState,
  deferInitialContent,
  forceLoading,
}: Pick<ISwapStockDesktopContainerProps, 'fetchLoading' | 'storeName'> & {
  amountInputState: ReturnType<typeof useSwapStockAmountInputState>;
  deferInitialContent: boolean;
  forceLoading?: boolean;
}) {
  const height = useSwapStockSelection() ? 114 : 124;
  const intl = useIntl();
  const [, setInAppNotification] = useInAppNotificationAtom();
  const {
    amountFiatValue,
    balanceActionsReady,
    balanceLoading,
    balanceRefreshing,
    currencySymbol,
    disableNativePayToken,
    displayBalance,
    hasBalanceError,
    inputToken,
    inputTokenNetworkLogoURI,
    inputValue,
    isBalanceLoadedZero,
    isBuySide,
    onAmountChange,
    onBalanceMaxPress,
    onBalanceRefreshPress,
    onSelectPercentageStage,
    payToken,
    payTokenOptionsLoading,
    payTokens,
    selectablePayTokens,
    selectPayToken,
    shouldRenderSkeleton,
  } = amountInputState;
  const canOpenBuyPayTokenSelector =
    isBuySide && selectablePayTokens.length > 1;
  const swapFromAddressInfo = useSwapAddressInfo(ESwapDirectionType.FROM);
  const [percentageInputStageShow, setPercentageInputStageShow] =
    useState(false);
  const handleAmountInputFocus = useCallback(() => {
    setPercentageInputStageShow(true);
    setInAppNotification((value) => ({
      ...value,
      swapPercentageInputStageShowForNative: true,
    }));
  }, [setInAppNotification]);
  const handleAmountInputBlur = useCallback(() => {
    setInAppNotification((value) => ({
      ...value,
      swapPercentageInputStageShowForNative: false,
    }));
    setTimeout(() => {
      setPercentageInputStageShow(false);
    }, 200);
  }, [setInAppNotification]);
  const showPercentageInput = useMemo(
    () => Boolean(inputToken && (percentageInputStageShow || inputValue)),
    [inputToken, inputValue, percentageInputStageShow],
  );
  const showPercentageInputDebounce = useDebounce(showPercentageInput, 100, {
    leading: true,
  });
  const showActionBuy = useMemo(
    () =>
      isBuySide &&
      Boolean(
        swapFromAddressInfo.accountInfo?.account?.id &&
        inputToken &&
        hasBalanceError,
      ),
    [
      hasBalanceError,
      inputToken,
      isBuySide,
      swapFromAddressInfo.accountInfo?.account?.id,
    ],
  );
  const showTokenSelectorLoading =
    !inputToken && (fetchLoading || (isBuySide && payTokenOptionsLoading));
  const balanceActionProps = getSwapBalanceActionProps({
    isLoadedZero: isBalanceLoadedZero,
    refreshing: balanceRefreshing,
    onRefresh: onBalanceRefreshPress,
    onMax: balanceActionsReady ? onBalanceMaxPress : undefined,
  });

  const contentLoading = Boolean(
    forceLoading || shouldRenderSkeleton || deferInitialContent,
  );

  return (
    <YStack
      testID={contentLoading ? SwapTestIDs.stockAmountInputSkeleton : undefined}
      h={height}
      bg="$bgSubdued"
      borderRadius="$4"
      overflow="hidden"
    >
      <XStack
        pt="$3.5"
        px="$3.5"
        alignItems="center"
        justifyContent="space-between"
      >
        <SizableText size="$bodyMd" color="$textSubdued">
          {intl.formatMessage({
            id: isBuySide
              ? ETranslations.global_pay
              : ETranslations.global_sell,
          })}
        </SizableText>
        <SwapInputActions
          fromToken={inputToken}
          accountInfo={
            swapFromAddressInfo.isAddressInfoReady
              ? swapFromAddressInfo.accountInfo
              : undefined
          }
          activeAccount={swapFromAddressInfo.activeAccount}
          onDepositClose={onBalanceRefreshPress}
          showPercentageInput={Boolean(
            showPercentageInputDebounce &&
            balanceActionsReady &&
            !contentLoading,
          )}
          showActionBuy={showActionBuy && !contentLoading}
          actionBuyHighlighted={!isBalanceLoadedZero}
          onSelectStage={onSelectPercentageStage}
        />
      </XStack>
      <AmountInput
        value={inputValue}
        onChange={onAmountChange}
        hasError={hasBalanceError}
        bg="$transparent"
        borderWidth={0}
        borderRadius="$0"
        flex={1}
        valueProps={{
          loading: contentLoading,
          value: amountFiatValue,
          currency: currencySymbol,
        }}
        balanceProps={{
          value: inputToken ? displayBalance : undefined,
          loading: contentLoading || balanceLoading,
          hideIcon: true,
          tokenSymbol: inputToken?.symbol,
          ...(contentLoading ? undefined : balanceActionProps),
        }}
        maxAmountText={intl.formatMessage({ id: ETranslations.global_max })}
        inputProps={{
          loading: contentLoading,
          placeholder: '0.0',
          inputAccessoryViewID:
            platformEnv.isNativeIOS && balanceActionsReady && !contentLoading
              ? SwapAmountInputAccessoryViewID
              : undefined,
          onFocus: handleAmountInputFocus,
          onBlur: handleAmountInputBlur,
          testID: SwapTestIDs.fromAmountInput,
        }}
        tokenSelectorTriggerProps={{
          testID: SwapTestIDs.fromTokenSelector,
          m: '$1.5',
          mb: '$0',
          p: '$2',
          borderRadius: '$2',
          minWidth: 132,
          justifyContent: 'flex-end',
          loading: contentLoading || showTokenSelectorLoading,
          selectedTokenImageUri: inputToken?.logoURI,
          selectedNetworkImageUri: inputTokenNetworkLogoURI,
          selectedTokenSymbol: inputToken?.symbol,
          showNetworkIconBorder: false,
          disabled: contentLoading || !canOpenBuyPayTokenSelector,
          popover:
            !contentLoading &&
            canOpenBuyPayTokenSelector &&
            payTokens.length > 1
              ? {
                  title: intl.formatMessage({
                    id: ETranslations.dexmarket_select_token,
                  }),
                  content: (
                    <StockPayTokenPopoverContent
                      tokens={payTokens}
                      currentSelectToken={payToken}
                      disableNativeToken={
                        isBuySide ? disableNativePayToken : false
                      }
                      onTokenPress={selectPayToken}
                    />
                  ),
                }
              : undefined,
        }}
        enableMaxAmount={Boolean(inputToken) && !contentLoading}
      />
      {platformEnv.isNativeIOS && balanceActionsReady && !contentLoading ? (
        <InputAccessoryView nativeID={SwapAmountInputAccessoryViewID}>
          <PercentageStageOnKeyboard
            onSelectPercentageStage={onSelectPercentageStage}
          />
        </InputAccessoryView>
      ) : null}
    </YStack>
  );
}

function StockTradeTicket({
  fetchLoading,
  storeName,
  onPreSwap,
  onToAnotherAddressModal,
  onOpenProviderList,
  refreshAction,
  quoteResult,
  quoteLoading,
  quoteEventFetching,
  alerts,
  stockChannel,
  tradeSide,
  onTradeSideChange,
  recentTokenPairs,
  onSelectRecentTokenPairs,
  compact,
  showTradeSideSwitch = true,
  stockTradeConfig,
  stockTradeHeader,
  stockTradeIdentityLoading,
}: Omit<
  ISwapStockDesktopContainerProps,
  'headerContent' | 'supportNetworksList'
> & {
  stockChannel: IUseSwapStockChannelReturn;
  tradeSide: ESwapStockTradeSide;
  onTradeSideChange: (value: ESwapStockTradeSide) => void;
  recentTokenPairs: ISwapRecentTokenPair[];
  onSelectRecentTokenPairs: (params: ISwapRecentTokenPair) => void;
  compact?: boolean;
  showTradeSideSwitch?: boolean;
  stockTradeConfig?: ISwapStockTradeConfig;
  stockTradeHeader?: ReactNode;
  stockTradeIdentityLoading?: boolean;
}) {
  const standaloneSelection = useSwapStockSelection();
  const amountInputState = useSwapStockAmountInputState({ stockChannel });
  const startedWithoutAmountInputRef = useRef(!amountInputState.inputToken);
  const deferInitialAmountContent = shouldDeferStockInitialContent({
    channelStage: stockChannel.channelStage,
    startedWithoutContent: startedWithoutAmountInputRef.current,
  });
  if (!deferInitialAmountContent) startedWithoutAmountInputRef.current = false;
  const showStockTradeIdentitySkeleton = Boolean(
    standaloneSelection?.loadingScopes.amountInput ||
    stockTradeIdentityLoading ||
    amountInputState.shouldRenderSkeleton ||
    deferInitialAmountContent,
  );
  const showEstimatedReceiveSkeleton = Boolean(
    standaloneSelection?.loadingScopes.stock ||
    stockTradeIdentityLoading ||
    deferInitialAmountContent,
  );
  let resolvedStockTradeHeader = stockTradeHeader;
  if (
    stockTradeHeader &&
    showStockTradeIdentitySkeleton &&
    (!standaloneSelection || standaloneSelection.stockSelectionPending)
  ) {
    const targetStock =
      standaloneSelection?.pendingStock ??
      standaloneSelection?.selectedStockPreview;
    const currentStockId = resolveMarketStockId(
      stockChannel.currentStockToken ?? {},
    );
    const stockTokenPrice =
      targetStock?.stockId.toUpperCase() === currentStockId?.toUpperCase()
        ? stockChannel.currentStockToken?.price
        : undefined;
    resolvedStockTradeHeader = (
      <StockTradeHeaderSkeleton stockTokenPrice={stockTokenPrice} />
    );
  }
  const isModalPage = useIsOverlayPage();
  const { md } = useMedia();
  // The desktop modal action renders through Page.Footer. Keep its portal
  // placeholder outside this gapped stack so channel readiness cannot add an
  // empty gap above Recent Trades.
  const renderActionGateOutsideTicket = isModalPage && !md;
  const [quoteEventError] = useSwapQuoteEventErrorAtom();
  const hasPositiveInputAmount = new BigNumber(
    amountInputState.inputValue || 0,
  ).gt(0);
  const isCurrentQuoteMarketClosed = isCurrentStockMarketClosedQuoteEventError({
    fromToken: stockChannel.fromToken,
    fromTokenAmount: amountInputState.inputValue,
    quoteEventError,
    toToken: stockChannel.toToken,
  });
  const quoteScopeKey = [
    getTokenIdentityKey(stockChannel.fromToken),
    getTokenIdentityKey(stockChannel.toToken),
    amountInputState.inputValue,
  ].join('|');
  useRefreshQuoteWhenStockMarketReopens({
    enabled: stockChannel.readyForQuote && hasPositiveInputAmount,
    // The normalized status stays open while detail is unavailable so quote
    // execution can continue; reopen detection needs the raw tri-state value.
    marketIsOpen: stockChannel.activeStockTokenDetail?.stock?.isOpen,
    onRefresh: refreshAction,
    quoteMarketClosed: isCurrentQuoteMarketClosed,
    scopeKey: quoteScopeKey,
  });
  const stockActionGate = (
    <StockActionGate
      alerts={alerts}
      balanceActionsReady={amountInputState.balanceActionsReady}
      stockChannel={stockChannel}
      stockTradeIdentityLoading={showStockTradeIdentitySkeleton}
      onPreSwap={onPreSwap}
      onToAnotherAddressModal={onToAnotherAddressModal}
      onSelectPercentageStage={amountInputState.onSelectPercentageStage}
    />
  );

  return (
    <>
      <YStack gap={compact ? '$3' : '$4'}>
        {showTradeSideSwitch ? (
          <StockTradeSideSwitch
            value={tradeSide}
            onChange={onTradeSideChange}
          />
        ) : null}
        {resolvedStockTradeHeader}
        <StockAmountInput
          fetchLoading={fetchLoading}
          amountInputState={amountInputState}
          deferInitialContent={deferInitialAmountContent}
          forceLoading={showStockTradeIdentitySkeleton}
          storeName={storeName}
        />
        <StockEstimatedReceive
          forceLoading={showEstimatedReceiveSkeleton}
          quoteResult={quoteResult}
          quoteLoading={quoteLoading}
          quoteEventFetching={quoteEventFetching}
          stockChannel={stockChannel}
          showEstimatedShares={Boolean(stockTradeConfig)}
          stockTradeConfig={stockTradeConfig}
        />
        {renderActionGateOutsideTicket ? null : stockActionGate}
        {showStockTradeIdentitySkeleton ? null : (
          <SwapStockTradeAlert
            alerts={alerts}
            quoteEventFetching={quoteEventFetching}
            quoteLoading={quoteLoading}
            quoteResult={quoteResult}
            stockChannel={stockChannel}
            // px of the hosting YStack gap above: "$3" = 12, "$4" = 16
            parentGap={compact ? 12 : 16}
          />
        )}
        {stockChannel.readyForQuote && !showStockTradeIdentitySkeleton ? (
          <SwapQuoteResult
            refreshAction={refreshAction}
            onOpenProviderList={onOpenProviderList}
            quoteResult={quoteResult}
          />
        ) : null}
        {showTradeSideSwitch && !stockTradeHeader ? (
          <SwapRecentTokenPairsGroup
            onSelectTokenPairs={onSelectRecentTokenPairs}
            tokenPairs={recentTokenPairs}
            fromTokenAmount={amountInputState.inputValue}
            visibleSwapTypes={STOCK_RECENT_TOKEN_PAIR_SWAP_TYPES}
          />
        ) : null}
      </YStack>
      {renderActionGateOutsideTicket ? stockActionGate : null}
    </>
  );
}

function useSwapStockRecentTokenPairs() {
  const [{ swapHistoryPendingList }] = useInAppNotificationAtom();
  const shouldShowSwapLocalData = useShouldShowSwapLocalData();
  const stockPendingKey = useMemo(
    () =>
      getSwapMarketPendingHistoryKey(
        swapHistoryPendingList,
        EProtocolOfExchange.STOCK,
      ),
    [swapHistoryPendingList],
  );
  const { result: swapTxHistoryList } = usePromiseResult(
    async () => {
      if (!shouldShowSwapLocalData) {
        return [];
      }
      const histories =
        await backgroundApiProxy.serviceSwap.fetchSwapHistoryListFromSimple();
      return histories;
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [stockPendingKey, shouldShowSwapLocalData],
    {
      // Share the persisted history snapshot used by ordinary Swap. Stock can
      // derive its own protocol-filtered pairs synchronously on every remount,
      // then refresh the full history list in the background.
      swrKey: shouldShowSwapLocalData
        ? swrKeys.swapHistoryPreviewList()
        : undefined,
    },
  );

  return useMemo(() => {
    if (!shouldShowSwapLocalData) {
      return [];
    }
    return buildSwapRecentTokenPairsFromHistory({
      items: swapTxHistoryList ?? [],
      protocol: EProtocolOfExchange.STOCK,
    });
  }, [shouldShowSwapLocalData, swapTxHistoryList]);
}

function SwapStockDesktopContent({
  pageType,
  headerContent,
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
  alerts,
  supportNetworksList,
  embedded,
  stockTradeConfig,
  stockTradeHeader,
  stockTradeIdentityLoading,
}: ISwapStockDesktopContainerProps) {
  const [, setFromTokenAmount] = useSwapFromTokenAmountAtom();
  const [, setToTokenAmount] = useSwapToTokenAmountAtom();
  const { resetQuoteAction } = useSwapActions().current;
  const previousStockTradeIdentityLoadingRef = useRef(false);
  const stockChannel = useSwapStockTradeContext();
  const stockRecentTokenPairs = useSwapStockRecentTokenPairs();
  useEffect(() => {
    const identityLoading = Boolean(stockTradeIdentityLoading);
    const shouldResetQuoteState = shouldResetStockTradeQuoteState({
      identityLoading,
      previousIdentityLoading: previousStockTradeIdentityLoadingRef.current,
    });
    previousStockTradeIdentityLoadingRef.current = identityLoading;
    if (!shouldResetQuoteState) {
      return;
    }
    setToTokenAmount({ value: '', isInput: false });
    void resetQuoteAction();
  }, [resetQuoteAction, setToTokenAmount, stockTradeIdentityLoading]);
  let contentTopPadding: '$0' | '$5' | undefined;
  if (embedded) {
    contentTopPadding = '$0';
  } else if (!headerContent) {
    contentTopPadding = '$5';
  }

  const handleTradeSideChange = useCallback(
    (nextTradeSide: ESwapStockTradeSide) => {
      if (nextTradeSide === stockChannel.tradeSide) {
        return;
      }
      setFromTokenAmount({ value: '', isInput: false });
      setToTokenAmount({ value: '', isInput: false });
      void stockChannel.switchTradeSide(nextTradeSide);
    },
    [setFromTokenAmount, setToTokenAmount, stockChannel],
  );

  const handleSelectRecentStockTokenPairs = useCallback(
    ({ fromToken, toToken }: ISwapRecentTokenPair) => {
      void stockChannel.selectRecentTokenPair({ fromToken, toToken });
    },
    [stockChannel],
  );

  const ticket = (
    <YStack
      testID="swap-stock-trade-card"
      width="100%"
      minWidth={0}
      p={embedded ? '$0' : '$8'}
      borderWidth={embedded ? 0 : 1}
      borderColor="$borderSubdued"
      borderRadius={embedded ? '$0' : '$5'}
      bg="$bgApp"
      gap="$4"
      elevationAndroid={embedded ? undefined : '$1'}
      $platform-web={embedded ? undefined : SWAP_DESKTOP_CARD_SHADOW_WEB_STYLE}
      style={embedded ? undefined : SWAP_DESKTOP_CARD_SHADOW_NATIVE_STYLE}
    >
      <XStack alignItems="center" justifyContent="space-between">
        <StockTradeSideSwitch
          value={stockChannel.tradeSide}
          onChange={handleTradeSideChange}
        />
        <SwapStockHeaderRightActionContainer storeName={storeName} />
      </XStack>
      <StockTradeTicket
        onSelectToken={onSelectToken}
        fetchLoading={fetchLoading}
        storeName={storeName}
        onSelectPercentageStage={onSelectPercentageStage}
        onBalanceMaxPress={onBalanceMaxPress}
        onPreSwap={onPreSwap}
        onToAnotherAddressModal={onToAnotherAddressModal}
        onOpenProviderList={onOpenProviderList}
        refreshAction={refreshAction}
        quoteResult={quoteResult}
        quoteLoading={quoteLoading}
        quoteEventFetching={quoteEventFetching}
        alerts={alerts}
        stockChannel={stockChannel}
        tradeSide={stockChannel.tradeSide}
        onTradeSideChange={handleTradeSideChange}
        recentTokenPairs={stockRecentTokenPairs}
        onSelectRecentTokenPairs={handleSelectRecentStockTokenPairs}
        showTradeSideSwitch={false}
        stockTradeConfig={stockTradeConfig}
        stockTradeHeader={
          embedded ? stockTradeHeader : <SwapStockVariantSelector />
        }
        stockTradeIdentityLoading={stockTradeIdentityLoading}
      />
      {embedded ? null : (
        <SwapPendingHistoryListComponent
          storeName={storeName}
          protocol={EProtocolOfExchange.STOCK}
        />
      )}
    </YStack>
  );
  return (
    <ScrollView flex={1} contentContainerStyle={{ flexGrow: 1 }}>
      {embedded ? null : <SwapTipsContainer pageType={pageType} />}
      <YStack width="100%" alignItems="center" pb="$5" pt={contentTopPadding}>
        {!embedded && headerContent ? (
          <YStack {...STOCK_DESKTOP_HEADER_SLOT_PROPS}>{headerContent}</YStack>
        ) : null}
        {embedded ? (
          <YStack width="100%" px="$5">
            {ticket}
          </YStack>
        ) : (
          <XStack
            testID="swap-stock-desktop-layout"
            width="100%"
            maxWidth={STOCK_DESKTOP_CONTENT_MAX_WIDTH}
            px="$8"
            pt="$5"
            gap="$4"
            alignItems="flex-start"
          >
            <SwapStockMarketPanel />
            <YStack width={408} flexShrink={0} gap="$4">
              {ticket}
              <SwapStockPositions networks={supportNetworksList} />
            </YStack>
          </XStack>
        )}
      </YStack>
    </ScrollView>
  );
}

export function SwapStockDesktopContainer(
  props: ISwapStockDesktopContainerProps,
) {
  const { stockSpeedConfig, stockTradeToken } = props;
  return (
    <SwapStockTradeProvider
      stockSpeedConfig={stockSpeedConfig}
      stockTradeToken={stockTradeToken}
    >
      <SwapStockPageProviders {...props}>
        <SwapStockDesktopContent {...props} />
      </SwapStockPageProviders>
    </SwapStockTradeProvider>
  );
}

function SwapStockMobileContent(props: ISwapStockDesktopContainerProps) {
  const {
    embedded,
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
    alerts,
    supportNetworksList,
    stockTradeConfig,
    stockTradeHeader,
  } = props;
  const tabBarHeight = useScrollContentTabBarOffset();
  const scrollViewRef = useRef<KeyboardAwareScrollViewRef>(null);
  const bottomOffset = KEYBOARD_AWARE_SCROLL_BOTTOM_OFFSET + 60;
  const [, setFromTokenAmount] = useSwapFromTokenAmountAtom();
  const [, setToTokenAmount] = useSwapToTokenAmountAtom();
  const stockChannel = useSwapStockTradeContext();
  const stockRecentTokenPairs = useSwapStockRecentTokenPairs();
  // The desktop trade modal reuses this mobile content; positions/order-history
  // don't belong in that compact modal, so hide them there (native/web tabs keep
  // them).
  const isDesktopModalPage = useIsOverlayPage() && !platformEnv.isNative;

  const handleTradeSideChange = useCallback(
    (nextTradeSide: ESwapStockTradeSide) => {
      if (nextTradeSide === stockChannel.tradeSide) {
        return;
      }
      setFromTokenAmount({ value: '', isInput: false });
      setToTokenAmount({ value: '', isInput: false });
      void stockChannel.switchTradeSide(nextTradeSide);
    },
    [setFromTokenAmount, setToTokenAmount, stockChannel],
  );
  const handleSelectRecentStockTokenPairs = useCallback(
    ({ fromToken, toToken }: ISwapRecentTokenPair) => {
      void stockChannel.selectRecentTokenPair({ fromToken, toToken });
    },
    [stockChannel],
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
      {embedded ? null : <SwapTipsContainer pageType={pageType} />}
      <YStack
        testID={SwapTestIDs.stockMobileContainer}
        // pt $1 + the header pill's py $1 puts the stock symbol at the same
        // vertical offset as Pro mode's (pt $2 -> symbol at 8px), so the
        // instrument name does not jump when switching tabs (OK-57348).
        pt="$0"
        px="$5"
        pb="$5"
        gap="$2"
        flex={1}
      >
        {embedded ? null : <SwapStockMobileHeader />}
        <StockTradeTicket
          onSelectToken={onSelectToken}
          fetchLoading={fetchLoading}
          storeName={storeName}
          onSelectPercentageStage={onSelectPercentageStage}
          onBalanceMaxPress={onBalanceMaxPress}
          onPreSwap={onPreSwap}
          onToAnotherAddressModal={onToAnotherAddressModal}
          onOpenProviderList={onOpenProviderList}
          refreshAction={refreshAction}
          quoteResult={quoteResult}
          quoteLoading={quoteLoading}
          quoteEventFetching={quoteEventFetching}
          alerts={alerts}
          stockChannel={stockChannel}
          tradeSide={stockChannel.tradeSide}
          onTradeSideChange={handleTradeSideChange}
          recentTokenPairs={stockRecentTokenPairs}
          onSelectRecentTokenPairs={handleSelectRecentStockTokenPairs}
          compact
          stockTradeConfig={stockTradeConfig}
          stockTradeHeader={
            embedded ? stockTradeHeader : <SwapStockVariantSelector />
          }
        />
        {embedded || isDesktopModalPage ? null : (
          <YStack mt="$2">
            <SwapStockPositions mobile networks={supportNetworksList} />
          </YStack>
        )}
      </YStack>
    </Keyboard.AwareScrollView>
  );
}

export function SwapStockMobileContainer(
  props: ISwapStockDesktopContainerProps,
) {
  const { stockSpeedConfig, stockTradeToken } = props;
  return (
    <SwapStockTradeProvider
      stockSpeedConfig={stockSpeedConfig}
      stockTradeToken={stockTradeToken}
    >
      <SwapStockPageProviders {...props}>
        <SwapStockMobileContent {...props} />
      </SwapStockPageProviders>
    </SwapStockTradeProvider>
  );
}

function SwapStockPageProviders({
  children,
  embedded,
  supportNetworksList,
  fetchLoading,
  storeName,
}: ISwapStockDesktopContainerProps & { children: ReactNode }) {
  if (embedded) return children;
  return (
    <SwapStockMarketProvider storeName={storeName}>
      <SwapStockPortfolioProvider>
        <SwapStockPositionsProvider
          networks={supportNetworksList}
          ready={!fetchLoading}
        >
          {children}
        </SwapStockPositionsProvider>
      </SwapStockPortfolioProvider>
    </SwapStockMarketProvider>
  );
}
