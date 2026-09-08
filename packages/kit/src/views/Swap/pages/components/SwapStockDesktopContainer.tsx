import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';

import BigNumber from 'bignumber.js';
import { useIntl } from 'react-intl';
import { InputAccessoryView } from 'react-native';

import type { EPageType } from '@onekeyhq/components';
import {
  Button,
  Divider,
  Icon,
  KEYBOARD_AWARE_SCROLL_BOTTOM_OFFSET,
  Keyboard,
  NumberSizeableText,
  Page,
  Popover,
  ScrollView,
  SegmentControl,
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
import { StockPriceLineChart } from '@onekeyhq/kit/src/components/StockPriceLineChart';
import { Token } from '@onekeyhq/kit/src/components/Token';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { useDebounce } from '@onekeyhq/kit/src/hooks/useDebounce';
import { useNetworkLogoUri } from '@onekeyhq/kit/src/hooks/useNetworkLogoUri';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import {
  useSwapFromTokenAmountAtom,
  useSwapProEnableCurrentSymbolAtom,
  useSwapQuoteActionLockAtom,
  useSwapQuoteEventCompletedAtom,
  useSwapQuoteEventErrorAtom,
  useSwapSelectFromTokenAtom,
  useSwapSelectToTokenAtom,
  useSwapToTokenAmountAtom,
  useSwapTypeSwitchAtom,
} from '@onekeyhq/kit/src/states/jotai/contexts/swap';
import { BaseMarketTokenPrice } from '@onekeyhq/kit/src/views/Market/components/MarketTokenPrice';
import {
  StockMarketStatusBadge,
  StockSourceLogo,
} from '@onekeyhq/kit/src/views/Market/components/PerpsBadges';
import { PriceChangePercentage } from '@onekeyhq/kit/src/views/Market/components/PriceChangePercentage';
import { TokenList } from '@onekeyhq/kit/src/views/Market/MarketDetailV2/components/SwapPanel/components/TokenInputSection/TokenList';
import { TradeTypeSelector } from '@onekeyhq/kit/src/views/Market/MarketDetailV2/components/SwapPanel/components/TradeTypeSelector';
import { ESwapDirection } from '@onekeyhq/kit/src/views/Market/MarketDetailV2/components/SwapPanel/hooks/useTradeType';
import type { IToken } from '@onekeyhq/kit/src/views/Market/MarketDetailV2/components/SwapPanel/types';
import {
  formatCurrencyStatValue,
  formatMarketCapValue,
  formatPercentValue,
  formatRatioValue,
} from '@onekeyhq/kit/src/views/Market/MarketDetailV2/utils/statValue';
import {
  type EJotaiContextStoreNames,
  useInAppNotificationAtom,
} from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { dismissKeyboard } from '@onekeyhq/shared/src/keyboard';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import {
  EModalRoutes,
  EOnboardingPages,
  EOnboardingPagesV2,
  EOnboardingV2Routes,
  ERootRoutes,
} from '@onekeyhq/shared/src/routes';
import { EModalSwapRoutes } from '@onekeyhq/shared/src/routes/swap';
import {
  swrCacheUtils,
  swrKeys,
} from '@onekeyhq/shared/src/utils/swrCacheUtils';
import { EAccountSelectorSceneName } from '@onekeyhq/shared/types';
import type { IMarketTokenChart } from '@onekeyhq/shared/types/market';
import type {
  IMarketBasicConfigNetwork,
  IMarketTokenDetail,
} from '@onekeyhq/shared/types/marketV2';
import {
  EProtocolOfExchange,
  ESwapDirectionType,
  ESwapTabSwitchType,
  type IFetchQuoteResult,
  type ISwapAlertState,
  type ISwapNetwork,
  type ISwapToken,
  SwapAmountInputAccessoryViewID,
} from '@onekeyhq/shared/types/swap/types';

import SwapFAQ from '../../components/SwapFAQ';
import { SwapRateDifferenceText } from '../../components/SwapRateDifferenceText';
import SwapRecentTokenPairsGroup from '../../components/SwapRecentTokenPairsGroup';
import { getTokenIdentityKey } from '../../hooks/swapStockChannelUtils';
import { useRefreshQuoteWhenStockMarketReopens } from '../../hooks/useRefreshQuoteWhenStockMarketReopens';
import { useSwapAddressInfo } from '../../hooks/useSwapAccount';
import { useShouldShowSwapLocalData } from '../../hooks/useSwapLocalDataVisibility';
import { useSwapProSupportNetworksTokenList } from '../../hooks/useSwapPro';
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
import {
  type ISwapRecentTokenPair,
  buildSwapRecentTokenPairsFromHistory,
  getSwapMarketPendingHistoryKey,
} from '../../utils/swapMarketHistory';
import {
  getStockQuoteTradeControl,
  isQuoteRequestForStockTrade,
} from '../../utils/swapStockTradeControl';
import {
  getSwapKLineWalletChartDays,
  normalizeSwapKLineWalletChartData,
} from '../modal/swapKLineChartUtils';

import SwapActionsState from './SwapActionsState';
import { SwapStockHeaderRightActionContainer } from './SwapHeaderRightActionContainer';
import SwapHistoryClearButton from './SwapHistoryClearButton';
import SwapInputActions from './SwapInputActions';
import { PercentageStageOnKeyboard } from './SwapInputContainer';
import SwapMarketHistoryList from './SwapMarketHistoryList';
import SwapPendingHistoryListComponent from './SwapPendingHistoryList';
import SwapProCurrentSymbolEnable from './SwapProCurrentSymbolEnable';
import SwapProPositionsList from './SwapProPositionsList';
import SwapQuoteResult from './SwapQuoteResult';
import {
  type IStockChartCoinGeckoIdLookupResult,
  type IStockChartRange,
  STOCK_CHART_DEFAULT_RANGE,
  STOCK_CHART_RANGE_ITEMS,
  STOCK_DESKTOP_HEADER_SLOT_PROPS,
  getStockChartCoinGeckoIdState,
  getStockChartDisplayState,
  getStockDisabledActionButtonProps,
  getStockMarketTokenSubtitle,
  getStockNetworkLogoUri,
  isStockMarketPanelLoadingStage,
  shouldDeferStockInitialContent,
  shouldShowStockMarketHeaderSkeleton,
  shouldShowStockMarketTokenLabelsSkeleton,
  shouldShowStockQuoteActionLoading,
} from './SwapStockDesktopContainer.utils';
import { SwapStockTokenDetails } from './SwapStockTokenDetails';
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
}

type IStockMarketTokenDetail = IMarketTokenDetail | undefined;
type ISwapStockTokenWithMetadata = ISwapToken & {
  stock?: IMarketTokenDetail['stock'];
};
type IStockMarketDataRow = {
  label: string;
  value: string;
  tooltip?: string;
};

