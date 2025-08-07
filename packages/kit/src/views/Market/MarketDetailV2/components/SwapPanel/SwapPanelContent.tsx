import { useCallback, useRef } from 'react';

import BigNumber from 'bignumber.js';

import { YStack } from '@onekeyhq/components';
import type { useSwapPanel } from '@onekeyhq/kit/src/views/Market/MarketDetailV2/components/SwapPanel/hooks/useSwapPanel';
import type { IToken } from '@onekeyhq/kit/src/views/Market/MarketDetailV2/components/SwapPanel/types';

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
    if (balance) {
      setPaymentAmount(balance);
      tokenInputRef.current?.setValue(balance.toFixed());
    }
  }, [balance, setPaymentAmount]);
  return (
    <YStack gap="$4">
      {/* Trade type selector */}
      <TradeTypeSelector value={tradeType} onChange={setTradeType} />

      <YStack gap="$2">
        {/* Token input section */}
        <TokenInputSection
          ref={tokenInputRef}
          tradeType={tradeType}
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
