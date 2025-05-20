/* eslint-disable @typescript-eslint/no-unused-vars */

import { useEffect } from 'react';

import BigNumber from 'bignumber.js';

import { YStack } from '@onekeyhq/components';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { ActionButton } from './components/ActionButton';
import { AntiMEVToggle } from './components/AntiMEVToggle';
import { ApproveButton } from './components/ApproveButton';
import { BalanceDisplay } from './components/BalanceDisplay';
import { SlippageSetting } from './components/SlippageSetting';
import { SwapTestPanel } from './components/SwapTestPanel';
import { TokenInputSection } from './components/TokenInputSection';
import { TradeTypeSelector } from './components/TradeTypeSelector';
import { UnsupportedSwapWarning } from './components/UnsupportedSwapWarning';
import { useSpeedSwapActions } from './hooks/useSpeedSwapActions';
import { useSpeedSwapInit } from './hooks/useSpeedSwapInit';
import { useSwapPanel } from './hooks/useSwapPanel';

export function SwapPanel() {
  const swapPanel = useSwapPanel();
  const {
    antiMEV,
    balance,
    balanceToken,
    handleAntiMEVToggle,
    isApproved,
    networkId,
    paymentAmount,
    paymentToken,
    setIsApproved,
    setPaymentAmount,
    setPaymentToken,
    setTradeType,
    tradeType,
  } = swapPanel;

  const { isLoading, speedConfig, supportSpeedSwap, provider, defaultTokens } =
    useSpeedSwapInit(networkId ?? '');

  const {
    speedSwapBuildTx,
    speedSwapBuildTxLoading,
    cancelSpeedSwapBuildTx,
    handleSpeedSwapBuildTxSuccess,
  } = useSpeedSwapActions({
    networkId: networkId ?? '',
    accountId: '',
  });

  useEffect(() => {
    if (defaultTokens.length > 0) {
      setPaymentToken(defaultTokens[0]);
    }
  }, [defaultTokens, setPaymentToken]);

  return (
    <YStack gap="$4" p="$4" maxWidth="$100">
      {/* Trade type selector */}
      <TradeTypeSelector value={tradeType} onChange={setTradeType} />

      {/* Token input section */}
      <TokenInputSection
        tradeType={tradeType}
        value={paymentAmount.toFixed()}
        onChange={(amount) => setPaymentAmount(new BigNumber(amount))}
        selectedToken={paymentToken}
        selectableTokens={defaultTokens}
        onTokenChange={(token) => setPaymentToken(token)}
      />

      {/* Balance display */}
      <BalanceDisplay balance={balance} token={balanceToken} />

      {/* Unsupported swap warning */}
      {!supportSpeedSwap ? <UnsupportedSwapWarning /> : null}

      {!isApproved ? (
        <ApproveButton
          onApprove={() => {
            setIsApproved(true);
          }}
        />
      ) : (
        <ActionButton
          disabled={!supportSpeedSwap}
          loading={isLoading}
          tradeType={tradeType}
          amount={paymentAmount.toFixed()}
          token={paymentToken}
          totalValue={888}
        />
      )}

      {/* Slippage setting */}
      <SlippageSetting autoValue={speedConfig?.slippage} isMEV={antiMEV} />

      {/* AntiMEV toggle */}
      <AntiMEVToggle value={antiMEV} onToggle={handleAntiMEVToggle} />

      {/* Test - Only in Dev Mode */}
      {platformEnv.isDev ? <SwapTestPanel swapPanel={swapPanel} /> : null}
    </YStack>
  );
}