const STOCK_CHART_VISIBLE_HEIGHT = 174;
const STOCK_ESTIMATED_RECEIVE_PRIMARY_ROW_HEIGHT = 24;
const STOCK_ESTIMATED_RECEIVE_SECONDARY_ROW_HEIGHT = 20;
const STOCK_ESTIMATED_RECEIVE_CONTENT_HEIGHT =
  STOCK_ESTIMATED_RECEIVE_PRIMARY_ROW_HEIGHT +
  STOCK_ESTIMATED_RECEIVE_SECONDARY_ROW_HEIGHT;
const STOCK_TRADE_SIDE_SWITCH_WIDTH = 176;
const STOCK_DESKTOP_CONTENT_MAX_WIDTH = 1140;
const STOCK_RECENT_TOKEN_PAIR_SWAP_TYPES = [ESwapTabSwitchType.STOCK] as const;

type IStockChartState = {
  assetScope: string;
  data: IMarketTokenChart;
  range: IStockChartRange;
  scope: string;
  // Optional for compatibility with existing SWR entries written before the
  // request lifecycle became explicit.
  status?: 'pending' | 'success' | 'error';
};

function useOpenStockTokenSelector({
  defaultNetworkId,
  storeName,
}: {
  defaultNetworkId?: string;
  storeName: EJotaiContextStoreNames;
}) {
  const navigation = useAppNavigation();
  return useCallback(() => {
    dismissKeyboard();
    navigation.pushModal(EModalRoutes.SwapModal, {
      screen: EModalSwapRoutes.SwapTokenSelect,
      params: {
        type: ESwapDirectionType.FROM,
        storeName,
        selectTarget: 'swapStock',
        defaultNetworkId,
      },
    });
  }, [defaultNetworkId, navigation, storeName]);
}

function getStockChartTokenDetailCoinGeckoId(
  tokenDetail?: IStockMarketTokenDetail,
) {
  const coinGeckoId = tokenDetail?.coingeckoId;
  if (typeof coinGeckoId !== 'string') {
    return undefined;
  }
  return coinGeckoId.trim() || undefined;
}

function useStockChartCoinGeckoId({
  networkId,
  tokenAddress,
  tokenDetail,
}: {
  networkId?: string;
  tokenAddress?: string;
  tokenDetail?: IStockMarketTokenDetail;
}) {
  const tokenDetailCoinGeckoId =
    getStockChartTokenDetailCoinGeckoId(tokenDetail);
  const tokenScope = networkId
    ? `${networkId}:${tokenAddress?.trim().toLowerCase() || '__native__'}`
    : '';
  const swrKey = tokenScope
    ? ['swapStockChartCoinGeckoId', 'v1', tokenScope].join(':')
    : undefined;
  const { result } = usePromiseResult<
    IStockChartCoinGeckoIdLookupResult | undefined
  >(
    async () => {
      if (tokenDetailCoinGeckoId || !networkId) {
        return undefined;
      }

      try {
        const tokenInfo =
          await backgroundApiProxy.serviceToken.fetchTokenInfoOnly({
            networkId,
            tokenAddress: tokenAddress ?? '',
          });
        return {
          tokenScope,
          coinGeckoId: tokenInfo?.info?.coingeckoId?.trim() || undefined,
        };
      } catch (_error) {
        const cachedResult = swrKey
          ? swrCacheUtils.get<IStockChartCoinGeckoIdLookupResult>(swrKey)
          : undefined;
        return cachedResult?.tokenScope === tokenScope
          ? cachedResult
          : { cacheable: false, tokenScope };
      }
    },
    [networkId, swrKey, tokenAddress, tokenDetailCoinGeckoId, tokenScope],
    {
      checkIsFocused: false,
      swrKey,
      swrShouldPersist: (value) =>
        value?.cacheable !== false && value?.tokenScope === tokenScope,
    },
  );

  return getStockChartCoinGeckoIdState({
    lookupResult: result,
    networkId,
    tokenDetailCoinGeckoId,
    tokenScope,
  });
}

function StockMarketDataItem({
  compact,
  label,
  value,
  tooltip,
}: {
  compact?: boolean;
  label: string;
  value: string;
  tooltip?: string;
}) {
  return (
    <YStack
      flexGrow={1}
      flexBasis={0}
      minWidth={0}
      h={compact ? 44 : 48}
      px={compact ? '$3' : '$3.5'}
      py="$1.5"
      borderRadius="$3"
      bg="$bgSubdued"
      justifyContent="space-between"
    >
      <XStack alignItems="center" gap="$1" minWidth={0} h="$4">
        <SizableText
          size="$bodySm"
          color="$textSubdued"
          numberOfLines={1}
          flexShrink={1}
        >
          {label}
        </SizableText>
        {tooltip ? (
          <Popover.Tooltip
            iconSize="$4"
            title={label}
            tooltip={tooltip}
            placement="top"
            renderContent={
              <YStack p="$5">
                <SizableText size="$bodyMd">{tooltip}</SizableText>
              </YStack>
            }
          />
        ) : null}
      </XStack>
      <SizableText
        size={compact ? '$bodySmMedium' : '$bodyMd'}
        color="$text"
        numberOfLines={1}
      >
        {value}
      </SizableText>
    </YStack>
  );
}

function buildStockMarketDataRows({
  intl,
  tokenDetail,
}: {
  intl: ReturnType<typeof useIntl>;
  tokenDetail?: IStockMarketTokenDetail;
}): IStockMarketDataRow[] {
  const assetAnalysis = tokenDetail?.stock?.assetAnalysis;
  const tradingActivity = tokenDetail?.stock?.tradingActivity;
  return [
    {
      label: intl.formatMessage({
        id: ETranslations.dexmarket_stock_24h_volume,
      }),
      value: formatCurrencyStatValue(
        assetAnalysis?.volume24h ?? tokenDetail?.volume24h,
      ),
    },
    {
      label: intl.formatMessage({
        id: ETranslations.dexmarket_stock_volume_shares,
      }),
      value: formatMarketCapValue(assetAnalysis?.volumeShares),
    },
    {
      label: intl.formatMessage({
        id: ETranslations.dexmarket_stock_turnover_rate,
      }),
      value: assetAnalysis?.turnoverRate
        ? `${formatMarketCapValue(assetAnalysis.turnoverRate)}%`
        : '--',
    },
    {
      label: intl.formatMessage({
        id: ETranslations.dexmarket_stock_pe_ttm,
      }),
      value: formatRatioValue(tradingActivity?.peRatio),
      tooltip: intl.formatMessage({
        id: ETranslations.dexmarket_stock_pe_ttm_desc,
      }),
    },
    {
      label: intl.formatMessage({
        id: ETranslations.dexmarket_stock_ps,
      }),
      value: formatRatioValue(tradingActivity?.psRatio),
      tooltip: intl.formatMessage({
        id: ETranslations.dexmarket_stock_ps_desc,
      }),
    },
    {
      label: intl.formatMessage({
        id: ETranslations.dexmarket_stock_dividend_yield,
      }),
      value: formatPercentValue(tradingActivity?.dividendYield),
      tooltip: intl.formatMessage({
        id: ETranslations.dexmarket_stock_dividend_yield_desc,
      }),
    },
  ];
}

