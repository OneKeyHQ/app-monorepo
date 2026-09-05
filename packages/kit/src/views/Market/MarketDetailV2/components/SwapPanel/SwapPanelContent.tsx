import { useCallback, useEffect, useMemo, useRef } from 'react';
import type { ReactNode } from 'react';

import BigNumber from 'bignumber.js';
import { useIntl } from 'react-intl';

import {
  NumberSizeableText,
  SizableText,
  Skeleton,
  Toast,
  XStack,
  YStack,
} from '@onekeyhq/components';
import type { IAccountSelectorActiveAccountInfo } from '@onekeyhq/kit/src/states/jotai/contexts/accountSelector';
import { validateAmountInput } from '@onekeyhq/kit/src/utils/validateAmountInput';
import { BaseMarketTokenPrice } from '@onekeyhq/kit/src/views/Market/components/MarketTokenPrice';
import type { useSwapPanel } from '@onekeyhq/kit/src/views/Market/MarketDetailV2/components/SwapPanel/hooks/useSwapPanel';
import type { IToken } from '@onekeyhq/kit/src/views/Market/MarketDetailV2/components/SwapPanel/types';
import SwapProviderInfoItem from '@onekeyhq/kit/src/views/Swap/components/SwapProviderInfoItem';
import {
  type ISwapRateDifference,
  SwapRateDifferenceText,
} from '@onekeyhq/kit/src/views/Swap/components/SwapRateDifferenceText';
import SwapActionsState from '@onekeyhq/kit/src/views/Swap/pages/components/SwapActionsState';
import { SwapStockHeaderRightActionContainer } from '@onekeyhq/kit/src/views/Swap/pages/components/SwapHeaderRightActionContainer';
import SwapQuoteResult from '@onekeyhq/kit/src/views/Swap/pages/components/SwapQuoteResult';
import { EJotaiContextStoreNames } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { numberFormat } from '@onekeyhq/shared/src/utils/numberUtils';
import type { IMarketAccountPortfolioItem } from '@onekeyhq/shared/types/marketV2';
import type {
  IFetchQuoteResult,
  ISwapNativeTokenReserveGas,
  ISwapToken,
  ISwapTokenBase,
} from '@onekeyhq/shared/types/swap/types';
import {
  ESwapSlippageSegmentKey,
  SwapPercentageInputStage,
} from '@onekeyhq/shared/types/swap/types';

import { StockTokenInfoPopover } from '../StockTokenInfo/StockTokenInfoPopover';
import { StockTokenVariantSelector } from '../TokenSelector/StockTokenVariantSelector';

import { ActionButton } from './components/ActionButton';
import { shouldJumpToMarketTradeFallback } from './components/ActionButton.utils';
import {
  type IEstimateMarketPresetPriorityFeeFiatValues,
  MarketPresetSelector,
} from './components/MarketPresetSelector';
import { RateDisplay } from './components/RateDisplay';
import SellForSelector from './components/SellForSelector';
import { SlippageSetting } from './components/SlippageSetting';
import SwapPanelTop from './components/SwapPanelTop';
import {
  type ITokenInputSectionRef,
  TokenInputSection,
} from './components/TokenInputSection';
import { TradeTypeSelector } from './components/TradeTypeSelector';
import { useSwapAnalytics } from './hooks/useSwapAnalytics';
import { ESwapDirection } from './hooks/useTradeType';
import { calculateMarketStockEstimatedShares } from './utils/marketStockQuoteDisplayUtils';

import type { IMarketPresetSettingsState } from './hooks/useMarketPresetSettings';

const stockPercentageAmountEnterSources = [
  'preset1',
  'preset2',
  'preset3',
] as const;

