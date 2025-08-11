import { useCallback, useRef } from 'react';

import BigNumber from 'bignumber.js';

import { YStack } from '@onekeyhq/components';
import type { useSwapPanel } from '@onekeyhq/kit/src/views/Market/MarketDetailV2/components/SwapPanel/hooks/useSwapPanel';
import type { IToken } from '@onekeyhq/kit/src/views/Market/MarketDetailV2/components/SwapPanel/types';
import type { ISwapNativeTokenReserveGas } from '@onekeyhq/shared/types/swap/types';

import { ActionButton } from './components/ActionButton';
import { ApproveButton } from './components/ApproveButton';
import { BalanceDisplay } from './components/BalanceDisplay';
import { RateDisplay } from './components/RateDisplay';
import { SlippageSetting } from './components/SlippageSetting';
import {
  type ITokenInputSectionRef,
  TokenInputSection,
} from './components/TokenInputSection';
import { TradeTypeSelector } from './components/TradeTypeSelector';
import { UnsupportedSwapWarning } from './components/UnsupportedSwapWarning';
import { ESwapDirection } from './hooks/useTradeType';

export type ISwapPanelContentProps = {
  swapPanel: ReturnType<typeof useSwapPanel>;
  isLoading: boolean;
  balanceLoading: boolean;
  slippageAutoValue?: number;
  supportSpeedSwap: boolean;
  isApproved: boolean;
  defaultTokens: IToken[];
  balance: BigNumber;
  balanceToken?: IToken;
  onApprove: () => void;
  onSwap: () => void;
  swapMevNetConfig: string[];
  swapNativeTokenReserveGas: ISwapNativeTokenReserveGas[];
  priceRate?: {
    rate?: number;
    fromTokenSymbol?: string;
    toTokenSymbol?: string;
    loading?: boolean;
  };
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

  const tokenInputRef = useRef<ITokenInputSectionRef>(null);

  const handleBalanceClick = useCallback(() => {
    const reserveGas = swapNativeTokenReserveGas.find(
      (item) => item.networkId === balanceToken?.networkId,
    )?.reserveGas;
    if (balanceToken?.isNative && reserveGas) {
      const maxAmount = BigNumber.max(
        0,
        balance.minus(new BigNumber(reserveGas)),
      );
      setPaymentAmount(maxAmount);
      tokenInputRef.current?.setValue(maxAmount.toFixed());
    } else {
      setPaymentAmount(balance);
      tokenInputRef.current?.setValue(balance.toFixed());
    }
  }, [
    balance,
    balanceToken?.isNative,
    balanceToken?.networkId,
    setPaymentAmount,
    swapNativeTokenReserveGas,
  ]);
  return (
    <YStack gap="$4">
      {/* Trade type selector */}
      <TradeTypeSelector value={tradeType} onChange={setTradeType} />

      <YStack gap="$2">
        {/* Token input section */}
        <TokenInputSection
          ref={tokenInputRef}
          tradeType={tradeType}
          swapNativeTokenReserveGas={swapNativeTokenReserveGas}
          onChange={(amount) => setPaymentAmount(new BigNumber(amount))}
          selectedToken={
            tradeType === ESwapDirection.SELL ? balanceToken : paymentToken
          }
          selectableTokens={defaultTokens}
          onTokenChange={(token) => setPaymentToken(token)}
          balance={balance}
        />

        {/* Rate display */}
        <RateDisplay
          rate={priceRate?.rate}
          fromTokenSymbol={priceRate?.fromTokenSymbol}
          toTokenSymbol={priceRate?.toTokenSymbol}
          loading={priceRate?.loading}
        />

        {/* Balance display */}
        <BalanceDisplay
          balance={balance}
          token={balanceToken}
          isLoading={balanceLoading}
          onBalanceClick={handleBalanceClick}
        />
      </YStack>

      {/* Unsupported swap warning */}
      {!isLoading && !supportSpeedSwap ? <UnsupportedSwapWarning /> : null}

      {!isApproved ? (
        <ApproveButton onApprove={onApprove} loading={isLoading} />
      ) : (
        <ActionButton
          disabled={!supportSpeedSwap}
          loading={isLoading}
          tradeType={tradeType}
          onPress={onSwap}
          amount={paymentAmount.toFixed()}
          token={
            tradeType === ESwapDirection.SELL ? balanceToken : paymentToken
          }
          balance={balance}
          paymentToken={paymentToken}
          networkId={networkId}
        />
      )}

      {/* Slippage setting */}
      <SlippageSetting
        autoDefaultValue={slippageAutoValue}
        isMEV={swapMevNetConfig?.includes(swapPanel.networkId ?? '')}
        onSlippageChange={(item) => setSlippage(item.value)}
      />
    </YStack>
  );
}