function useCurrentStockMarketDetail() {
  const stockChannel = useSwapStockTradeContext();
  const currentStockToken = stockChannel.currentStockToken as
    | ISwapStockTokenWithMetadata
    | undefined;

  return {
    stockChannel,
    // Display may use the scope-safe SWR seed immediately; quote/action state
    // continues to use activeStockTokenDetail and the fresh channel stage.
    tokenDetail: stockChannel.displayStockTokenDetail,
    currentStockToken,
    hasCurrentLocaleStockMetadata: stockChannel.hasCurrentLocaleStockMetadata,
    tokenAddress: currentStockToken?.contractAddress,
    networkId: currentStockToken?.networkId,
    isNative: currentStockToken?.isNative,
  };
}

function StockMarketDataGridContent({
  compact,
  rows,
  testID,
}: {
  compact?: boolean;
  rows: IStockMarketDataRow[];
  testID: string;
}) {
  const intl = useIntl();
  const rowGap = compact ? '$2' : '$3';

  return (
    <YStack w="100%" gap={rowGap} testID={testID}>
      <SizableText
        size={compact ? '$bodySmMedium' : '$bodyMdMedium'}
        color="$text"
      >
        {intl.formatMessage({ id: ETranslations.trade_stock_market_data })}
      </SizableText>
      <YStack w="100%" gap={rowGap}>
        {[0, 2, 4].map((rowStart) => (
          <XStack key={rowStart} gap={rowGap} w="100%" alignItems="stretch">
            {rows.slice(rowStart, rowStart + 2).map((item) => (
              <StockMarketDataItem
                key={item.label}
                compact={compact}
                label={item.label}
                value={item.value}
                tooltip={item.tooltip}
              />
            ))}
          </XStack>
        ))}
      </YStack>
    </YStack>
  );
}

function StockMarketDataGrid({
  tokenDetail,
}: {
  tokenDetail?: IStockMarketTokenDetail;
}) {
  const intl = useIntl();
  const rows = useMemo(
    () =>
      buildStockMarketDataRows({
        intl,
        tokenDetail,
      }),
    [intl, tokenDetail],
  );

  return (
    <StockMarketDataGridContent
      rows={rows}
      testID={SwapTestIDs.stockMarketDataGrid}
    />
  );
}

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
  quoteResult,
  quoteLoading,
  quoteEventFetching,
  stockChannel,
}: {
  quoteResult?: IFetchQuoteResult;
  quoteLoading: boolean;
  quoteEventFetching: boolean;
  stockChannel: IUseSwapStockChannelReturn;
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
  const receiveQuoteLoading =
    quoteLoading || (quoteEventFetching && !quoteResult);
  const {
    canSelectReceiveToken,
    currencySymbol,
    isLoading,
    isSellSide,
    isReceiveTokenPopoverOpen,
    onReceiveTokenPress,
    rateDifference,
    receiveAmount,
    receiveFiatValue,
    receiveToken,
    setIsReceiveTokenPopoverOpen,
  } = useSwapStockEstimatedReceiveState({
    forceHideQuote: shouldHideQuoteResult,
    quoteEventFetching: false,
    quoteLoading: receiveQuoteLoading,
    quoteResult,
    stockChannel,
  });
  const receiveTokenSymbol = receiveToken?.symbol ?? '';
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
            disableNativeToken={stockChannel.disableNativePayToken}
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
    <XStack
      testID={SwapTestIDs.stockEstimatedReceive}
      h={48}
      alignItems="center"
      justifyContent="space-between"
      gap="$2"
    >
      <XStack alignItems="center" gap="$1" flexShrink={0} h="$5">
        <Icon name="HandCoinsOutline" size="$4.5" color="$iconSubdued" />
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
  );
}

