import { useCallback, useRef } from 'react';

import BigNumber from 'bignumber.js';

import { YStack } from '@onekeyhq/components';

import { ActionButton } from './components/ActionButton';
import { AntiMEVToggle } from './components/AntiMEVToggle';
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
import { useSwapPanel } from './hooks/useSwapPanel';
import { ESwapDirection } from './hooks/useTradeType';

export type ISwapPanelContentProps = {
  onApprove: () => void;
  onSwap: () => void;
};

export function SwapPanelContent(props: ISwapPanelContentProps) {
  const { onApprove, onSwap } = props;

  // Get all state from atoms via useSwapPanel hook
  const {
    paymentToken,
    setPaymentAmount,
    setPaymentToken,
    antiMEV,
    tradeType,
    setTradeType,
    networkId,
    balance,
    balanceToken,
    defaultTokens,
    supportSpeedSwap,
    isLoading,
    isApproved,
    swapMevNetConfig,
    priceRate,
  } = useSwapPanel();

  const tokenInputRef = useRef<ITokenInputSectionRef>(null);

  const handleBalanceClick = useCallback(() => {
    if (balance) {
      setPaymentAmount(balance);
      tokenInputRef.current?.setValue(balance.toFixed());
    }
  }, [balance, setPaymentAmount]);
  return (
    <YStack gap="$4" p="$4" maxWidth="$100">
      {/* Trade type selector */}
      <TradeTypeSelector value={tradeType} onChange={setTradeType} />

      {/* Token input section */}
      <TokenInputSection
        ref={tokenInputRef}
        tradeType={tradeType}
        onChange={(amount) => setPaymentAmount(new BigNumber(amount))}
        selectedToken={
          tradeType === ESwapDirection.SELL
            ? (balanceToken as any)
            : paymentToken
        }
        selectableTokens={defaultTokens}
        onTokenChange={(token) => setPaymentToken(token)}
        balance={balance}
      />

      {/* Rate display */}
      {priceRate ? (
        <RateDisplay
          rate={priceRate?.rate}
          fromTokenSymbol={priceRate?.fromTokenSymbol}
          toTokenSymbol={priceRate?.toTokenSymbol}
        />
      ) : null}

      {/* Balance display */}
      <BalanceDisplay onBalanceClick={handleBalanceClick} />

      {/* Unsupported swap warning */}
      {!isLoading && !supportSpeedSwap ? <UnsupportedSwapWarning /> : null}

      {!isApproved ? (
        <ApproveButton onApprove={onApprove} loading={isLoading} />
      ) : (
        <ActionButton
          disabled={!supportSpeedSwap}
          loading={isLoading}
          onPress={onSwap}
          token={
            tradeType === ESwapDirection.SELL
              ? (balanceToken as any)
              : paymentToken
          }
        />
      )}

      {/* Slippage setting */}
      <SlippageSetting autoDefaultValue={0.5} isMEV={antiMEV} />

      {/* AntiMEV toggle */}
      {swapMevNetConfig?.includes(networkId ?? '') ? <AntiMEVToggle /> : null}
    </YStack>
  );
}
