import { useCallback, useEffect, useRef } from 'react';

import BigNumber from 'bignumber.js';

import { YStack } from '@onekeyhq/components';
import { validateAmountInput } from '@onekeyhq/kit/src/utils/validateAmountInput';
import type { useSwapPanel } from '@onekeyhq/kit/src/views/Market/MarketDetailV2/components/SwapPanel/hooks/useSwapPanel';
import type { IToken } from '@onekeyhq/kit/src/views/Market/MarketDetailV2/components/SwapPanel/types';
import type { ETranslations } from '@onekeyhq/shared/src/locale';
import type {
  ISwapNativeTokenReserveGas,
  ISwapToken,
  ISwapTokenBase,
} from '@onekeyhq/shared/types/swap/types';
import { ESwapSlippageSegmentKey } from '@onekeyhq/shared/types/swap/types';

import { ActionButton } from './components/ActionButton';
import { ApproveButton } from './components/ApproveButton';
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

export type ISwapPanelContentProps = {
  swapPanel: ReturnType<typeof useSwapPanel>;
  isLoading: boolean;
  balanceLoading: boolean;
  slippageAutoValue?: number;
  supportSpeedSwap: {
    enabled?: boolean;
    warningMessage?: string;
    actionTranslationId?: ETranslations;
    actionToken?: ISwapToken;
    actionOtherToken?: ISwapToken;
    onlySupportCrossChain?: boolean;
  };
  isApproved: boolean;
  defaultTokens: IToken[];
  balance: BigNumber;
  balanceToken?: IToken;
  onApprove: () => void;
  onSwap: () => void;
  onWrappedSwap: () => void;
  swapMevNetConfig: string[];
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
};

