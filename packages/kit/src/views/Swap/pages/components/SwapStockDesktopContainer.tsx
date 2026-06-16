import { useCallback, useMemo, useState } from 'react';
import type { ReactNode } from 'react';

import BigNumber from 'bignumber.js';
import { useIntl } from 'react-intl';

import type { IPageNavigationProp } from '@onekeyhq/components';
import {
  Divider,
  Icon,
  IconButton,
  NumberSizeableText,
  SizableText,
  Skeleton,
  Stack,
  XStack,
  YStack,
  usePopoverContext,
} from '@onekeyhq/components';
import { AccountSelectorProviderMirror } from '@onekeyhq/kit/src/components/AccountSelector';
import { AmountInput } from '@onekeyhq/kit/src/components/AmountInput';
import { TRADING_VIEW_DISABLED_FEATURES } from '@onekeyhq/kit/src/components/TradingView/TradingViewV2';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import {
  useSwapFromTokenAmountAtom,
  useSwapSelectToTokenAtom,
  useSwapSelectTokenDetailFetchingAtom,
  useSwapSelectedFromTokenBalanceAtom,
  useSwapToTokenAmountAtom,
} from '@onekeyhq/kit/src/states/jotai/contexts/swap';
import { validateAmountInput } from '@onekeyhq/kit/src/utils/validateAmountInput';
import { BaseMarketTokenPrice } from '@onekeyhq/kit/src/views/Market/components/MarketTokenPrice';
import {
  StockIsOpenBadge,
  StockSourceLogo,
} from '@onekeyhq/kit/src/views/Market/components/PerpsBadges';
import { PriceChangePercentage } from '@onekeyhq/kit/src/views/Market/components/PriceChangePercentage';
import { isOndoStockSource } from '@onekeyhq/kit/src/views/Market/components/utils/stockSource';
import { MarketTradingView } from '@onekeyhq/kit/src/views/Market/MarketDetailV2/components/MarketTradingView/MarketTradingView';
import { TokenList } from '@onekeyhq/kit/src/views/Market/MarketDetailV2/components/SwapPanel/components/TokenInputSection/TokenList';
import type { IToken } from '@onekeyhq/kit/src/views/Market/MarketDetailV2/components/SwapPanel/types';
import { MarketTokenSelector } from '@onekeyhq/kit/src/views/Market/MarketDetailV2/components/TokenSelector/MarketTokenSelector';
import { useTokenDetail } from '@onekeyhq/kit/src/views/Market/MarketDetailV2/hooks/useTokenDetail';
import {
  formatCurrencyStatValue,
  formatMarketCapValue,
  formatPercentValue,
} from '@onekeyhq/kit/src/views/Market/MarketDetailV2/utils/statValue';
import type { EJotaiContextStoreNames } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { useSettingsPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { presetNetworksMap } from '@onekeyhq/shared/src/config/presetNetworks';
import { dismissKeyboard } from '@onekeyhq/shared/src/keyboard';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { EModalRoutes } from '@onekeyhq/shared/src/routes';
import type { IModalSwapParamList } from '@onekeyhq/shared/src/routes/swap';
import { EModalSwapRoutes } from '@onekeyhq/shared/src/routes/swap';
import { EAccountSelectorSceneName } from '@onekeyhq/shared/types';
import {
  EProtocolOfExchange,
  type ESwapDirectionType,
  type IFetchQuoteResult,
  type IMarketPresetTokenContext,
  type ISwapAlertState,
  type ISwapToken,
} from '@onekeyhq/shared/types/swap/types';

import {
  ESwapStockTradeSide,
  type IUseSwapStockChannelReturn,
  useSwapStockChannel,
} from '../../hooks/useSwapStockChannel';
import { SwapTestIDs } from '../../testIDs';

import SwapActionsState from './SwapActionsState';
import SwapAlertContainer from './SwapAlertContainer';
import SwapQuoteResult from './SwapQuoteResult';

const STOCK_CHART_DISABLED_FEATURES = [
  TRADING_VIEW_DISABLED_FEATURES.VOLUME,
] as const;

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

function StockMarketDataItem({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <YStack
      flex={1}
      minWidth={0}
      h={44}
      px="$3.5"
      py="$1"
      borderRadius="$3"
      bg="$bgStrong"
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
      </XStack>
      <SizableText size="$bodyMd" color="$text" numberOfLines={1}>
        {value}
      </SizableText>
    </YStack>
  );
}

function StockMarketDataGrid() {
  const intl = useIntl();
  const { tokenDetail } = useTokenDetail();
  const assetAnalysis = tokenDetail?.stock?.assetAnalysis;
  const rows = useMemo(
    () => [
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
          id: ETranslations.dexmarket_stock_1y_avg_daily_vol,
        }),
        value: formatCurrencyStatValue(assetAnalysis?.avgDailyVolume1y),
      },
      {
        label: intl.formatMessage({
          id: ETranslations.dexmarket_stock_52_week_high,
        }),
        value: formatCurrencyStatValue(assetAnalysis?.weekHigh52),
      },
      {
        label: intl.formatMessage({
          id: ETranslations.dexmarket_stock_52_week_low,
        }),
        value: formatCurrencyStatValue(assetAnalysis?.weekLow52),
      },
    ],
    [assetAnalysis, intl, tokenDetail?.volume24h],
  );

  return (
    <YStack gap="$3">
      <SizableText size="$bodyMdMedium" color="$text">
        Market data
      </SizableText>
      <YStack gap={14}>
        {[0, 2, 4].map((rowStart) => (
          <XStack key={rowStart} gap={14} w="100%">
            {rows.slice(rowStart, rowStart + 2).map((item) => (
              <StockMarketDataItem
                key={item.label}
                label={item.label}
                value={item.value}
              />
            ))}
          </XStack>
        ))}
      </YStack>
    </YStack>
  );
}

