import { useCallback, useEffect, useMemo, useRef } from 'react';
import type { ReactNode } from 'react';

import BigNumber from 'bignumber.js';
import { useIntl } from 'react-intl';

import {
  Icon,
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
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { numberFormat } from '@onekeyhq/shared/src/utils/numberUtils';
import type { IMarketAccountPortfolioItem } from '@onekeyhq/shared/types/marketV2';
import type {
  IFetchQuoteResult,
  ISwapNativeTokenReserveGas,
  ISwapToken,
  ISwapTokenBase,
} from '@onekeyhq/shared/types/swap/types';
import { ESwapSlippageSegmentKey } from '@onekeyhq/shared/types/swap/types';

import { StockTokenVariantSelector } from '../TokenSelector/StockTokenVariantSelector';

import { ActionButton } from './components/ActionButton';
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

import type { IMarketPresetSettingsState } from './hooks/useMarketPresetSettings';

export type ISwapPanelContentProps = {
  swapPanel: ReturnType<typeof useSwapPanel>;
  isLoading: boolean;
  quoteLoading?: boolean;
  isActionDisabled?: boolean;
  isRefreshQuote?: boolean;
  onRefreshQuote?: () => void;
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
    balanceLoading,
    slippageAutoValue,
    supportSpeedSwap,
    defaultTokens,
    balance,
    balanceToken,
    paymentTokenPrice,
    swapNativeTokenReserveGas,
    onSwap,
    swapMevNetConfig,
    priceRate,
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
  let stockEstimatedReceiveContent: ReactNode = (
    <SizableText size="$bodyMdMedium">--</SizableText>
  );
  if (quoteLoading) {
    stockEstimatedReceiveContent = <Skeleton height="$5" width="$20" />;
  } else if (estimatedReceiveAmount) {
    stockEstimatedReceiveContent = (
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
    );
  }

  if (stockDetailDesktopLayout) {
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
          {showMarketPresetSelector && marketPresetSettings ? (
            <MarketPresetSelector
              settingsButtonOnly
              antiMEV={isMEV}
              estimatePriorityFeeFiatValues={estimatePriorityFeeFiatValues}
              presetSettings={marketPresetSettings}
            />
          ) : (
            <SlippageSetting
              variant="header"
              autoDefaultValue={slippageAutoValue}
              isMEV={!!isMEV}
              onSlippageChange={(item) => {
                setSlippage(item.value);
                setSlippageSetting(item.key === ESwapSlippageSegmentKey.CUSTOM);
              }}
            />
          )}
        </XStack>

        <XStack
          testID="stock-trade-target"
          height={44}
          alignItems="center"
          justifyContent="space-between"
          gap="$3"
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
            <Icon name="InfoCircleOutline" size="$5" color="$iconSubdued" />
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
          onAmountEnterTypeChange={setAmountEnterType}
        />

        <XStack
          testID="stock-trade-estimated-received"
          height={40}
          px="$0.5"
          alignItems="center"
          justifyContent="space-between"
          gap="$2"
        >
          <XStack alignItems="center" gap="$1">
            <Icon name="HandCoinsOutline" size="$4.5" color="$iconSubdued" />
            <SizableText size="$bodyMd">Est received</SizableText>
          </XStack>
          {stockEstimatedReceiveContent}
        </XStack>

        {quoteError ? (
          <SizableText size="$bodyMd" color="$textCritical">
            {quoteError}
          </SizableText>
        ) : null}

        <ActionButton
          height={50}
          borderRadius="$full"
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
            isLoading ||
            !currentMarketToken?.networkId ||
            (!currentMarketToken?.contractAddress &&
              !currentMarketToken?.isNative) ||
            !!isActionDisabled ||
            (!isRefreshQuote && !!quoteError)
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