export function SwapPanelContent(props: ISwapPanelContentProps) {
  const {
    swapPanel,
    isLoading,
    balanceLoading,
    slippageAutoValue,
    supportSpeedSwap,
    defaultTokens,
    isApproved,
    balance,
    balanceToken,
    swapNativeTokenReserveGas,
    onApprove,
    onSwap,
    swapMevNetConfig,
    priceRate,
    onWrappedSwap,
    isWrapped,
    hasInitialReady,
    currentMarketToken,
  } = props;

  const {
    paymentAmount,
    paymentToken,
    setPaymentAmount,
    setPaymentToken,
    tradeType,
    setTradeType,
    setSlippage,
    networkId,
  } = swapPanel;
  const tokenBuyInputRef = useRef<ITokenInputSectionRef>(null);
  const tokenSellInputRef = useRef<ITokenInputSectionRef>(null);
  const paymentAmountRef = useRef(paymentAmount);

  // Initialize analytics hook
  const swapAnalytics = useSwapAnalytics();
  if (paymentAmount !== paymentAmountRef.current) {
    paymentAmountRef.current = paymentAmount;
  }
  const handleBalanceClick = useCallback(() => {
    const reserveGas = swapNativeTokenReserveGas.find(
      (item) => item.networkId === balanceToken?.networkId,
    )?.reserveGas;
    if (balanceToken?.isNative && reserveGas) {
      const maxAmount = BigNumber.max(
        0,
        balance.minus(new BigNumber(reserveGas)),
      ).decimalPlaces(balanceToken?.decimals ?? 6, BigNumber.ROUND_DOWN);
      setPaymentAmount(maxAmount);
      if (tradeType === ESwapDirection.BUY) {
        tokenBuyInputRef.current?.setValue(maxAmount.toFixed());
      } else {
        tokenSellInputRef.current?.setValue(maxAmount.toFixed());
      }
    } else {
      setPaymentAmount(balance);
      if (tradeType === ESwapDirection.BUY) {
        tokenBuyInputRef.current?.setValue(balance.toFixed());
      } else {
        tokenSellInputRef.current?.setValue(balance.toFixed());
      }
    }
  }, [
    swapNativeTokenReserveGas,
    balanceToken?.isNative,
    balanceToken?.networkId,
    balanceToken?.decimals,
    balance,
    setPaymentAmount,
    tradeType,
  ]);

  useEffect(() => {
    if (
      new BigNumber(paymentAmountRef.current?.toFixed()).gt(0) &&
      !validateAmountInput(
        paymentAmountRef.current?.toFixed(),
        balanceToken?.decimals,
      )
    ) {
      const changeAmount = new BigNumber(
        paymentAmountRef.current?.toFixed(),
      ).decimalPlaces(balanceToken?.decimals ?? 0, BigNumber.ROUND_DOWN);
      setPaymentAmount(changeAmount);
      if (tradeType === ESwapDirection.BUY) {
        tokenBuyInputRef.current?.setValue(changeAmount.toFixed());
      } else {
        tokenSellInputRef.current?.setValue(changeAmount.toFixed());
      }
    }
  }, [tradeType, balanceToken?.decimals, setPaymentAmount]);

  useEffect(() => {
    tokenBuyInputRef.current?.setValue('');
    tokenSellInputRef.current?.setValue('');
  }, [currentMarketToken?.networkId, currentMarketToken?.contractAddress]);

  return (
    <YStack gap="$4">
      {/* Trade type selector */}
      <TradeTypeSelector value={tradeType} onChange={setTradeType} />

      <YStack gap="$2" mt="$2">
        {/* Token input section */}
        <SwapPanelTop
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
          onAmountEnterTypeChange={swapAnalytics.setAmountEnterType}
        />
        <TokenInputSection
          ref={tokenSellInputRef}
          style={tradeType === ESwapDirection.SELL ? {} : { display: 'none' }}
          tradeType={ESwapDirection.SELL}
          swapNativeTokenReserveGas={swapNativeTokenReserveGas}
          onChange={(amount) => setPaymentAmount(new BigNumber(amount))}
          selectedToken={balanceToken}
          selectableTokens={defaultTokens}
          onTokenChange={(token) => setPaymentToken(token)}
          balance={balance}
          onAmountEnterTypeChange={swapAnalytics.setAmountEnterType}
        />

        {/* Rate display */}
        <RateDisplay
          rate={priceRate?.rate}
          fromTokenSymbol={priceRate?.fromTokenSymbol}
          toTokenSymbol={priceRate?.toTokenSymbol}
          loading={priceRate?.loading}
        />

        {/* Balance display */}
        {tradeType === ESwapDirection.SELL ? (
          <SellForSelector
            defaultTokens={defaultTokens}
            currentSelectToken={balanceToken as ISwapTokenBase}
            onTokenSelect={(token) => setPaymentToken(token as IToken)}
            symbol={paymentToken?.symbol ?? '-'}
            isLoading={!hasInitialReady}
          />
        ) : null}
      </YStack>

      {!isApproved && paymentAmount.gt(0) && balance.gte(paymentAmount) ? (
        <ApproveButton onApprove={onApprove} loading={isLoading} />
      ) : (
        <ActionButton
          supportSpeedSwap={!!supportSpeedSwap?.enabled}
          onlySupportCrossChain={!!supportSpeedSwap?.onlySupportCrossChain}
          loading={isLoading}
          actionToken={supportSpeedSwap?.actionToken}
          actionOtherToken={supportSpeedSwap?.actionOtherToken}
          tradeType={tradeType}
          onPress={isWrapped ? onWrappedSwap : onSwap}
          amount={paymentAmount.toFixed()}
          token={
            tradeType === ESwapDirection.SELL ? balanceToken : paymentToken
          }
          balance={balance}
          isWrapped={isWrapped}
          paymentToken={paymentToken}
          networkId={networkId}
          onSwapAction={() =>
            swapAnalytics.logSwapAction({
              tradeType,
              networkId,
              paymentToken,
              balanceToken,
            })
          }
        />
      )}

      {/* Slippage setting */}
      {isWrapped ? null : (
        <SlippageSetting
          autoDefaultValue={slippageAutoValue}
          isMEV={swapMevNetConfig?.includes(swapPanel.networkId ?? '')}
          onSlippageChange={(item) => {
            setSlippage(item.value);
            swapAnalytics.setSlippageSetting(
              item.key === ESwapSlippageSegmentKey.CUSTOM,
            );
          }}
        />
      )}
    </YStack>
  );
}