function StockTradeSideSwitch({
  value,
  onChange,
}: {
  value: ESwapStockTradeSide;
  onChange: (value: ESwapStockTradeSide) => void;
}) {
  const intl = useIntl();
  const isBuyActive = value === ESwapStockTradeSide.Buy;
  const isSellActive = value === ESwapStockTradeSide.Sell;
  return (
    <XStack
      w={141}
      h={36}
      p="$0.5"
      borderRadius="$3"
      bg="$bgStrong"
      overflow="hidden"
    >
      <YStack
        flex={1}
        alignItems="center"
        justifyContent="center"
        borderRadius="$2.5"
        bg={isBuyActive ? '$bgSuccessStrong' : '$transparent'}
        userSelect="none"
        onPress={() => onChange(ESwapStockTradeSide.Buy)}
      >
        <SizableText
          size="$bodyMdMedium"
          color={isBuyActive ? '$textOnColor' : '$textSubdued'}
        >
          {intl.formatMessage({ id: ETranslations.global_buy })}
        </SizableText>
      </YStack>
      <YStack
        flex={1}
        alignItems="center"
        justifyContent="center"
        borderRadius="$2.5"
        bg={isSellActive ? '$bgCriticalStrong' : '$transparent'}
        userSelect="none"
        onPress={() => onChange(ESwapStockTradeSide.Sell)}
      >
        <SizableText
          size="$bodyMdMedium"
          color={isSellActive ? '$textOnColor' : '$textSubdued'}
        >
          {intl.formatMessage({ id: ETranslations.global_sell })}
        </SizableText>
      </YStack>
    </XStack>
  );
}

function StockEstimatedReceive({
  quoteResult,
}: {
  quoteResult?: IFetchQuoteResult;
}) {
  const intl = useIntl();
  const [toToken] = useSwapSelectToTokenAtom();
  const [toTokenAmount] = useSwapToTokenAmountAtom();
  const [settingsPersistAtom] = useSettingsPersistAtom();
  const receiveAmount = quoteResult?.toAmount ?? toTokenAmount.value;
  const receiveFiatValue = useMemo(() => {
    const amountBN = new BigNumber(receiveAmount ?? 0);
    const priceBN = new BigNumber(toToken?.price ?? 0);
    const fiatBN = amountBN.multipliedBy(priceBN);
    if (fiatBN.isNaN() || fiatBN.isZero()) {
      return '';
    }
    return fiatBN.toFixed();
  }, [receiveAmount, toToken?.price]);

  return (
    <XStack alignItems="center" gap="$2" h="$12">
      <XStack alignItems="center" gap="$1" flexShrink={0}>
        <Icon name="HandCoinsOutline" size="$4.5" color="$iconSubdued" />
        <SizableText
          size="$bodyMd"
          color="$text"
          textDecorationLine="underline"
        >
          {intl.formatMessage({
            id: ETranslations.private_send_estimated_received,
          })}
        </SizableText>
      </XStack>
      <YStack flex={1} alignItems="flex-end" minWidth={0}>
        <SizableText size="$bodyMdMedium" color="$text" numberOfLines={1}>
          {receiveAmount && toToken?.symbol
            ? `${receiveAmount} ${toToken.symbol}`
            : '--'}
        </SizableText>
        <XStack alignItems="center" gap="$1">
          <NumberSizeableText
            size="$bodyMd"
            color="$textSubdued"
            formatter="value"
            formatterOptions={{
              currency: settingsPersistAtom.currencyInfo.symbol,
            }}
          >
            {receiveFiatValue || '0'}
          </NumberSizeableText>
        </XStack>
      </YStack>
    </XStack>
  );
}

