import { useCallback, useEffect, useMemo, useRef } from 'react';

import BigNumber from 'bignumber.js';
import { useIntl } from 'react-intl';

import { SizableText, Toast, YStack } from '@onekeyhq/components';
import type { IAccountSelectorActiveAccountInfo } from '@onekeyhq/kit/src/states/jotai/contexts/accountSelector';
import { validateAmountInput } from '@onekeyhq/kit/src/utils/validateAmountInput';
import type { useSwapPanel } from '@onekeyhq/kit/src/views/Market/MarketDetailV2/components/SwapPanel/hooks/useSwapPanel';
import type { IToken } from '@onekeyhq/kit/src/views/Market/MarketDetailV2/components/SwapPanel/types';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { numberFormat } from '@onekeyhq/shared/src/utils/numberUtils';
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
  enableAddressTypeSelector: boolean;
  activeAccount: IAccountSelectorActiveAccountInfo;
  speedCheckError?: string;
};

export function SwapPanelContent(props: ISwapPanelContentProps) {
  const {
    activeAccount,
    enableAddressTypeSelector,
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
    speedCheckError,
  } = props;

  const {
    paymentAmount,
    paymentToken,
    sellAmount,
    setSellAmount,
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
  const sellAmountRef = useRef(sellAmount);
  // Initialize analytics hook
  const swapAnalytics = useSwapAnalytics();
  const intl = useIntl();
  if (paymentAmount !== paymentAmountRef.current) {
    paymentAmountRef.current = paymentAmount;
  }
  if (sellAmount !== sellAmountRef.current) {
    sellAmountRef.current = sellAmount;
  }

  const currentInputAmount = useMemo(() => {
    return tradeType === ESwapDirection.BUY ? paymentAmount : sellAmount;
  }, [tradeType, paymentAmount, sellAmount]);

  const handleBalanceClick = useCallback(() => {
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
    tokenBuyInputRef.current?.setValue('');
    tokenSellInputRef.current?.setValue('');
  }, [currentMarketToken?.networkId, currentMarketToken?.contractAddress]);

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
          onAmountEnterTypeChange={swapAnalytics.setAmountEnterType}
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

      {speedCheckError ? (
        <SizableText size="$bodyMd" color="$textCritical">
          {speedCheckError}
        </SizableText>
      ) : null}

      {!isApproved &&
      !speedCheckError &&
      currentInputAmount.gt(0) &&
      balance.gte(currentInputAmount) ? (
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
          amount={currentInputAmount.toFixed()}
          token={balanceToken}
          balance={balance}
          isWrapped={isWrapped}
          networkId={networkId}
          disabled={!!speedCheckError}
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
