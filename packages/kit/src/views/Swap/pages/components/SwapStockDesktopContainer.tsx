import { useCallback, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';

import { useTheme } from '@tamagui/core';
import { useIntl } from 'react-intl';

import type { IPageNavigationProp } from '@onekeyhq/components';
import {
  Button,
  Divider,
  Empty,
  Icon,
  IconButton,
  KEYBOARD_AWARE_SCROLL_BOTTOM_OFFSET,
  Keyboard,
  NumberSizeableText,
  Popover,
  SegmentControl,
  SizableText,
  Skeleton,
  Stack,
  XStack,
  YStack,
  usePopoverContext,
  useScrollContentTabBarOffset,
} from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { AccountSelectorProviderMirror } from '@onekeyhq/kit/src/components/AccountSelector';
import { AmountInput } from '@onekeyhq/kit/src/components/AmountInput';
import { LightweightChart } from '@onekeyhq/kit/src/components/LightweightChart';
import { Token } from '@onekeyhq/kit/src/components/Token';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { useNetworkLogoUri } from '@onekeyhq/kit/src/hooks/useNetworkLogoUri';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import {
  useSwapFromTokenAmountAtom,
  useSwapToTokenAmountAtom,
} from '@onekeyhq/kit/src/states/jotai/contexts/swap';
import { BaseMarketTokenPrice } from '@onekeyhq/kit/src/views/Market/components/MarketTokenPrice';
import {
  StockIsOpenBadge,
  StockSourceLogo,
} from '@onekeyhq/kit/src/views/Market/components/PerpsBadges';
import { PriceChangePercentage } from '@onekeyhq/kit/src/views/Market/components/PriceChangePercentage';
import { isOndoStockSource } from '@onekeyhq/kit/src/views/Market/components/utils/stockSource';
import { PortfolioSkeleton } from '@onekeyhq/kit/src/views/Market/MarketDetailV2/components/InformationTabs/components/Portfolio/components/PortfolioSkeleton';
import { usePortfolioData } from '@onekeyhq/kit/src/views/Market/MarketDetailV2/components/InformationTabs/components/Portfolio/hooks/usePortfolioData';
import {
  PortfolioHeaderSmall,
  PortfolioItemSmall,
} from '@onekeyhq/kit/src/views/Market/MarketDetailV2/components/InformationTabs/components/Portfolio/layout';
import { useNetworkAccount } from '@onekeyhq/kit/src/views/Market/MarketDetailV2/components/InformationTabs/hooks/useNetworkAccount';
import { TokenList } from '@onekeyhq/kit/src/views/Market/MarketDetailV2/components/SwapPanel/components/TokenInputSection/TokenList';
import { TradeTypeSelector } from '@onekeyhq/kit/src/views/Market/MarketDetailV2/components/SwapPanel/components/TradeTypeSelector';
import { ESwapDirection } from '@onekeyhq/kit/src/views/Market/MarketDetailV2/components/SwapPanel/hooks/useTradeType';
import type { IToken } from '@onekeyhq/kit/src/views/Market/MarketDetailV2/components/SwapPanel/types';
import { useTokenDetail } from '@onekeyhq/kit/src/views/Market/MarketDetailV2/hooks/useTokenDetail';
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
import { EModalRoutes } from '@onekeyhq/shared/src/routes';
import type { IModalSwapParamList } from '@onekeyhq/shared/src/routes/swap';
import { EModalSwapRoutes } from '@onekeyhq/shared/src/routes/swap';
import { numberFormat } from '@onekeyhq/shared/src/utils/numberUtils';
import { EAccountSelectorSceneName } from '@onekeyhq/shared/types';
import type { IMarketTokenChart } from '@onekeyhq/shared/types/market';
import {
  EProtocolOfExchange,
  ESwapDirectionType,
  ESwapLimitOrderStatus,
  type IFetchQuoteResult,
  type IMarketPresetTokenContext,
  type ISwapAlertState,
  type ISwapToken,
} from '@onekeyhq/shared/types/swap/types';

import {
  ESwapStockChannelStage,
  ESwapStockTradeSide,
  type IUseSwapStockChannelReturn,
} from '../../hooks/useSwapStockChannel';
import {
  useSwapStockAmountInputState,
  useSwapStockEstimatedReceiveState,
} from '../../hooks/useSwapStockTradeInputs';
import { SwapTestIDs } from '../../testIDs';
import { getSwapMarketPendingHistoryCount } from '../../utils/swapMarketHistory';

import SwapActionsState from './SwapActionsState';
import SwapQuoteResult from './SwapQuoteResult';
import { SwapStockTradeAlert } from './SwapStockTradeAlert';
import {
  SwapStockTradeProvider,
  useSwapStockTradeContext,
} from './SwapStockTradeProvider';

import type { KeyboardAwareScrollViewRef } from 'react-native-keyboard-controller';

interface ISwapStockDesktopContainerProps {
  headerContent?: ReactNode;
  marketPresetToken?: IMarketPresetTokenContext;
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
  alerts: {
    states: ISwapAlertState[];
    quoteId: string;
  };
}

type IStockChartRange = '1D' | '1W' | '1M' | '1Y';
type IStockMarketTokenDetail = ReturnType<typeof useTokenDetail>['tokenDetail'];
type IStockMarketDataRow = {
  label: string;
  value: string;
  tooltip?: string;
};

const STOCK_CHART_RANGE_ITEMS: {
  label: IStockChartRange;
  interval: string;
  seconds: number;
}[] = [
  { label: '1D', interval: '1m', seconds: 24 * 60 * 60 },
  { label: '1W', interval: '1H', seconds: 7 * 24 * 60 * 60 },
  { label: '1M', interval: '4H', seconds: 30 * 24 * 60 * 60 },
  { label: '1Y', interval: '1D', seconds: 365 * 24 * 60 * 60 },
];
const STOCK_CHART_VISIBLE_HEIGHT = 174;
const STOCK_CHART_PRICE_SCALE_MARGINS = { top: 0.12, bottom: 0.1 } as const;
const STOCK_TRADE_SIDE_SWITCH_WIDTH = 176;

function normalizeStockChartData(points?: { t: number; c: number }[]) {
  const pointsByTime = new Map<number, number>();
  for (const point of points ?? []) {
    if (Number.isFinite(point.t) && Number.isFinite(point.c)) {
      pointsByTime.set(point.t, point.c);
    }
  }
  return Array.from(pointsByTime.entries())
    .toSorted((a, b) => a[0] - b[0])
    .map(([time, price]) => [time, price] as [number, number]);
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
      value: formatPercentValue(assetAnalysis?.turnoverRate),
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

function StockMarketDataGrid() {
  const intl = useIntl();
  const { tokenDetail } = useTokenDetail();
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
  const {
    canSelectReceiveToken,
    currencySymbol,
    isLoading,
    isSellSide,
    isReceiveTokenPopoverOpen,
    onReceiveTokenPress,
    receiveAmount,
    receiveFiatValue,
    receiveToken,
    setIsReceiveTokenPopoverOpen,
  } = useSwapStockEstimatedReceiveState({
    quoteEventFetching,
    quoteLoading,
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
      alignItems="center"
      justifyContent="flex-end"
      gap="$1"
      maxWidth="100%"
      minWidth={0}
      px="$1"
      py="$0.5"
      mr="$-1"
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
    <SizableText
      size="$bodyMdMedium"
      color="$text"
      numberOfLines={1}
      textAlign="right"
    >
      --
    </SizableText>
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
      <YStack flex={1} maxWidth={360} alignItems="flex-end" minWidth={0}>
        {isLoading ? (
          <>
            <Skeleton h="$4" w="$20" />
            <Skeleton mt="$1" h="$4" w="$16" />
          </>
        ) : (
          <>
            {receiveTokenContent}
            <NumberSizeableText
              size="$bodyMd"
              color="$textSubdued"
              formatter="value"
              formatterOptions={{
                currency: currencySymbol,
              }}
            >
              {receiveFiatValue || '0'}
            </NumberSizeableText>
          </>
        )}
      </YStack>
    </XStack>
  );
}

function StockActionGate({
  stockChannel,
  onPreSwap,
  onToAnotherAddressModal,
  onSelectPercentageStage,
}: {
  stockChannel: IUseSwapStockChannelReturn;
  onPreSwap: () => void;
  onToAnotherAddressModal: () => void;
  onSelectPercentageStage: (stage: number) => void;
}) {
  const intl = useIntl();
  const disabledLabel = useMemo(() => {
    switch (stockChannel.channelStage) {
      case ESwapStockChannelStage.InitializingStock:
      case ESwapStockChannelStage.CheckingMarketStatus:
      case ESwapStockChannelStage.InitializingPayToken:
        return intl.formatMessage({
          id: ETranslations.swap_page_button_enter_amount,
        });
      case ESwapStockChannelStage.MissingStock:
        return intl.formatMessage({
          id: ETranslations.swap_page_button_select_token,
        });
      case ESwapStockChannelStage.MissingPayToken:
      case ESwapStockChannelStage.MarketUnavailable:
        return intl.formatMessage({
          id: ETranslations.swap_page_alert_no_provider_supports_trade,
        });
      case ESwapStockChannelStage.MarketClosed:
        return intl.formatMessage({
          id: ETranslations.dexmarket_stock_status_closed_error,
        });
      default:
        return intl.formatMessage({
          id: ETranslations.swap_page_button_enter_amount,
        });
    }
  }, [intl, stockChannel.channelStage]);

  if (stockChannel.readyForQuote) {
    return (
      <SwapActionsState
        onPreSwap={onPreSwap}
        onOpenRecipientAddress={onToAnotherAddressModal}
        onSelectPercentageStage={onSelectPercentageStage}
      />
    );
  }

  return (
    <Button
      testID={SwapTestIDs.swapButton}
      size="large"
      variant="primary"
      disabled
      borderRadius="$full"
    >
      {disabledLabel}
    </Button>
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
    <YStack h={124} bg="$bgSubdued" borderRadius="$4" overflow="hidden">
      <SizableText pt="$3.5" px="$3.5" size="$bodyMd" color="$textSubdued">
        {intl.formatMessage({
          id: isBuySide ? ETranslations.global_pay : ETranslations.global_sell,
        })}
      </SizableText>
      <XStack flex={1} alignItems="center" justifyContent="space-between">
        <YStack px="$3.5" gap="$3">
          <Skeleton h="$8" w="$24" />
          <Skeleton h="$4" w="$16" />
        </YStack>
        <YStack px="$3.5" alignItems="flex-end" gap="$3">
          <Skeleton h="$8" w="$28" />
          <Skeleton h="$4" w="$24" />
        </YStack>
      </XStack>
    </YStack>
  );
}

function StockAmountInput({
  fetchLoading,
  onBalanceMaxPress,
  stockChannel,
}: Pick<
  ISwapStockDesktopContainerProps,
  'fetchLoading' | 'onBalanceMaxPress'
> & {
  stockChannel: IUseSwapStockChannelReturn;
}) {
  const intl = useIntl();
  const amountInputState = useSwapStockAmountInputState({ stockChannel });
  const {
    amountFiatValue,
    balanceLoading,
    currencySymbol,
    disableNativePayToken,
    displayBalance,
    inputToken,
    inputTokenNetworkLogoURI,
    inputValue,
    isBuySide,
    onAmountChange,
    payToken,
    payTokenOptionsLoading,
    payTokens,
    selectablePayTokens,
    selectPayToken,
    shouldRenderSkeleton,
  } = amountInputState;

  if (shouldRenderSkeleton) {
    return <StockAmountInputSkeleton isBuySide={isBuySide} />;
  }

  return (
    <YStack h={124} bg="$bgSubdued" borderRadius="$4" overflow="hidden">
      <SizableText pt="$3.5" px="$3.5" size="$bodyMd" color="$textSubdued">
        {intl.formatMessage({
          id: isBuySide ? ETranslations.global_pay : ETranslations.global_sell,
        })}
      </SizableText>
      <AmountInput
        value={inputValue}
        onChange={onAmountChange}
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
          onPress: onBalanceMaxPress,
          hideIcon: true,
          tokenSymbol: inputToken?.symbol,
          testID: SwapTestIDs.maxButton,
        }}
        maxAmountText={intl.formatMessage({ id: ETranslations.global_max })}
        inputProps={{
          placeholder: '0.0',
          testID: SwapTestIDs.fromAmountInput,
        }}
        tokenSelectorTriggerProps={{
          testID: SwapTestIDs.fromTokenSelector,
          minWidth: 132,
          justifyContent: 'flex-end',
          loading: fetchLoading || (isBuySide && payTokenOptionsLoading),
          selectedTokenImageUri: inputToken?.logoURI,
          selectedNetworkImageUri: inputTokenNetworkLogoURI,
          selectedTokenSymbol: inputToken?.symbol,
          showNetworkIconBorder: false,
          disabled: !isBuySide || selectablePayTokens.length <= 1,
          popover:
            isBuySide && payTokens.length > 1
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
        enableMaxAmount
      />
    </YStack>
  );
}

function StockTradeTicket({
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
  stockChannel,
  tradeSide,
  onTradeSideChange,
  compact,
}: Omit<
  ISwapStockDesktopContainerProps,
  'headerContent' | 'marketPresetToken' | 'storeName'
> & {
  stockChannel: IUseSwapStockChannelReturn;
  tradeSide: ESwapStockTradeSide;
  onTradeSideChange: (value: ESwapStockTradeSide) => void;
  compact?: boolean;
}) {
  return (
    <YStack gap={compact ? '$3' : '$4'}>
      <StockTradeSideSwitch value={tradeSide} onChange={onTradeSideChange} />
      <StockAmountInput
        fetchLoading={fetchLoading}
        onBalanceMaxPress={onBalanceMaxPress}
        stockChannel={stockChannel}
      />
      <StockEstimatedReceive
        quoteResult={quoteResult}
        quoteLoading={quoteLoading}
        quoteEventFetching={quoteEventFetching}
        stockChannel={stockChannel}
      />
      <StockActionGate
        stockChannel={stockChannel}
        onPreSwap={onPreSwap}
        onToAnotherAddressModal={onToAnotherAddressModal}
        onSelectPercentageStage={onSelectPercentageStage}
      />
      <SwapStockTradeAlert
        alerts={alerts}
        quoteEventFetching={quoteEventFetching}
        quoteLoading={quoteLoading}
        quoteResult={quoteResult}
        stockChannel={stockChannel}
      />
      {stockChannel.readyForQuote ? (
        <SwapQuoteResult
          refreshAction={refreshAction}
          onOpenProviderList={onOpenProviderList}
          quoteResult={quoteResult}
        />
      ) : null}
    </YStack>
  );
}

function StockMarketHeaderSkeleton() {
  return (
    <XStack alignItems="center" justifyContent="space-between" h="$13">
      <XStack alignItems="center" gap="$2.5">
        <Skeleton w="$8" h="$8" radius="round" />
        <YStack gap="$1">
          <Skeleton h="$6" w="$24" />
          <Skeleton h="$4" w="$32" />
        </YStack>
      </XStack>
      <YStack alignItems="flex-end" gap="$1">
        <Skeleton h="$6" w="$16" />
        <Skeleton h="$4" w="$12" />
      </YStack>
    </XStack>
  );
}

function StockMarketTokenHeader({
  storeName,
  compact,
}: {
  storeName: EJotaiContextStoreNames;
  compact?: boolean;
}) {
  const { tokenDetail, networkId } = useTokenDetail();
  const navigation = useAppNavigation();
  const stockTokenNetworkId = tokenDetail?.networkId ?? networkId;
  const effectiveNetworkLogoUri = useNetworkLogoUri({
    logoUri: undefined,
    networkId: stockTokenNetworkId,
  });
  const stock = tokenDetail?.stock;
  const handleOpenStockTokenSelector = useCallback(() => {
    dismissKeyboard();
    navigation.pushModal(EModalRoutes.SwapModal, {
      screen: EModalSwapRoutes.SwapTokenSelect,
      params: {
        type: ESwapDirectionType.FROM,
        storeName,
        selectTarget: 'swapStock',
        defaultNetworkId: stockTokenNetworkId,
      },
    });
  }, [navigation, stockTokenNetworkId, storeName]);

  if (!tokenDetail) {
    return <StockMarketHeaderSkeleton />;
  }

  return (
    <XStack
      testID={SwapTestIDs.stockMarketTokenHeader}
      alignItems="flex-start"
      justifyContent="space-between"
      minHeight={compact ? '$11' : undefined}
      gap="$3"
    >
      <YStack minWidth={0} flex={1} gap="$1">
        {compact ? (
          <XStack
            gap="$2.5"
            alignItems="center"
            cursor="pointer"
            bg="$transparent"
            px="$0"
            py="$0"
            borderRadius="$full"
            hoverStyle={{ bg: '$bgHover' }}
            pressStyle={{ bg: '$bgActive' }}
            onPress={handleOpenStockTokenSelector}
          >
            <Token
              size="md"
              tokenImageUri={tokenDetail.logoUrl}
              tokenImageUris={tokenDetail.logoUrls}
              networkImageUri={effectiveNetworkLogoUri}
              showNetworkIconBorder={false}
              bg="$transparent"
              fallbackIcon="CryptoCoinOutline"
            />
            <SizableText
              size="$headingSm"
              color="$text"
              numberOfLines={1}
              ellipsizeMode="tail"
              maxWidth="$32"
              flexShrink={1}
            >
              {tokenDetail.symbol}
            </SizableText>
            <Icon
              name="ChevronDownSmallOutline"
              size="$5"
              color="$iconSubdued"
            />
          </XStack>
        ) : (
          <XStack
            gap="$2.5"
            alignItems="center"
            cursor="pointer"
            bg="$transparent"
            px="$0"
            py="$0"
            borderRadius="$full"
            hoverStyle={{ bg: '$bgHover' }}
            pressStyle={{ bg: '$bgActive' }}
            onPress={handleOpenStockTokenSelector}
          >
            <Token
              size="md"
              tokenImageUri={tokenDetail.logoUrl}
              tokenImageUris={tokenDetail.logoUrls}
              networkImageUri={effectiveNetworkLogoUri}
              showNetworkIconBorder={false}
              bg="$transparent"
              fallbackIcon="CryptoCoinOutline"
            />
            <SizableText
              size="$headingSm"
              color="$text"
              numberOfLines={1}
              ellipsizeMode="tail"
              maxWidth="$32"
              flexShrink={1}
            >
              {tokenDetail.symbol}
            </SizableText>
            <Icon
              name="ChevronDownSmallOutline"
              size="$5"
              color="$iconSubdued"
            />
          </XStack>
        )}
        <XStack ml="$10" alignItems="center" gap="$1" minHeight="$5">
          {stock?.subtitle ? (
            <SizableText size="$bodySm" color="$textSubdued" numberOfLines={1}>
              {stock.subtitle}
            </SizableText>
          ) : null}
          <StockSourceLogo stock={stock} />
          {stock ? <StockIsOpenBadge stock={stock} /> : null}
        </XStack>
      </YStack>
      <YStack alignItems="flex-end" minWidth={compact ? '$20' : '$24'}>
        <BaseMarketTokenPrice
          size={compact ? '$bodyLg' : '$bodyLg'}
          color="$text"
          price={tokenDetail.price ?? tokenDetail.priceConverted ?? ''}
          tokenName={tokenDetail.name}
          tokenSymbol={tokenDetail.symbol}
          lastUpdated={String(tokenDetail.lastUpdated ?? '')}
          currency="$"
        />
        <PriceChangePercentage size="$bodySm">
          {tokenDetail.priceChange24hPercent}
        </PriceChangePercentage>
      </YStack>
    </XStack>
  );
}

function StockPriceChart({
  isNative,
  networkId,
  tokenAddress,
  tokenSymbol,
}: {
  isNative?: boolean;
  networkId?: string;
  tokenAddress?: string;
  tokenSymbol?: string;
}) {
  const intl = useIntl();
  const theme = useTheme();
  const [range, setRange] = useState<IStockChartRange>('1D');
  const chartLineColor = theme.textSuccess.val;
  const rangeOptions = useMemo(
    () =>
      STOCK_CHART_RANGE_ITEMS.map((item) => ({
        label: item.label,
        value: item.label,
        testID: `swap-stock-chart-range-${item.label}`,
      })),
    [],
  );
  const handleRangeChange = useCallback((value: string | number) => {
    setRange(value as IStockChartRange);
  }, []);
  const chartTitle = useMemo(() => {
    const chartLabel = intl.formatMessage({
      id: ETranslations.market_chart,
    });
    return tokenSymbol ? `${tokenSymbol} ${chartLabel}` : chartLabel;
  }, [intl, tokenSymbol]);
  const activeRange = useMemo(
    () => STOCK_CHART_RANGE_ITEMS.find((item) => item.label === range),
    [range],
  );
  const chartScope = `${networkId ?? ''}:${tokenAddress ?? ''}:${
    isNative ? 'native' : 'token'
  }:${range}`;
  const { result: chartState, isLoading } = usePromiseResult(
    async () => {
      if (!networkId || (!tokenAddress && !isNative) || !activeRange) {
        return {
          scope: chartScope,
          data: [] as IMarketTokenChart,
        };
      }
      const timeTo = Math.floor(Date.now() / 1000);
      const timeFrom = timeTo - activeRange.seconds;
      const response =
        await backgroundApiProxy.serviceMarketV2.fetchMarketTokenKline({
          tokenAddress: tokenAddress ?? '',
          networkId,
          interval: activeRange.interval,
          timeFrom,
          timeTo,
          autoHandleError: false,
        });
      return {
        scope: chartScope,
        data: normalizeStockChartData(response?.points),
      };
    },
    [activeRange, chartScope, isNative, networkId, tokenAddress],
    {
      initResult: {
        scope: '',
        data: [] as IMarketTokenChart,
      },
      watchLoading: true,
    },
  );
  const chartData =
    chartState.scope === chartScope
      ? chartState.data
      : ([] as IMarketTokenChart);
  const priceFormatter = useCallback(
    (price: number) =>
      numberFormat(String(price), {
        formatter: 'price',
        formatterOptions: { currency: '$' },
      }),
    [],
  );

  let chartContent: ReactNode = (
    <YStack flex={1} alignItems="center" justifyContent="center">
      <SizableText size="$bodySm" color="$textSubdued">
        --
      </SizableText>
    </YStack>
  );
  if (isLoading) {
    chartContent = <Skeleton w="100%" h="100%" />;
  } else if (chartData.length > 0) {
    chartContent = (
      <LightweightChart
        data={chartData}
        height={STOCK_CHART_VISIBLE_HEIGHT}
        lineColor={chartLineColor}
        lineWidth={1}
        secondaryLineData={chartData}
        secondaryLineColor={chartLineColor}
        secondaryLineWidth={2}
        seriesType="dotted-area"
        showLastPointMarker={false}
        showTimeScale={false}
        priceScaleMargins={STOCK_CHART_PRICE_SCALE_MARGINS}
        priceFormatter={priceFormatter}
        fontSize={11}
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
        justifyContent="space-between"
        gap="$3"
      >
        <SizableText
          size="$bodyLgMedium"
          color="$text"
          numberOfLines={1}
          w={180}
          flexShrink={1}
        >
          {chartTitle}
        </SizableText>
        <SegmentControl
          w={156}
          h="$5"
          fullWidth
          value={range}
          options={rangeOptions}
          onChange={handleRangeChange}
          slotBackgroundColor="$transparent"
          activeBackgroundColor="$transparent"
          activeTextColor="$text"
          inactiveTextColor="$textSubdued"
          segmentControlItemStyleProps={{
            h: '$5',
            minWidth: '$5',
            py: '$0',
            px: '$0',
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

function StockMobilePositionsSection() {
  const intl = useIntl();
  const { tokenAddress, networkId } = useTokenDetail();
  const { accountAddress, xpub } = useNetworkAccount(networkId ?? '');
  const { portfolioData, isRefreshing } = usePortfolioData({
    tokenAddress: tokenAddress ?? '',
    networkId: networkId ?? '',
    accountAddress,
    xpub,
  });
  let positionsContent: ReactNode;
  if (isRefreshing && portfolioData.length === 0) {
    positionsContent = <PortfolioSkeleton />;
  } else if (portfolioData.length > 0) {
    positionsContent = (
      <YStack>
        {portfolioData.map((item) => (
          <PortfolioItemSmall
            key={`${item.accountAddress}-${item.tokenAddress}`}
            item={item}
          />
        ))}
      </YStack>
    );
  } else {
    positionsContent = (
      <Empty
        description={intl.formatMessage({
          id: ETranslations.dexmarket_details_nodata,
        })}
        pt="$16"
      />
    );
  }

  return (
    <YStack mx="$-5" mt="$2">
      <XStack
        px="$5"
        h="$10"
        alignItems="flex-end"
        borderBottomWidth="$px"
        borderBottomColor="$borderSubdued"
      >
        <YStack
          h="$10"
          justifyContent="center"
          borderBottomWidth={2}
          borderBottomColor="$borderActive"
        >
          <SizableText size="$bodyMdMedium" color="$text">
            {intl.formatMessage({
              id: ETranslations.dexmarket_details_myposition,
            })}
          </SizableText>
        </YStack>
      </XStack>
      <PortfolioHeaderSmall />
      <YStack minHeight={180}>{positionsContent}</YStack>
    </YStack>
  );
}

function StockMarketContextPanel({
  storeName,
}: {
  storeName: EJotaiContextStoreNames;
}) {
  const { tokenDetail, tokenAddress, networkId, isNative } = useTokenDetail();
  const chartReady = !!networkId && !!tokenDetail?.symbol;

  return (
    <YStack
      testID={SwapTestIDs.stockMarketPanel}
      w={526}
      flexShrink={0}
      minHeight={623}
      p="$6"
      borderWidth="$px"
      borderColor="$borderSubdued"
      borderRadius="$5"
      bg="$bgApp"
    >
      <StockMarketTokenHeader storeName={storeName} />

      <Stack mt="$6" mb="$2.5" mx="$-px">
        {chartReady ? (
          <StockPriceChart
            tokenAddress={tokenAddress ?? ''}
            networkId={networkId ?? ''}
            isNative={isNative}
            tokenSymbol={tokenDetail?.symbol}
          />
        ) : (
          <Skeleton w="100%" h={274} />
        )}
      </Stack>

      <Divider mb="$3" />
      <StockMarketDataGrid />
    </YStack>
  );
}

function SwapStockDesktopContent({
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
  const navigation =
    useAppNavigation<IPageNavigationProp<IModalSwapParamList>>();
  const [, setFromTokenAmount] = useSwapFromTokenAmountAtom();
  const [, setToTokenAmount] = useSwapToTokenAmountAtom();
  const [{ swapHistoryPendingList, swapLimitOrders }] =
    useInAppNotificationAtom();
  const stockChannel = useSwapStockTradeContext();
  const swapMarketPendingHistoryCount = useMemo(
    () =>
      getSwapMarketPendingHistoryCount(
        swapHistoryPendingList,
        EProtocolOfExchange.SWAP,
      ),
    [swapHistoryPendingList],
  );
  const limitPendingHistoryCount = useMemo(
    () =>
      swapLimitOrders.filter(
        (item) =>
          item.status === ESwapLimitOrderStatus.OPEN ||
          item.status === ESwapLimitOrderStatus.PRESIGNATURE_PENDING,
      ).length,
    [swapLimitOrders],
  );
  const historyBadgeCount =
    swapMarketPendingHistoryCount + limitPendingHistoryCount;

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

  const onOpenHistoryListModal = useCallback(() => {
    dismissKeyboard();
    navigation.pushModal(EModalRoutes.SwapModal, {
      screen: EModalSwapRoutes.SwapHistoryList,
      params: {
        type: EProtocolOfExchange.SWAP,
        storeName,
      },
    });
  }, [navigation, storeName]);

  return (
    <YStack width="100%" alignItems="center" pt="$5" pb="$5">
      <YStack width="100%" maxWidth={960} gap="$7">
        {headerContent ? (
          <XStack h="$14" alignItems="center" justifyContent="center">
            {headerContent}
          </XStack>
        ) : null}
        <XStack width="100%" gap="$6" alignItems="flex-start">
          <YStack
            w={410}
            flexShrink={0}
            minHeight={466}
            p="$6"
            borderWidth="$px"
            borderColor="$borderSubdued"
            borderRadius="$5"
            bg="$bgApp"
            gap="$5"
          >
            <XStack alignItems="center" justifyContent="space-between">
              <SizableText size="$headingLg" color="$text">
                {intl.formatMessage({
                  id: ETranslations.perps_token_selector_stocks,
                })}
              </SizableText>
              {historyBadgeCount > 0 ? (
                <Stack
                  testID="swap-stock-history-button"
                  w="$5"
                  h="$5"
                  userSelect="none"
                  borderRadius="$full"
                  borderColor="$icon"
                  borderWidth={1.2}
                  alignItems="center"
                  justifyContent="center"
                  hoverStyle={{
                    bg: '$bgHover',
                  }}
                  pressStyle={{
                    bg: '$bgActive',
                  }}
                  focusVisibleStyle={{
                    outlineColor: '$focusRing',
                    outlineWidth: 2,
                    outlineStyle: 'solid',
                    outlineOffset: 0,
                  }}
                  onPress={onOpenHistoryListModal}
                >
                  <SizableText color="$text" size="$bodySm">
                    {`${historyBadgeCount}`}
                  </SizableText>
                </Stack>
              ) : (
                <IconButton
                  testID="swap-stock-history-button"
                  icon="ClockTimeHistoryOutline"
                  size="small"
                  variant="tertiary"
                  onPress={onOpenHistoryListModal}
                />
              )}
            </XStack>
            <StockTradeTicket
              onSelectToken={onSelectToken}
              fetchLoading={fetchLoading}
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
            />
          </YStack>
          <StockMarketContextPanel storeName={storeName} />
        </XStack>
      </YStack>
    </YStack>
  );
}

export function SwapStockDesktopContainer(
  props: ISwapStockDesktopContainerProps,
) {
  const { tokenDetail } = useTokenDetail();

  return (
    <SwapStockTradeProvider
      marketPresetToken={props.marketPresetToken}
      disableNativePayToken={isOndoStockSource(tokenDetail?.stock?.source)}
    >
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

  return (
    <Keyboard.AwareScrollView
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="on-drag"
      ref={scrollViewRef}
      showsVerticalScrollIndicator={false}
      contentContainerStyle={{ paddingBottom: tabBarHeight }}
      bottomOffset={bottomOffset}
    >
      <YStack
        testID={SwapTestIDs.stockMobileContainer}
        pt="$2.5"
        px="$5"
        pb="$5"
        gap="$4"
        flex={1}
      >
        <StockMarketTokenHeader storeName={props.storeName} compact />
        <StockTradeTicket
          onSelectToken={props.onSelectToken}
          fetchLoading={props.fetchLoading}
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
          compact
        />
        <StockMobilePositionsSection />
      </YStack>
    </Keyboard.AwareScrollView>
  );
}

export function SwapStockMobileContainer(
  props: ISwapStockDesktopContainerProps,
) {
  const { tokenDetail } = useTokenDetail();

  return (
    <SwapStockTradeProvider
      marketPresetToken={props.marketPresetToken}
      disableNativePayToken={isOndoStockSource(tokenDetail?.stock?.source)}
    >
      <SwapStockMobileContent {...props} />
    </SwapStockTradeProvider>
  );
}