export type ISwapPanelContentProps = {
  swapPanel: ReturnType<typeof useSwapPanel>;
  isLoading: boolean;
  quoteLoading?: boolean;
  isActionDisabled?: boolean;
  isRefreshQuote?: boolean;
  onRefreshQuote: (manual?: boolean) => void;
  onForceRefreshQuote: () => void;
  balanceLoading: boolean;
  slippageAutoValue?: number;
  supportSpeedSwap: {
    enabled?: boolean;
    isAccountNetworkSupported: boolean;
    warningMessage?: string;
    actionToken?: ISwapToken;
    actionOtherToken?: ISwapToken;
    onlySupportCrossChain?: boolean;
  };
  defaultTokens: IToken[];
  balance?: BigNumber;
  balanceToken?: IToken;
  paymentTokenPrice?: BigNumber;
  onSwap: () => void;
  onOpenRecipientAddress: () => void;
  onWrappedSwap: () => void;
  swapMevNetConfig?: string[];
  swapNativeTokenReserveGas: ISwapNativeTokenReserveGas[];
  isWrapped: boolean;
  onCloseDialog?: () => void;
  priceRate?: {
    rate?: number;
    fromTokenSymbol?: string;
    toTokenSymbol?: string;
    loading?: boolean;
  };
  stockQuoteDisplay?: {
    currencySymbol: string;
    receiveFiatValue: string;
    rateDifference?: ISwapRateDifference;
  };
  stockTokenToAssetRatio?: string;
  stockUnderlyingSymbol?: string;
  hasInitialReady: boolean;
  currentMarketToken?: ISwapToken;
  enableAddressTypeSelector: boolean;
  activeAccount: IAccountSelectorActiveAccountInfo;
  quoteResult?: IFetchQuoteResult;
  quoteListLength: number;
  onOpenProviderList: () => void;
  quoteError?: string;
  disableNativeToken?: boolean;
  marketPresetSettings?: IMarketPresetSettingsState;
  estimatePriorityFeeFiatValues?: IEstimateMarketPresetPriorityFeeFiatValues;
  stockDetailDesktopLayout?: boolean;
  portfolioData?: IMarketAccountPortfolioItem[];
};

function StockTradePanelSkeleton() {
  return (
    <YStack testID="stock-trade-loading" gap="$4">
      <XStack alignItems="center" justifyContent="space-between">
        <Skeleton width={176} height={32} />
        <Skeleton width={32} height={32} borderRadius="$full" />
      </XStack>
      <XStack height={44} alignItems="center" justifyContent="space-between">
        <Skeleton width={128} height={24} />
        <Skeleton width={88} height={24} />
      </XStack>
      <Skeleton width="100%" height={116} borderRadius="$4" />
      <XStack height={40} alignItems="center" justifyContent="space-between">
        <Skeleton width={112} height={20} />
        <Skeleton width={64} height={20} />
      </XStack>
      <Skeleton width="100%" height={48} borderRadius="$3" />
    </YStack>
  );
}