function getNetworkLogoURI(networkId?: string) {
  if (!networkId) {
    return undefined;
  }
  return Object.values(presetNetworksMap).find(
    (network) => network.id === networkId,
  )?.logoURI;
}

function StockPayTokenPopoverContent({
  tokens,
  currentSelectToken,
  disableNativeToken,
  onTokenPress,
}: {
  tokens: IToken[];
  currentSelectToken?: ISwapToken;
  disableNativeToken?: boolean;
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
        currentSelectToken={currentSelectToken}
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
      />
    </AccountSelectorProviderMirror>
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
  const [fromTokenAmount, setFromTokenAmount] = useSwapFromTokenAmountAtom();
  const [fromTokenBalance] = useSwapSelectedFromTokenBalanceAtom();
  const [swapTokenDetailLoading] = useSwapSelectTokenDetailFetchingAtom();
  const [settingsPersistAtom] = useSettingsPersistAtom();
  const {
    currentStockToken,
    payToken,
    payTokens,
    selectablePayTokens,
    payTokenOptionsLoading,
    disableNativePayToken,
    selectPayToken,
    tradeSide,
  } = stockChannel;
  const isBuySide = tradeSide === ESwapStockTradeSide.Buy;
  const inputToken = isBuySide ? payToken : currentStockToken;
  const inputTokenNetworkLogoURI =
    inputToken?.networkLogoURI ?? getNetworkLogoURI(inputToken?.networkId);
  const amountFiatValue = useMemo(() => {
    const amountBN = new BigNumber(fromTokenAmount.value ?? 0);
    const priceBN = new BigNumber(inputToken?.price ?? 0);
    const fiatBN = amountBN.multipliedBy(priceBN);
    if (fiatBN.isNaN() || fiatBN.isZero()) {
      return '';
    }
    return fiatBN.toFixed();
  }, [inputToken?.price, fromTokenAmount.value]);

  return (
    <YStack h={124} bg="$bgStrong" borderRadius="$4" overflow="hidden">
      <SizableText pt="$3.5" px="$3.5" size="$bodyMd" color="$textSubdued">
        {intl.formatMessage({
          id: isBuySide ? ETranslations.global_pay : ETranslations.global_sell,
        })}
      </SizableText>
      <AmountInput
        value={fromTokenAmount.value}
        onChange={(value) => {
          if (validateAmountInput(value, inputToken?.decimals)) {
            setFromTokenAmount({
              value,
              isInput: true,
            });
          }
        }}
        bg="$transparent"
        borderWidth={0}
        borderRadius="$0"
        flex={1}
        valueProps={{
          value: amountFiatValue,
          currency: settingsPersistAtom.currencyInfo.symbol,
        }}
        balanceProps={{
          value: inputToken ? fromTokenBalance || '0' : undefined,
          loading: swapTokenDetailLoading.from,
          onPress: onBalanceMaxPress,
          hideIcon: true,
          tokenSymbol: inputToken?.symbol,
          testID: SwapTestIDs.maxButton,
        }}
        maxAmountText="Max"
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
}: Omit<
  ISwapStockDesktopContainerProps,
  'headerContent' | 'marketPresetToken' | 'storeName'
> & {
  stockChannel: IUseSwapStockChannelReturn;
  tradeSide: ESwapStockTradeSide;
  onTradeSideChange: (value: ESwapStockTradeSide) => void;
}) {
  return (
    <YStack gap="$4">
      <StockTradeSideSwitch value={tradeSide} onChange={onTradeSideChange} />
      <StockAmountInput
        fetchLoading={fetchLoading}
        onBalanceMaxPress={onBalanceMaxPress}
        stockChannel={stockChannel}
      />
      <StockEstimatedReceive quoteResult={quoteResult} />
      <SwapActionsState
        onPreSwap={onPreSwap}
        onOpenRecipientAddress={onToAnotherAddressModal}
        onSelectPercentageStage={onSelectPercentageStage}
      />
      <SwapQuoteResult
        refreshAction={refreshAction}
        onOpenProviderList={onOpenProviderList}
        quoteResult={quoteResult}
      />
      {alerts.states.length > 0 &&
      !quoteLoading &&
      !quoteEventFetching &&
      alerts?.quoteId === (quoteResult?.quoteId ?? '') ? (
        <SwapAlertContainer alerts={alerts.states} />
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

function StockMarketContextPanel({
  stockChannel,
}: {
  stockChannel: IUseSwapStockChannelReturn;
}) {
  const { tokenDetail, tokenAddress, networkId, isNative, websocketConfig } =
    useTokenDetail();
  const stock = tokenDetail?.stock;
  const chartReady = !!networkId && !!tokenDetail?.symbol;

  return (
    <YStack
      flex={526}
      minWidth={0}
      minHeight={623}
      p="$6"
      borderWidth="$px"
      borderColor="$borderSubdued"
      borderRadius="$5"
      bg="$bg"
    >
      {tokenDetail ? (
        <XStack alignItems="flex-start" justifyContent="space-between">
          <YStack minWidth={0} flex={1} gap="$1">
            <>
              <MarketTokenSelector
                mode="stock"
                triggerVariant="compact"
                onSelectToken={stockChannel.selectStockToken}
              />
              <XStack ml="$10" alignItems="center" gap="$1" minHeight="$5">
                {stock?.subtitle ? (
                  <SizableText
                    size="$bodySm"
                    color="$textSubdued"
                    numberOfLines={1}
                  >
                    {stock.subtitle}
                  </SizableText>
                ) : null}
                <StockSourceLogo stock={stock} />
                {stock ? <StockIsOpenBadge stock={stock} /> : null}
              </XStack>
            </>
          </YStack>
          <YStack alignItems="flex-end" minWidth="$24">
            <BaseMarketTokenPrice
              size="$bodyLg"
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
      ) : (
        <StockMarketHeaderSkeleton />
      )}

      <Stack
        h={274}
        borderRadius="$4"
        bg="$bgStrong"
        overflow="hidden"
        mt="$6"
        mb="$2.5"
      >
        {chartReady ? (
          <MarketTradingView
            tokenAddress={tokenAddress ?? ''}
            networkId={networkId ?? ''}
            tokenSymbol={tokenDetail?.symbol}
            decimal={tokenDetail?.decimals}
            isNative={isNative}
            dataSource={websocketConfig?.kline ? 'websocket' : 'polling'}
            pageWidth={478}
            disabledFeatures={STOCK_CHART_DISABLED_FEATURES}
          />
        ) : (
          <Skeleton w="100%" h="100%" />
        )}
      </Stack>

      <Divider mb="$3" />
      <StockMarketDataGrid />
    </YStack>
  );
}

export function SwapStockDesktopContainer({
  headerContent,
  marketPresetToken,
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
  const { tokenDetail } = useTokenDetail();
  const [tradeSide, setTradeSide] = useState(ESwapStockTradeSide.Buy);
  const [, setFromTokenAmount] = useSwapFromTokenAmountAtom();
  const [, setToTokenAmount] = useSwapToTokenAmountAtom();
  const stockChannel = useSwapStockChannel({
    marketPresetToken,
    disableNativePayToken: isOndoStockSource(tokenDetail?.stock?.source),
    tradeSide,
  });

  const handleTradeSideChange = useCallback(
    (nextTradeSide: ESwapStockTradeSide) => {
      if (nextTradeSide === tradeSide) {
        return;
      }
      void stockChannel.switchTradeSide(nextTradeSide).then(() => {
        setFromTokenAmount({ value: '', isInput: false });
        setToTokenAmount({ value: '', isInput: false });
        setTradeSide(nextTradeSide);
      });
    },
    [setFromTokenAmount, setToTokenAmount, stockChannel, tradeSide],
  );

  const onOpenHistoryListModal = useCallback(() => {
    dismissKeyboard();
    navigation.pushModal(EModalRoutes.SwapModal, {
      screen: EModalSwapRoutes.SwapHistoryList,
      params: {
        type: EProtocolOfExchange.STOCK,
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
            flex={410}
            minWidth={0}
            minHeight={466}
            p="$6"
            borderWidth="$px"
            borderColor="$borderSubdued"
            borderRadius="$5"
            bg="$bg"
            gap="$5"
          >
            <XStack alignItems="center" justifyContent="space-between">
              <SizableText size="$headingLg" color="$text">
                {intl.formatMessage({
                  id: ETranslations.perps_token_selector_stocks,
                })}
              </SizableText>
              <IconButton
                testID="swap-stock-history-button"
                icon="ClockTimeHistoryOutline"
                size="small"
                variant="tertiary"
                onPress={onOpenHistoryListModal}
              />
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
              tradeSide={tradeSide}
              onTradeSideChange={handleTradeSideChange}
            />
          </YStack>
          <StockMarketContextPanel stockChannel={stockChannel} />
        </XStack>
      </YStack>
    </YStack>
  );
}