function StockActionGate({
  alerts,
  balanceActionsReady,
  stockChannel,
  onPreSwap,
  onToAnotherAddressModal,
  onSelectPercentageStage,
}: {
  alerts: ISwapStockDesktopContainerProps['alerts'];
  balanceActionsReady: boolean;
  stockChannel: IUseSwapStockChannelReturn;
  onPreSwap: () => void;
  onToAnotherAddressModal: () => void;
  onSelectPercentageStage: (stage: number) => void;
}) {
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
    stockChannel.payTokenStatus === ESwapStockChannelAsyncStatus.Initializing;
  const forceQuoteActionLoading = shouldShowStockQuoteActionLoading({
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
  });
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

  if (stockChannel.readyForQuote) {
    return (
      <SwapActionsState
        forceQuoteActionLoading={forceQuoteActionLoading}
        onPreSwap={onPreSwap}
        onOpenRecipientAddress={onToAnotherAddressModal}
        onSelectPercentageStage={
          balanceActionsReady ? onSelectPercentageStage : undefined
        }
      />
    );
  }

  if (isStockChannelInitializing) {
    return renderActionButton(
      <Button
        testID={SwapTestIDs.swapButton}
        size={isDesktopModalPage ? 'medium' : 'large'}
        variant="primary"
        disabled
        borderRadius="$full"
        childrenAsText={false}
      >
        <Spinner
          h="$6"
          alignItems="center"
          justifyContent="center"
          size="small"
          color="$iconInverse"
        />
      </Button>,
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

function StockAmountInputSkeleton({ isBuySide }: { isBuySide: boolean }) {
  const intl = useIntl();
  return (
    <YStack
      testID={SwapTestIDs.stockAmountInputSkeleton}
      h={124}
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
      </XStack>
      <YStack flex={1} justifyContent="space-between" pt="$1" pb="$2.5">
        <XStack alignItems="center" justifyContent="space-between">
          <YStack px="$3.5" py="$1" gap="$2">
            <Skeleton h="$8" w="$24" />
          </YStack>
          <XStack
            m="$1.5"
            mb="$0"
            p="$2"
            minWidth={132}
            alignItems="center"
            justifyContent="flex-end"
            gap="$2"
          >
            <Skeleton w="$7" h="$7" radius="round" />
            <Skeleton h="$6" w="$16" />
            <Skeleton h="$5" w="$5" />
          </XStack>
        </XStack>
        <XStack alignItems="center" justifyContent="space-between">
          <Stack m="$1" px="$2.5" py="$1">
            <Skeleton h="$4" w="$16" />
          </Stack>
          <Stack m="$1" px="$2.5" py="$1">
            <Skeleton h="$4" w="$24" />
          </Stack>
        </XStack>
      </YStack>
    </YStack>
  );
}

function StockAmountInput({
  fetchLoading,
  amountInputState,
  deferInitialContent,
  storeName,
}: Pick<ISwapStockDesktopContainerProps, 'fetchLoading' | 'storeName'> & {
  amountInputState: ReturnType<typeof useSwapStockAmountInputState>;
  deferInitialContent: boolean;
}) {
  const intl = useIntl();
  const [, setInAppNotification] = useInAppNotificationAtom();
  const {
    amountFiatValue,
    balanceActionsReady,
    balanceLoading,
    currencySymbol,
    disableNativePayToken,
    displayBalance,
    hasBalanceError,
    inputToken,
    inputTokenNetworkLogoURI,
    inputValue,
    isBuySide,
    onAmountChange,
    onBalanceMaxPress,
    onSelectPercentageStage,
    payToken,
    payTokenOptionsLoading,
    payTokens,
    selectablePayTokens,
    selectPayToken,
    shouldRenderSkeleton,
  } = amountInputState;
  const canOpenSellStockTokenSelector = !isBuySide && Boolean(inputToken);
  const canOpenBuyPayTokenSelector =
    isBuySide && selectablePayTokens.length > 1;
  const handleOpenStockTokenSelector = useOpenStockTokenSelector({
    defaultNetworkId: inputToken?.networkId,
    storeName,
  });
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

  if (shouldRenderSkeleton || deferInitialContent) {
    return <StockAmountInputSkeleton isBuySide={isBuySide} />;
  }

  return (
    <YStack h={124} bg="$bgSubdued" borderRadius="$4" overflow="hidden">
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
          accountInfo={swapFromAddressInfo.accountInfo}
          showPercentageInput={
            showPercentageInputDebounce && balanceActionsReady
          }
          showActionBuy={showActionBuy}
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
          value: amountFiatValue,
          currency: currencySymbol,
        }}
        balanceProps={{
          value: inputToken ? displayBalance : undefined,
          loading: balanceLoading,
          onPress: balanceActionsReady ? onBalanceMaxPress : undefined,
          hideIcon: true,
          tokenSymbol: inputToken?.symbol,
          testID: balanceActionsReady ? SwapTestIDs.maxButton : undefined,
        }}
        maxAmountText={intl.formatMessage({ id: ETranslations.global_max })}
        inputProps={{
          placeholder: '0.0',
          inputAccessoryViewID:
            platformEnv.isNativeIOS && balanceActionsReady
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
          loading: showTokenSelectorLoading,
          selectedTokenImageUri: inputToken?.logoURI,
          selectedNetworkImageUri: inputTokenNetworkLogoURI,
          selectedTokenSymbol: inputToken?.symbol,
          showNetworkIconBorder: false,
          disabled:
            !canOpenBuyPayTokenSelector && !canOpenSellStockTokenSelector,
          onPress: canOpenSellStockTokenSelector
            ? handleOpenStockTokenSelector
            : undefined,
          popover:
            canOpenBuyPayTokenSelector && payTokens.length > 1
              ? {
                  title: intl.formatMessage({
                    id: ETranslations.dexmarket_select_token,
                  }),
                  content: (
                    <StockPayTokenPopoverContent
                      tokens={payTokens}
                      currentSelectToken={payToken}
                      disableNativeToken={disableNativePayToken}
                      onTokenPress={selectPayToken}
                    />
                  ),
                }
              : undefined,
        }}
        enableMaxAmount={Boolean(inputToken)}
      />
      {platformEnv.isNativeIOS && balanceActionsReady ? (
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
}) {
  const amountInputState = useSwapStockAmountInputState({ stockChannel });
  const startedWithoutAmountInputRef = useRef(!amountInputState.inputToken);
  const deferInitialAmountContent = shouldDeferStockInitialContent({
    channelStage: stockChannel.channelStage,
    startedWithoutContent: startedWithoutAmountInputRef.current,
  });
  if (!deferInitialAmountContent) startedWithoutAmountInputRef.current = false;
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
      onPreSwap={onPreSwap}
      onToAnotherAddressModal={onToAnotherAddressModal}
      onSelectPercentageStage={amountInputState.onSelectPercentageStage}
    />
  );

  return (
    <>
      <YStack gap={compact ? '$3' : '$4'}>
        <StockTradeSideSwitch value={tradeSide} onChange={onTradeSideChange} />
        <StockAmountInput
          fetchLoading={fetchLoading}
          amountInputState={amountInputState}
          deferInitialContent={deferInitialAmountContent}
          storeName={storeName}
        />
        <StockEstimatedReceive
          quoteResult={quoteResult}
          quoteLoading={quoteLoading}
          quoteEventFetching={quoteEventFetching}
          stockChannel={stockChannel}
        />
        {renderActionGateOutsideTicket ? null : stockActionGate}
        <SwapStockTradeAlert
          alerts={alerts}
          quoteEventFetching={quoteEventFetching}
          quoteLoading={quoteLoading}
          quoteResult={quoteResult}
          stockChannel={stockChannel}
          // px of the hosting YStack gap above: "$3" = 12, "$4" = 16
          parentGap={compact ? 12 : 16}
        />
        {stockChannel.readyForQuote ? (
          <SwapQuoteResult
            refreshAction={refreshAction}
            onOpenProviderList={onOpenProviderList}
            quoteResult={quoteResult}
          />
        ) : null}
        <SwapRecentTokenPairsGroup
          onSelectTokenPairs={onSelectRecentTokenPairs}
          tokenPairs={recentTokenPairs}
          fromTokenAmount={amountInputState.inputValue}
          visibleSwapTypes={STOCK_RECENT_TOKEN_PAIR_SWAP_TYPES}
        />
      </YStack>
      {renderActionGateOutsideTicket ? stockActionGate : null}
    </>
  );
}

function StockMarketHeaderSkeleton({ proAligned }: { proAligned?: boolean }) {
  return (
    <XStack
      alignItems="center"
      justifyContent="space-between"
      h={proAligned ? undefined : '$13'}
      w="100%"
      gap="$3"
    >
      <XStack
        flex={1}
        minWidth={0}
        gap="$2.5"
        alignItems="center"
        bg="$transparent"
        px="$0"
        py="$0"
      >
        <XStack
          alignItems="center"
          alignSelf="flex-start"
          gap="$2.5"
          maxWidth="100%"
          minWidth={0}
          flexShrink={1}
          ml="$-3"
          px="$3"
          py="$1"
          borderRadius="$full"
        >
          <Skeleton w="$8" h="$8" radius="round" />
          <YStack minWidth={0} flexShrink={1}>
            <XStack h="$6" alignItems="center" gap="$1">
              <Skeleton h="$5" w="$20" />
              <Skeleton h="$5" w="$5" />
            </XStack>
            <StockMarketTokenLabelsSkeleton />
          </YStack>
        </XStack>
      </XStack>
      <YStack
        alignItems="flex-end"
        w="$20"
        minWidth={0}
        flexShrink={0}
        gap="$1"
      >
        <Skeleton h="$6" w="$16" />
        <Skeleton h="$4" w="$12" />
      </YStack>
    </XStack>
  );
}

function StockMarketTokenLabelsSkeleton() {
  return (
    <XStack h={18} alignItems="center" gap="$1" maxWidth="100%">
      <Skeleton h="$4" w="$18" />
      <Skeleton h="$4" w="$5" radius="round" />
      <Skeleton h="$4" w="$12" />
    </XStack>
  );
}

function StockMarketTokenHeader({
  channelStage,
  storeName,
  proAligned,
}: {
  channelStage: ESwapStockChannelStage;
  storeName: EJotaiContextStoreNames;
  // The mobile layout passes true so the header visually matches Pro mode's
  // token selector (see SwapProTokenSelect): symbol at $headingLg with a
  // 160px cap, and intrinsic row height instead of the fixed $13 so the
  // symbol sits at the same vertical offset as on the Pro tab and does not
  // jump when switching tabs. The desktop stock card keeps the compact
  // $headingSm heading and fixed row height (OK-57348).
  proAligned?: boolean;
}) {
  const intl = useIntl();
  const {
    currentStockToken,
    hasCurrentLocaleStockMetadata,
    tokenDetail,
    networkId,
  } = useCurrentStockMarketDetail();
  const stockTokenNetworkId =
    currentStockToken?.networkId ?? tokenDetail?.networkId ?? networkId;
  const stockTokenNetworkLogoUri = useMemo(
    () =>
      getStockNetworkLogoUri({
        networkId: stockTokenNetworkId,
        networkLogoUri: currentStockToken?.networkLogoURI,
      }),
    [currentStockToken?.networkLogoURI, stockTokenNetworkId],
  );
  const effectiveNetworkLogoUri = useNetworkLogoUri({
    logoUri: stockTokenNetworkLogoUri,
    networkId: stockTokenNetworkId,
  });
  const selectedStock = hasCurrentLocaleStockMetadata
    ? currentStockToken?.stock
    : undefined;
  const stock = tokenDetail?.stock ?? selectedStock;
  const tokenSymbol = tokenDetail?.symbol ?? currentStockToken?.symbol;
  const tokenDisplaySymbol =
    tokenSymbol ??
    intl.formatMessage({
      id: ETranslations.swap_page_button_select_token,
    });
  const tokenName =
    tokenDetail?.name ?? currentStockToken?.name ?? tokenSymbol ?? '';
  const priceChange24hPercent = tokenDetail?.priceChange24hPercent;
  const hasPriceChange24hPercent =
    priceChange24hPercent !== undefined &&
    priceChange24hPercent !== null &&
    priceChange24hPercent !== '';
  const tokenSubtitle = getStockMarketTokenSubtitle({
    currentStockSubtitle: selectedStock?.subtitle,
    tokenDetailStockSubtitle: stock?.subtitle,
    tokenDetailStockUnderlyingAssetName: stock?.underlyingAssetName,
  });
  const showTokenLabelsSkeleton = shouldShowStockMarketTokenLabelsSkeleton({
    channelStage,
    hasTokenData: Boolean(stock || tokenSubtitle),
  });
  const tokenImageUri = currentStockToken?.logoURI ?? tokenDetail?.logoUrl;
  const startedWithoutHeaderContentRef = useRef(!currentStockToken);
  const deferInitialHeaderContent = shouldDeferStockInitialContent({
    channelStage,
    startedWithoutContent: startedWithoutHeaderContentRef.current,
  });
  if (!deferInitialHeaderContent)
    startedWithoutHeaderContentRef.current = false;
  const handleOpenStockTokenSelector = useOpenStockTokenSelector({
    defaultNetworkId: stockTokenNetworkId,
    storeName,
  });

  if (
    deferInitialHeaderContent ||
    shouldShowStockMarketHeaderSkeleton({
      channelStage,
      hasStockIdentity: Boolean(currentStockToken),
    })
  ) {
    return <StockMarketHeaderSkeleton proAligned={proAligned} />;
  }

  const tokenIcon = (
    <Token
      size="md"
      tokenImageUri={tokenImageUri}
      tokenImageUris={
        currentStockToken?.logoURI ? undefined : tokenDetail?.logoUrls
      }
      recyclingKey={tokenImageUri}
      networkImageUri={effectiveNetworkLogoUri}
      showNetworkIconBorder={false}
      bg="$transparent"
      fallbackIcon="CryptoCoinOutline"
    />
  );
  const tokenSymbolRow = (
    <XStack h="$6" alignItems="center" gap="$1" maxWidth="100%" minWidth={0}>
      <SizableText
        size={proAligned ? '$headingLg' : '$headingSm'}
        color="$text"
        numberOfLines={1}
        ellipsizeMode="tail"
        maxWidth={proAligned ? '$40' : 132}
        flexShrink={1}
      >
        {tokenDisplaySymbol}
      </SizableText>
      <Icon
        name="ChevronDownSmallOutline"
        size="$5"
        color="$iconSubdued"
        flexShrink={0}
      />
    </XStack>
  );
  const tokenLabelsRow = (
    <XStack h={18} alignItems="center" gap="$1" maxWidth="100%">
      {showTokenLabelsSkeleton ? <StockMarketTokenLabelsSkeleton /> : null}
      {!showTokenLabelsSkeleton && tokenSubtitle ? (
        <SizableText
          size="$bodySm"
          color="$textSubdued"
          numberOfLines={1}
          flexShrink={1}
        >
          {tokenSubtitle}
        </SizableText>
      ) : null}
      {!showTokenLabelsSkeleton ? <StockSourceLogo stock={stock} /> : null}
      {!showTokenLabelsSkeleton ? (
        <StockMarketStatusBadge stock={stock} />
      ) : null}
    </XStack>
  );
  const tokenInfoContent = (
    <XStack
      testID={SwapTestIDs.stockMarketTokenHeader}
      alignItems="center"
      alignSelf="flex-start"
      gap="$2.5"
      maxWidth="100%"
      minWidth={0}
      flexShrink={1}
      ml="$-3"
      px="$3"
      py="$1"
      cursor="pointer"
      borderRadius="$full"
      hoverStyle={{ bg: '$bgHover' }}
      pressStyle={{ bg: '$bgActive' }}
      onPress={handleOpenStockTokenSelector}
    >
      {tokenIcon}
      <YStack minWidth={0} flexShrink={1}>
        {tokenSymbolRow}
        {tokenLabelsRow}
      </YStack>
    </XStack>
  );

  return (
    <XStack
      alignItems="center"
      justifyContent="space-between"
      h={proAligned ? undefined : '$13'}
      w="100%"
      gap="$3"
    >
      <XStack
        flex={1}
        minWidth={0}
        gap="$2.5"
        alignItems="center"
        bg="$transparent"
        px="$0"
        py="$0"
      >
        {tokenInfoContent}
      </XStack>
      <YStack alignItems="flex-end" w="$20" minWidth={0} flexShrink={0}>
        {tokenDetail ? (
          <BaseMarketTokenPrice
            size="$bodyLg"
            color="$text"
            numberOfLines={1}
            textAlign="right"
            price={tokenDetail.price ?? tokenDetail.priceConverted ?? ''}
            tokenName={tokenName}
            tokenSymbol={tokenSymbol ?? ''}
            lastUpdated={String(tokenDetail.lastUpdated ?? '')}
            currency="$"
          />
        ) : (
          <SizableText size="$bodyLg" color="$textSubdued">
            --
          </SizableText>
        )}
        {hasPriceChange24hPercent ? (
          <PriceChangePercentage size="$bodySm">
            {priceChange24hPercent}
          </PriceChangePercentage>
        ) : (
          <SizableText size="$bodySm" color="$textSubdued">
            -
          </SizableText>
        )}
      </YStack>
    </XStack>
  );
}

function StockPriceChart({
  coinGeckoId,
  coinGeckoIdLoading,
  isNative,
  networkId,
  onRangeChange,
  pulseLastPoint,
  range,
  realtimeChartPoint,
  tokenAddress,
}: {
  coinGeckoId?: string;
  coinGeckoIdLoading: boolean;
  isNative?: boolean;
  networkId?: string;
  onRangeChange: (range: IStockChartRange) => void;
  pulseLastPoint?: boolean;
  range: IStockChartRange;
  realtimeChartPoint?: IMarketTokenChart[number];
  tokenAddress?: string;
}) {
  const intl = useIntl();
  const normalizedCoinGeckoId = coinGeckoId?.trim();
  const rangeOptions = useMemo(
    () =>
      STOCK_CHART_RANGE_ITEMS.map((item) => ({
        label: item.label,
        value: item.label,
        testID: `swap-stock-chart-range-${item.label}`,
      })),
    [],
  );
  const handleRangeChange = useCallback(
    (value: string | number) => {
      onRangeChange(value as IStockChartRange);
    },
    [onRangeChange],
  );
  const activeRange = useMemo(
    () => STOCK_CHART_RANGE_ITEMS.find((item) => item.label === range),
    [range],
  );
  const chartAssetScope = `${networkId ?? ''}:${tokenAddress ?? ''}:${
    isNative ? 'native' : 'token'
  }`;
  const chartScope = swrKeys.swapStockChart({
    networkId: networkId ?? '',
    tokenAddress: tokenAddress ?? '',
    isNative,
    range,
    requestCurrency: 'usd',
  });
  const chartCacheReady = Boolean(
    networkId && (tokenAddress || isNative) && activeRange,
  );
  const chartRequestReady = Boolean(
    chartCacheReady && normalizedCoinGeckoId && activeRange,
  );
  const [visibleChartState, setVisibleChartState] = useState<IStockChartState>({
    assetScope: '',
    data: [],
    range,
    scope: '',
    status: 'pending',
  });
  const {
    result: chartState,
    isLoading,
    run: retryChart,
  } = usePromiseResult(
    async () => {
      if (!chartRequestReady || !activeRange || !normalizedCoinGeckoId) {
        return (
          (chartCacheReady
            ? swrCacheUtils.get<IStockChartState>(chartScope)
            : undefined) ?? {
            scope: chartScope,
            assetScope: chartAssetScope,
            range,
            data: [] as IMarketTokenChart,
            status:
              chartCacheReady && !coinGeckoIdLoading
                ? ('success' as const)
                : ('pending' as const),
          }
        );
      }
      try {
        const timeTo = Math.floor(Date.now() / 1000);
        const timeFrom = timeTo - activeRange.seconds;
        const days = getSwapKLineWalletChartDays({ timeFrom, timeTo });
        const response = await backgroundApiProxy.serviceMarket.fetchTokenChart(
          normalizedCoinGeckoId,
          days,
          {
            networkId,
            requestCurrency: 'usd',
            tokenAddress,
          },
        );
        return {
          scope: chartScope,
          assetScope: chartAssetScope,
          range,
          data: normalizeSwapKLineWalletChartData({
            chartData: response,
            timeFrom,
            timeTo,
          }),
          status: 'success' as const,
        };
      } catch (_error) {
        const cachedChartState =
          swrCacheUtils.get<IStockChartState>(chartScope);
        if (cachedChartState) {
          return cachedChartState;
        }
        return {
          scope: chartScope,
          assetScope: chartAssetScope,
          range,
          data: [] as IMarketTokenChart,
          status: 'error' as const,
        };
      }
    },
    [
      activeRange,
      chartAssetScope,
      chartCacheReady,
      chartRequestReady,
      chartScope,
      coinGeckoIdLoading,
      networkId,
      normalizedCoinGeckoId,
      range,
      tokenAddress,
    ],
    {
      initResult: {
        scope: '',
        assetScope: '',
        range,
        data: [] as IMarketTokenChart,
        status: 'pending',
      },
      swrKey: chartCacheReady ? chartScope : undefined,
      // A missing CoinGecko lookup id is a request-readiness gap, not a real
      // empty chart response. Keep the existing display snapshot untouched
      // until the request can actually run.
      swrShouldPersist: (state) =>
        chartRequestReady &&
        state.status !== 'pending' &&
        state.status !== 'error',
      watchLoading: true,
    },
  );
  const chartStateMatchesCurrentScope =
    chartState.scope === chartScope &&
    chartState.assetScope === chartAssetScope;
  useEffect(() => {
    if (chartStateMatchesCurrentScope) {
      setVisibleChartState(chartState);
    }
  }, [chartState, chartStateMatchesCurrentScope]);
  // A matching SWR snapshot is available during render. Prefer it directly so
  // remounting Stock does not spend one painted frame on the local empty state
  // while the effect mirrors the cached result.
  const displayChartState = chartStateMatchesCurrentScope
    ? chartState
    : visibleChartState;
  const isVisibleChartStateForCurrentAsset =
    displayChartState.assetScope === chartAssetScope;
  const isVisibleChartStateForCurrentScope =
    isVisibleChartStateForCurrentAsset &&
    displayChartState.scope === chartScope;
  const visibleRange = isVisibleChartStateForCurrentAsset
    ? displayChartState.range
    : range;
  const baseChartData = useMemo<IMarketTokenChart>(
    () => (isVisibleChartStateForCurrentAsset ? displayChartState.data : []),
    [displayChartState.data, isVisibleChartStateForCurrentAsset],
  );
  const { chartData, shouldShowChartError, shouldShowChartLoading } = useMemo(
    () =>
      getStockChartDisplayState({
        baseChartData,
        isChartStateForCurrentScope: isVisibleChartStateForCurrentScope,
        isLoading,
        requestStatus: displayChartState.status ?? 'success',
        realtimeChartPoint,
      }),
    [
      baseChartData,
      displayChartState.status,
      isLoading,
      isVisibleChartStateForCurrentScope,
      realtimeChartPoint,
    ],
  );
  const chartRetryPendingRef = useRef(false);
  const handleChartRetry = useCallback(() => {
    if (chartRetryPendingRef.current) {
      return;
    }
    chartRetryPendingRef.current = true;
    void retryChart().finally(() => {
      chartRetryPendingRef.current = false;
    });
  }, [retryChart]);
  let chartContent: ReactNode = (
    <YStack
      testID={SwapTestIDs.stockChartEmpty}
      flex={1}
      alignItems="center"
      justifyContent="center"
      gap="$2"
    >
      <YStack
        w="$10"
        h="$10"
        borderRadius="$full"
        bg="$bgStrong"
        alignItems="center"
        justifyContent="center"
      >
        <Icon name="ChartLine2Outline" size="$5" color="$iconSubdued" />
      </YStack>
      <SizableText
        size="$bodySm"
        color="$textSubdued"
        textAlign="center"
        numberOfLines={2}
      >
        {intl.formatMessage({
          id: ETranslations.dexmarket_k_line_no_recent_transactions,
        })}
      </SizableText>
    </YStack>
  );
  if (shouldShowChartLoading) {
    chartContent = (
      <YStack testID={SwapTestIDs.stockChartLoading} w="100%" h="100%">
        <Skeleton w="100%" h="100%" />
      </YStack>
    );
  } else if (shouldShowChartError) {
    chartContent = (
      <YStack
        testID={SwapTestIDs.stockChartError}
        flex={1}
        alignItems="center"
        justifyContent="center"
        gap="$2"
      >
        <Icon name="InfoCircleOutline" size="$6" color="$iconSubdued" />
        <SizableText size="$bodySm" color="$textSubdued" textAlign="center">
          {intl.formatMessage({
            id: ETranslations.global_unknown_error_retry_message,
          })}
        </SizableText>
        <Button
          testID={SwapTestIDs.stockChartRetry}
          size="small"
          variant="tertiary"
          onPress={handleChartRetry}
        >
          {intl.formatMessage({ id: ETranslations.global_retry })}
        </Button>
      </YStack>
    );
  } else if (chartData.length > 0) {
    chartContent = (
      <StockPriceLineChart
        testID={SwapTestIDs.stockChartContent}
        data={chartData}
        height={STOCK_CHART_VISIBLE_HEIGHT}
        pulseLastPoint={pulseLastPoint}
      />
    );
  }

  return (
    <YStack h={274} borderRadius="$4" bg="$bgSubdued" overflow="hidden">
      <XStack
        h={60}
        pl="$5"
        pr={30}
        alignItems="center"
        justifyContent="flex-end"
        gap="$3"
      >
        <SegmentControl
          w={156}
          h="$5"
          fullWidth
          value={visibleRange}
          options={rangeOptions}
          onChange={handleRangeChange}
          slotBackgroundColor="$transparent"
          activeBackgroundColor="$bgActive"
          activeTextColor="$text"
          inactiveTextColor="$textSubdued"
          segmentControlItemStyleProps={{
            h: '$5',
            minWidth: '$5',
            py: '$0',
            px: '$2',
            borderRadius: '$full',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        />
      </XStack>
      <Stack flex={1} minHeight={0} px="$5" pt="$2" pb="$4">
        {chartContent}
      </Stack>
    </YStack>
  );
}

function StockMobilePositionsSection({
  onTokenPress,
  supportNetworksList,
  supportNetworksReady,
  storeName,
}: {
  onTokenPress?: (token: ISwapToken) => void;
  supportNetworksList: (IMarketBasicConfigNetwork | ISwapNetwork)[];
  supportNetworksReady: boolean;
  storeName: EJotaiContextStoreNames;
}) {
  const intl = useIntl();
  const stockChannel = useSwapStockTradeContext();
  const [swapProEnableCurrentSymbol] = useSwapProEnableCurrentSymbolAtom();
  const [, setSwapTypeSwitch] = useSwapTypeSwitchAtom();
  const [swapFromToken] = useSwapSelectFromTokenAtom();
  const [swapToToken] = useSwapSelectToTokenAtom();
  const { selectStockSwapToken } = stockChannel;
  const {
    positionLoadError,
    positionLoading,
    positionTokenList,
    swapProLoadSupportNetworksTokenListRun,
  } = useSwapProSupportNetworksTokenList(
    supportNetworksList,
    supportNetworksReady,
    { stockOnly: true },
  );
  const handleOpenStockTokenSelector = useOpenStockTokenSelector({
    defaultNetworkId: stockChannel.stockNetworkId || undefined,
    storeName,
  });
  const filterToken = useMemo(() => {
    if (!swapProEnableCurrentSymbol) {
      return undefined;
    }
    return [swapFromToken, swapToToken].filter(
      (token): token is ISwapToken => !!token,
    );
  }, [swapFromToken, swapProEnableCurrentSymbol, swapToToken]);
  const handlePositionPress = useCallback(
    (token: ISwapToken) => {
      if (token.isStock) {
        selectStockSwapToken(token, { resetReceiveAmount: true });
        return;
      }
      void setSwapTypeSwitch(ESwapTabSwitchType.SWAP);
      onTokenPress?.(token);
    },
    [onTokenPress, selectStockSwapToken, setSwapTypeSwitch],
  );

  const [activeStockTab, setActiveStockTab] = useState<'position' | 'history'>(
    'position',
  );
  const retryPositions = useCallback(() => {
    void swapProLoadSupportNetworksTokenListRun(supportNetworksList, {
      forceRefresh: true,
      stockOnly: true,
    });
  }, [supportNetworksList, swapProLoadSupportNetworksTokenListRun]);

  return (
    <YStack mt="$2">
      <XStack
        bg="$bgApp"
        borderBottomWidth="$0.5"
        borderBottomColor="$borderSubdued"
        justifyContent="space-between"
        alignItems="center"
      >
        <XStack gap="$5" bg="$bgApp">
          <XStack
            py="$2"
            borderBottomWidth="$0.5"
            borderBottomColor={
              activeStockTab === 'position' ? '$borderActive' : 'transparent'
            }
            mb={-2}
            cursor="pointer"
            onPress={() => setActiveStockTab('position')}
          >
            <SizableText
              size="$bodyMdMedium"
              color={activeStockTab === 'position' ? '$text' : '$textSubdued'}
              pr="$0.5"
            >
              {intl.formatMessage({
                id: ETranslations.perp_position_title,
              })}
            </SizableText>
          </XStack>
          <XStack
            py="$2"
            borderBottomWidth="$0.5"
            borderBottomColor={
              activeStockTab === 'history' ? '$borderActive' : 'transparent'
            }
            mb={-2}
            cursor="pointer"
            onPress={() => setActiveStockTab('history')}
          >
            <SizableText
              size="$bodyMdMedium"
              color={activeStockTab === 'history' ? '$text' : '$textSubdued'}
              pr="$0.5"
            >
              {intl.formatMessage({
                id: ETranslations.Limit_order_history,
              })}
            </SizableText>
          </XStack>
        </XStack>
      </XStack>
      <YStack display={activeStockTab === 'position' ? 'flex' : 'none'}>
        <YStack>
          <SwapProCurrentSymbolEnable isStock />
        </YStack>
        <YStack minHeight={180}>
          <SwapProPositionsList
            onTokenPress={handlePositionPress}
            onSearchClick={handleOpenStockTokenSelector}
            filterToken={filterToken}
            positionTokenList={positionTokenList}
            positionLoadError={positionLoadError}
            positionLoading={positionLoading}
            onRetry={retryPositions}
            stockOnly
            hideSearch
          />
        </YStack>
      </YStack>
      <YStack
        display={activeStockTab === 'history' ? 'flex' : 'none'}
        minHeight={180}
      >
        <XStack mx="$-6">
          <SwapMarketHistoryList
            protocol={EProtocolOfExchange.STOCK}
            isPushModal
            firstSectionRightAction={
              <SwapHistoryClearButton scope="stock" triggerVariant="icon" />
            }
          />
        </XStack>
      </YStack>
    </YStack>
  );
}

function StockMarketChartEmptyState() {
  const intl = useIntl();
  return (
    <YStack
      h={274}
      w="100%"
      alignItems="center"
      justifyContent="center"
      gap="$2"
      bg="$bgSubdued"
      borderRadius="$3"
    >
      <Icon name="InfoCircleOutline" size="$6" color="$iconSubdued" />
      <SizableText size="$bodyMdMedium" color="$textSubdued">
        {intl.formatMessage({ id: ETranslations.global_no_data })}
      </SizableText>
    </YStack>
  );
}

function StockMarketContextPanel({
  storeName,
}: {
  storeName: EJotaiContextStoreNames;
}) {
  const { stockChannel, tokenDetail, tokenAddress, networkId, isNative } =
    useCurrentStockMarketDetail();
  const { coinGeckoId, isLoading: isCoinGeckoIdLoading } =
    useStockChartCoinGeckoId({
      networkId,
      tokenAddress,
      tokenDetail,
    });
  const [range, setRange] = useState<IStockChartRange>(
    STOCK_CHART_DEFAULT_RANGE,
  );
  const chartReady =
    !!networkId && !!tokenDetail?.stock && !!tokenDetail?.symbol;
  const marketPanelLoading = isStockMarketPanelLoadingStage(
    stockChannel.channelStage,
  );
  // Only pulse the chart tail while the market is open (live updating).
  const isMarketOpen = stockChannel.stockMarketStatus?.open === true;
  let chartContent: ReactNode;
  if (chartReady || marketPanelLoading) {
    chartContent = (
      <StockPriceChart
        coinGeckoId={coinGeckoId}
        coinGeckoIdLoading={isCoinGeckoIdLoading}
        tokenAddress={tokenAddress ?? ''}
        networkId={networkId ?? ''}
        isNative={isNative}
        range={range}
        onRangeChange={setRange}
        pulseLastPoint={isMarketOpen}
        realtimeChartPoint={stockChannel.realtimeChartPoint}
      />
    );
  } else {
    chartContent = <StockMarketChartEmptyState />;
  }

  return (
    <YStack
      testID={SwapTestIDs.stockMarketPanel}
      width="100%"
      minWidth={0}
      minHeight={623}
      p="$6"
      borderWidth={1}
      borderColor="$borderSubdued"
      borderRadius="$6"
      bg="$bgApp"
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
      <StockMarketTokenHeader
        storeName={storeName}
        channelStage={stockChannel.channelStage}
      />

      <Stack mt="$6">{chartContent}</Stack>

      <Divider mt="$2.5" mb="$3" />
      <StockMarketDataGrid tokenDetail={tokenDetail} />
      <SwapStockTokenDetails
        tokenDetail={tokenDetail}
        networkId={networkId}
        loading={marketPanelLoading}
      />
    </YStack>
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
}: ISwapStockDesktopContainerProps) {
  const intl = useIntl();
  const [, setFromTokenAmount] = useSwapFromTokenAmountAtom();
  const [, setToTokenAmount] = useSwapToTokenAmountAtom();
  const stockChannel = useSwapStockTradeContext();
  const stockRecentTokenPairs = useSwapStockRecentTokenPairs();

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
    <ScrollView flex={1} contentContainerStyle={{ flexGrow: 1 }}>
      <SwapTipsContainer pageType={pageType} />
      <YStack
        width="100%"
        alignItems="center"
        pb="$5"
        pt={headerContent ? undefined : '$5'}
      >
        {headerContent ? (
          <YStack {...STOCK_DESKTOP_HEADER_SLOT_PROPS}>{headerContent}</YStack>
        ) : null}
        <YStack width="100%" maxWidth={STOCK_DESKTOP_CONTENT_MAX_WIDTH}>
          <XStack width="100%" gap="$1" px="$5" alignItems="flex-start">
            <YStack p="$5" flexBasis="50%" minWidth={0} gap="$12">
              <YStack
                width="100%"
                minWidth={0}
                minHeight={466}
                p="$6"
                borderWidth={1}
                borderColor="$borderSubdued"
                borderRadius="$6"
                bg="$bgApp"
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
                gap="$5"
              >
                <XStack alignItems="center" justifyContent="space-between">
                  <SizableText size="$headingLg" color="$text">
                    {intl.formatMessage({
                      id: ETranslations.perps_token_selector_stocks,
                    })}
                  </SizableText>
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
                />
                <SwapPendingHistoryListComponent
                  protocol={EProtocolOfExchange.STOCK}
                />
              </YStack>
              <SwapFAQ variant="stock" />
            </YStack>
            <YStack p="$5" flexBasis="50%" minWidth={0}>
              <StockMarketContextPanel storeName={storeName} />
            </YStack>
          </XStack>
        </YStack>
      </YStack>
    </ScrollView>
  );
}

export function SwapStockDesktopContainer(
  props: ISwapStockDesktopContainerProps,
) {
  return (
    <SwapStockTradeProvider>
      <SwapStockDesktopContent {...props} />
    </SwapStockTradeProvider>
  );
}

function SwapStockMobileContent(props: ISwapStockDesktopContainerProps) {
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
      <SwapTipsContainer pageType={props.pageType} />
      <YStack
        testID={SwapTestIDs.stockMobileContainer}
        // pt $1 + the header pill's py $1 puts the stock symbol at the same
        // vertical offset as Pro mode's (pt $2 -> symbol at 8px), so the
        // instrument name does not jump when switching tabs (OK-57348).
        pt="$1"
        px="$5"
        pb="$5"
        gap="$2"
        flex={1}
      >
        <StockMarketTokenHeader
          storeName={props.storeName}
          channelStage={stockChannel.channelStage}
          proAligned
        />
        <StockTradeTicket
          onSelectToken={props.onSelectToken}
          fetchLoading={props.fetchLoading}
          storeName={props.storeName}
          onSelectPercentageStage={props.onSelectPercentageStage}
          onBalanceMaxPress={props.onBalanceMaxPress}
          onPreSwap={props.onPreSwap}
          onToAnotherAddressModal={props.onToAnotherAddressModal}
          onOpenProviderList={props.onOpenProviderList}
          refreshAction={props.refreshAction}
          quoteResult={props.quoteResult}
          quoteLoading={props.quoteLoading}
          quoteEventFetching={props.quoteEventFetching}
          alerts={props.alerts}
          stockChannel={stockChannel}
          tradeSide={stockChannel.tradeSide}
          onTradeSideChange={handleTradeSideChange}
          recentTokenPairs={stockRecentTokenPairs}
          onSelectRecentTokenPairs={handleSelectRecentStockTokenPairs}
          compact
        />
        {isDesktopModalPage ? null : (
          <YStack mt="$2">
            <StockMobilePositionsSection
              onTokenPress={props.onTokenPress}
              supportNetworksList={props.supportNetworksList}
              supportNetworksReady={!props.fetchLoading}
              storeName={props.storeName}
            />
          </YStack>
        )}
      </YStack>
    </Keyboard.AwareScrollView>
  );
}

export function SwapStockMobileContainer(
  props: ISwapStockDesktopContainerProps,
) {
  return (
    <SwapStockTradeProvider>
      <SwapStockMobileContent {...props} />
    </SwapStockTradeProvider>
  );
}