export function SwapPanelContent(props: ISwapPanelContentProps) {
  const {
    activeAccount,
    enableAddressTypeSelector,
    swapPanel,
    isLoading,
    quoteLoading = false,
    isActionDisabled,
    isRefreshQuote,
    onRefreshQuote,
    onForceRefreshQuote,
    balanceLoading,
    slippageAutoValue,
    supportSpeedSwap,
    defaultTokens,
    balance,
    balanceToken,
    paymentTokenPrice,
    swapNativeTokenReserveGas,
    onSwap,
    onOpenRecipientAddress,
    swapMevNetConfig,
    priceRate,
    stockQuoteDisplay,
    stockTokenToAssetRatio,
    stockUnderlyingSymbol,
    onWrappedSwap,
    isWrapped,
    hasInitialReady,
    currentMarketToken,
    quoteResult,
    quoteListLength,
    onOpenProviderList,
    quoteError,
    disableNativeToken,
    marketPresetSettings,
    estimatePriorityFeeFiatValues,
    onCloseDialog,
    stockDetailDesktopLayout,
    portfolioData,
  } = props;

  const {
    paymentAmount,
    paymentToken,
    sellAmount,
    resetAmounts,
    setSellAmount,
    setPaymentAmount,
    setPaymentToken,
    tradeType,
    setTradeType,
    setSlippage,
    networkId,
  } = swapPanel;
  const isMEV = useMemo(
    () =>
      Array.isArray(swapMevNetConfig)
        ? swapMevNetConfig.includes(swapPanel.networkId ?? '')
        : undefined,
    [swapMevNetConfig, swapPanel.networkId],
  );
  const tokenBuyInputRef = useRef<ITokenInputSectionRef>(null);
  const tokenSellInputRef = useRef<ITokenInputSectionRef>(null);
  const paymentAmountRef = useRef(paymentAmount);
  const sellAmountRef = useRef(sellAmount);
  const hasInitializedMarketTokenRef = useRef(false);
  const {
    logSwapAction,
    resetAnalytics,
    setAmountEnterType,
    setSlippageSetting,
  } = useSwapAnalytics();
  const resetSwapAmounts = resetAmounts as () => void;
  const intl = useIntl();
  if (paymentAmount !== paymentAmountRef.current) {
    paymentAmountRef.current = paymentAmount;
  }
  if (sellAmount !== sellAmountRef.current) {
    sellAmountRef.current = sellAmount;
  }
  const showMarketPresetSelector =
    !isWrapped && !!marketPresetSettings?.enabled;
  const shouldReduceSellForPresetGap =
    tradeType === ESwapDirection.SELL &&
    !quoteError &&
    showMarketPresetSelector &&
    !!marketPresetSettings?.presets.length;
  const suppressStandaloneSlippage =
    isWrapped || showMarketPresetSelector || !!marketPresetSettings?.isLoading;
  let actionButtonOnPress = onSwap;
  if (isWrapped) {
    actionButtonOnPress = onWrappedSwap;
  }
  if (isRefreshQuote && onRefreshQuote) {
    actionButtonOnPress = onRefreshQuote;
  }

  const currentInputAmount = useMemo(() => {
    return tradeType === ESwapDirection.BUY ? paymentAmount : sellAmount;
  }, [tradeType, paymentAmount, sellAmount]);

  const handleBalanceClick = useCallback(() => {
    if (!balance) {
      return;
    }

    const reserveGas = swapNativeTokenReserveGas.find(
      (item) => item.networkId === balanceToken?.networkId,
    )?.reserveGas;
    if (balanceToken?.isNative && reserveGas) {
      const maxAmount = BigNumber.max(
        0,
        balance.minus(new BigNumber(reserveGas)),
      ).decimalPlaces(
        Number(balanceToken?.decimals ?? 6),
        BigNumber.ROUND_DOWN,
      );

      const reserveGasFormatted = numberFormat(reserveGas.toString(), {
        formatter: 'balance',
        formatterOptions: {
          tokenSymbol: balanceToken?.symbol,
        },
      });
      const message = intl.formatMessage(
        {
          id: reserveGasFormatted
            ? ETranslations.swap_native_token_max_tip_already
            : ETranslations.swap_native_token_max_tip,
        },
        {
          num_token: reserveGasFormatted,
        },
      );
      Toast.message({
        title: message,
      });

      if (tradeType === ESwapDirection.BUY) {
        setPaymentAmount(maxAmount);
        tokenBuyInputRef.current?.setValue(maxAmount.toFixed());
      } else {
        setSellAmount(maxAmount);
        tokenSellInputRef.current?.setValue(maxAmount.toFixed());
      }
    } else if (tradeType === ESwapDirection.BUY) {
      setPaymentAmount(balance);
      tokenBuyInputRef.current?.setValue(balance.toFixed());
    } else {
      setSellAmount(balance);
      tokenSellInputRef.current?.setValue(balance.toFixed());
    }
  }, [
    swapNativeTokenReserveGas,
    balanceToken?.isNative,
    balanceToken?.networkId,
    balanceToken?.decimals,
    balanceToken?.symbol,
    balance,
    setPaymentAmount,
    setSellAmount,
    tradeType,
    intl,
  ]);

  const handlePercentageSelect = useCallback(
    (stage: number) => {
      const percentageStageIndex = SwapPercentageInputStage.indexOf(stage);
      const amountEnterSource =
        stockPercentageAmountEnterSources[percentageStageIndex];
      if (!balance || !balanceToken || !amountEnterSource) {
        return;
      }

      const reserveGas = swapNativeTokenReserveGas.find(
        (item) => item.networkId === balanceToken.networkId,
      )?.reserveGas;
      let amount = balance.multipliedBy(new BigNumber(stage).dividedBy(100));
      if (balanceToken.isNative && reserveGas) {
        amount = BigNumber.max(0, amount.minus(new BigNumber(reserveGas)));
      }
      if (balanceToken.decimals !== undefined) {
        amount = amount.decimalPlaces(
          balanceToken.decimals,
          BigNumber.ROUND_DOWN,
        );
      }

      if (tradeType === ESwapDirection.BUY) {
        setPaymentAmount(amount);
        tokenBuyInputRef.current?.setValue(amount.toFixed());
      } else {
        setSellAmount(amount);
        tokenSellInputRef.current?.setValue(amount.toFixed());
      }

      setAmountEnterType(amountEnterSource);
    },
    [
      balance,
      balanceToken,
      setAmountEnterType,
      setPaymentAmount,
      setSellAmount,
      swapNativeTokenReserveGas,
      tradeType,
    ],
  );

  useEffect(() => {
    if (
      (new BigNumber(paymentAmountRef.current?.toFixed()).gt(0) &&
        tradeType === ESwapDirection.BUY &&
        !validateAmountInput(
          paymentAmountRef.current?.toFixed(),
          balanceToken?.decimals,
        )) ||
      (new BigNumber(sellAmountRef.current?.toFixed()).gt(0) &&
        tradeType === ESwapDirection.SELL &&
        !validateAmountInput(
          sellAmountRef.current?.toFixed(),
          balanceToken?.decimals,
        ))
    ) {
      const changeAmount = new BigNumber(
        tradeType === ESwapDirection.BUY
          ? paymentAmountRef.current?.toFixed()
          : sellAmountRef.current?.toFixed(),
      ).decimalPlaces(
        Number(balanceToken?.decimals ?? 0),
        BigNumber.ROUND_DOWN,
      );
      if (tradeType === ESwapDirection.BUY) {
        setPaymentAmount(changeAmount);
        tokenBuyInputRef.current?.setValue(changeAmount.toFixed());
      } else {
        setSellAmount(changeAmount);
        tokenSellInputRef.current?.setValue(changeAmount.toFixed());
      }
    }
  }, [tradeType, balanceToken?.decimals, setPaymentAmount, setSellAmount]);

  useEffect(() => {
    if (!hasInitializedMarketTokenRef.current) {
      hasInitializedMarketTokenRef.current = true;
      return;
    }

    resetSwapAmounts();
    resetAnalytics();
    tokenBuyInputRef.current?.setValue('');
    tokenSellInputRef.current?.setValue('');
  }, [
    currentMarketToken?.networkId,
    currentMarketToken?.contractAddress,
    resetSwapAmounts,
    resetAnalytics,
  ]);

  const stockInputFiatValue = useMemo(() => {
    if (!currentInputAmount.isFinite() || !currentInputAmount.gt(0)) {
      return '0';
    }

    const inputTokenPrice =
      tradeType === ESwapDirection.BUY
        ? (paymentTokenPrice ?? new BigNumber(paymentToken?.price || 0))
        : new BigNumber(balanceToken?.price || currentMarketToken?.price || 0);
    if (!inputTokenPrice.isFinite() || !inputTokenPrice.gt(0)) {
      return '0';
    }

    return currentInputAmount.multipliedBy(inputTokenPrice).toFixed();
  }, [
    balanceToken?.price,
    currentInputAmount,
    currentMarketToken?.price,
    paymentToken?.price,
    paymentTokenPrice,
    tradeType,
  ]);

  const estimatedReceiveAmount = quoteResult?.toAmount;
  const estimatedReceiveTokenSymbol =
    quoteResult?.toTokenInfo?.symbol ??
    (tradeType === ESwapDirection.BUY
      ? currentMarketToken?.symbol
      : paymentToken?.symbol);
  const estimatedStockTokenAmount =
    tradeType === ESwapDirection.BUY
      ? quoteResult?.toAmount
      : quoteResult?.fromAmount;
  const estimatedShares = calculateMarketStockEstimatedShares({
    stockTokenAmount: estimatedStockTokenAmount,
    tokenToAssetRatio: stockTokenToAssetRatio,
  });
  let stockEstimatedReceiveContent: ReactNode = (
    <SizableText size="$bodyMdMedium">--</SizableText>
  );
  if (quoteLoading) {
    stockEstimatedReceiveContent = (
      <YStack alignItems="flex-end" gap="$0.5">
        <Skeleton height="$5" width="$20" />
        <Skeleton height="$5" width="$16" />
      </YStack>
    );
  } else if (estimatedReceiveAmount) {
    stockEstimatedReceiveContent = (
      <YStack alignItems="flex-end" minWidth={0}>
        <XStack alignItems="center" justifyContent="flex-end" gap="$1">
          <NumberSizeableText
            size="$bodyMdMedium"
            formatter="balance"
            numberOfLines={1}
          >
            {estimatedReceiveAmount}
          </NumberSizeableText>
          <SizableText size="$bodyMdMedium" numberOfLines={1}>
            {estimatedReceiveTokenSymbol}
          </SizableText>
        </XStack>
        <XStack alignItems="center" justifyContent="flex-end" gap="$1">
          <NumberSizeableText
            size="$bodyMd"
            color="$textSubdued"
            formatter="value"
            formatterOptions={{
              currency: stockQuoteDisplay?.currencySymbol ?? '$',
            }}
            numberOfLines={1}
          >
            {stockQuoteDisplay?.receiveFiatValue || '0'}
          </NumberSizeableText>
          <SwapRateDifferenceText
            loading={quoteLoading}
            rateDifference={stockQuoteDisplay?.rateDifference}
            size="$bodyMd"
          />
        </XStack>
      </YStack>
    );
  }

  let stockEstimatedSharesContent: ReactNode = (
    <SizableText size="$bodyMdMedium">--</SizableText>
  );
  if (quoteLoading) {
    stockEstimatedSharesContent = <Skeleton height="$5" width="$20" />;
  } else if (estimatedShares) {
    stockEstimatedSharesContent = (
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

  if (stockDetailDesktopLayout) {
    if (!hasInitialReady) {
      return <StockTradePanelSkeleton />;
    }

    const noAccount =
      !activeAccount?.indexedAccount?.id && !activeAccount?.account?.id;
    const shouldUseSwapFallbackAction = shouldJumpToMarketTradeFallback({
      supportSpeedSwap: supportSpeedSwap.enabled,
      isAccountNetworkSupported: supportSpeedSwap.isAccountNetworkSupported,
      isWrapped,
      isRefreshQuote,
    });
    const handleStockPreSwap = () => {
      logSwapAction({
        tradeType,
        networkId,
        paymentToken,
        marketToken: currentMarketToken,
      });
      onSwap();
    };

    return (
      <YStack gap="$4">
        <XStack alignItems="center" justifyContent="space-between">
          <YStack width={176}>
            <TradeTypeSelector
              value={tradeType}
              onChange={setTradeType}
              size="small"
              preventTextWrap
            />
          </YStack>
          <SwapStockHeaderRightActionContainer
            storeName={EJotaiContextStoreNames.marketSwap}
          />
        </XStack>

        {/* Figma 25672:54925: 44 tall, inset 4 on the left so the variant
            trigger's hover pill can bleed back over the panel padding. */}
        <XStack
          testID="stock-trade-target"
          height={44}
          pl="$1"
          alignItems="center"
          justifyContent="space-between"
          gap="$2"
        >
          <StockTokenVariantSelector portfolioData={portfolioData} />
          <XStack alignItems="center" justifyContent="flex-end" gap="$3">
            <BaseMarketTokenPrice
              price={currentMarketToken?.price || '--'}
              tokenName={currentMarketToken?.name || ''}
              tokenSymbol={currentMarketToken?.symbol || ''}
              currency="$"
              size="$bodyLgMedium"
            />
            <StockTokenInfoPopover />
          </XStack>
        </XStack>

        <TokenInputSection
          ref={tokenBuyInputRef}
          style={tradeType === ESwapDirection.BUY ? {} : { display: 'none' }}
          stockDetailDesktopLayout
          tradeType={ESwapDirection.BUY}
          swapNativeTokenReserveGas={swapNativeTokenReserveGas}
          onChange={(amount) => setPaymentAmount(new BigNumber(amount))}
          selectedToken={paymentToken}
          selectableTokens={defaultTokens}
          onTokenChange={(token) => setPaymentToken(token)}
          balance={balance}
          balanceLoading={balanceLoading}
          fiatValue={stockInputFiatValue}
          onMaxPress={handleBalanceClick}
          onSelectPercentageStage={handlePercentageSelect}
          onAmountEnterTypeChange={setAmountEnterType}
          disableNativeToken={disableNativeToken}
        />
        <TokenInputSection
          ref={tokenSellInputRef}
          style={tradeType === ESwapDirection.SELL ? {} : { display: 'none' }}
          stockDetailDesktopLayout
          tradeType={ESwapDirection.SELL}
          swapNativeTokenReserveGas={swapNativeTokenReserveGas}
          onChange={(amount) => setSellAmount(new BigNumber(amount))}
          selectedToken={balanceToken}
          selectableTokens={defaultTokens}
          onTokenChange={(token) => setPaymentToken(token)}
          balance={balance}
          balanceLoading={balanceLoading}
          fiatValue={stockInputFiatValue}
          onMaxPress={handleBalanceClick}
          onSelectPercentageStage={handlePercentageSelect}
          onAmountEnterTypeChange={setAmountEnterType}
        />

        <YStack testID="stock-trade-output" gap="$4">
          <XStack
            testID="stock-trade-estimated-received"
            height={40}
            px="$0.5"
            py="$1"
            alignItems="center"
            justifyContent="space-between"
            gap="$2"
          >
            <SizableText size="$bodyMd">
              {intl.formatMessage({
                id: ETranslations.private_send_estimated_received,
              })}
            </SizableText>
            {stockEstimatedReceiveContent}
          </XStack>

          <XStack
            testID="stock-trade-estimated-shares"
            px="$0.5"
            pt="$0"
            pb="$2"
            alignItems="center"
            justifyContent="space-between"
            gap="$2"
          >
            <SizableText size="$bodyMd">
              {intl.formatMessage({ id: ETranslations.market_est_shares })}
            </SizableText>
            {stockEstimatedSharesContent}
          </XStack>
        </YStack>

        {quoteError ? (
          <SizableText size="$bodyMd" color="$textCritical">
            {quoteError}
          </SizableText>
        ) : null}

        {shouldUseSwapFallbackAction ? (
          <ActionButton
            supportSpeedSwap={!!supportSpeedSwap.enabled}
            isAccountNetworkSupported={
              supportSpeedSwap.isAccountNetworkSupported
            }
            onlySupportCrossChain={!!supportSpeedSwap.onlySupportCrossChain}
            loading={isLoading}
            actionToken={supportSpeedSwap.actionToken}
            actionOtherToken={supportSpeedSwap.actionOtherToken}
            tradeType={tradeType}
            onPress={actionButtonOnPress}
            amount={currentInputAmount.toFixed()}
            token={balanceToken}
            paymentToken={paymentToken}
            paymentTokenPrice={paymentTokenPrice}
            balance={balance}
            isWrapped={isWrapped}
            networkId={networkId}
            disabled={
              isLoading ||
              !!isActionDisabled ||
              (!isRefreshQuote && !!quoteError)
            }
            isRefreshQuote={isRefreshQuote}
          />
        ) : (
          <SwapActionsState
            forceNoConnectWallet={noAccount}
            disabled={
              !noAccount &&
              (isLoading ||
                !currentMarketToken?.networkId ||
                (!currentMarketToken?.contractAddress &&
                  !currentMarketToken?.isNative) ||
                !!isActionDisabled ||
                (!isRefreshQuote && !!quoteError))
            }
            forceQuoteActionLoading={!noAccount && (isLoading || quoteLoading)}
            onRefreshQuote={() => onRefreshQuote(true)}
            onPreSwap={handleStockPreSwap}
            onOpenRecipientAddress={onOpenRecipientAddress}
          />
        )}

        {!isWrapped ? (
          <SwapQuoteResult
            refreshAction={onForceRefreshQuote}
            onOpenProviderList={onOpenProviderList}
            quoteResult={quoteResult}
          />
        ) : null}
      </YStack>
    );
  }

  return (
    <YStack gap="$4">
      {/* Trade type selector */}
      <TradeTypeSelector value={tradeType} onChange={setTradeType} />

      <YStack gap="$3">
        {/* Token input section */}
        <SwapPanelTop
          enableAddressTypeSelector={enableAddressTypeSelector}
          activeAccount={activeAccount}
          balance={balance}
          balanceToken={balanceToken}
          balanceLoading={balanceLoading}
          handleBalanceClick={handleBalanceClick}
        />
        <TokenInputSection
          ref={tokenBuyInputRef}
          style={tradeType === ESwapDirection.BUY ? {} : { display: 'none' }}
          tradeType={ESwapDirection.BUY}
          swapNativeTokenReserveGas={swapNativeTokenReserveGas}
          onChange={(amount) => setPaymentAmount(new BigNumber(amount))}
          selectedToken={paymentToken}
          selectableTokens={defaultTokens}
          onTokenChange={(token) => setPaymentToken(token)}
          balance={balance}
          onAmountEnterTypeChange={setAmountEnterType}
          disableNativeToken={disableNativeToken}
        />
        <TokenInputSection
          ref={tokenSellInputRef}
          style={tradeType === ESwapDirection.SELL ? {} : { display: 'none' }}
          tradeType={ESwapDirection.SELL}
          swapNativeTokenReserveGas={swapNativeTokenReserveGas}
          onChange={(amount) => setSellAmount(new BigNumber(amount))}
          selectedToken={balanceToken}
          selectableTokens={defaultTokens}
          onTokenChange={(token) => setPaymentToken(token)}
          balance={balance}
          onAmountEnterTypeChange={setAmountEnterType}
        />

        {/* Rate display */}
        <RateDisplay
          rate={priceRate?.rate}
          fromTokenSymbol={priceRate?.fromTokenSymbol}
          toTokenSymbol={priceRate?.toTokenSymbol}
          loading={priceRate?.loading}
        />
        {/* Wrapped pairs never quote, so the provider row stays hidden there */}
        {!isWrapped ? (
          <SwapProviderInfoItem
            providerIcon={quoteResult?.info.providerLogo ?? ''}
            providerName={quoteResult?.info.providerName ?? ''}
            showEmptyPlaceholder
            fromToken={quoteResult?.fromTokenInfo}
            toToken={quoteResult?.toTokenInfo}
            percentageFee={quoteResult?.fee?.percentageFee}
            percentOriginFee={quoteResult?.fee?.percentOriginFee}
            onPress={quoteListLength > 1 ? onOpenProviderList : undefined}
            isLoading={quoteLoading}
          />
        ) : null}

        {/* Balance display */}
        {tradeType === ESwapDirection.SELL ? (
          <YStack mb={shouldReduceSellForPresetGap ? '$-1' : undefined}>
            <SellForSelector
              defaultTokens={defaultTokens}
              currentSelectToken={balanceToken as ISwapTokenBase}
              onTokenSelect={(token) => setPaymentToken(token as IToken)}
              symbol={paymentToken?.symbol ?? '-'}
              isLoading={!hasInitialReady}
            />
          </YStack>
        ) : null}
      </YStack>

      {quoteError ? (
        <SizableText size="$bodyMd" color="$textCritical">
          {quoteError}
        </SizableText>
      ) : null}

      {showMarketPresetSelector && marketPresetSettings ? (
        <MarketPresetSelector
          antiMEV={isMEV}
          estimatePriorityFeeFiatValues={estimatePriorityFeeFiatValues}
          presetSettings={marketPresetSettings}
          variant={onCloseDialog ? 'compact' : 'full'}
        />
      ) : null}

      <ActionButton
        supportSpeedSwap={!!supportSpeedSwap?.enabled}
        isAccountNetworkSupported={supportSpeedSwap.isAccountNetworkSupported}
        onlySupportCrossChain={!!supportSpeedSwap?.onlySupportCrossChain}
        loading={isLoading}
        actionToken={supportSpeedSwap?.actionToken}
        actionOtherToken={supportSpeedSwap?.actionOtherToken}
        tradeType={tradeType}
        onPress={actionButtonOnPress}
        amount={currentInputAmount.toFixed()}
        token={balanceToken}
        paymentToken={paymentToken}
        paymentTokenPrice={paymentTokenPrice}
        balance={balance}
        isWrapped={isWrapped}
        networkId={networkId}
        disabled={
          isLoading || !!isActionDisabled || (!isRefreshQuote && !!quoteError)
        }
        isRefreshQuote={isRefreshQuote}
        onSwapAction={
          isRefreshQuote
            ? undefined
            : () =>
                logSwapAction({
                  tradeType,
                  networkId,
                  paymentToken,
                  marketToken: currentMarketToken,
                })
        }
      />

      {/* Slippage setting */}
      {suppressStandaloneSlippage || stockDetailDesktopLayout ? null : (
        <SlippageSetting
          autoDefaultValue={slippageAutoValue}
          isMEV={!!isMEV}
          onSlippageChange={(item) => {
            setSlippage(item.value);
            setSlippageSetting(item.key === ESwapSlippageSegmentKey.CUSTOM);
          }}
        />
      )}
    </YStack>
  );
}
