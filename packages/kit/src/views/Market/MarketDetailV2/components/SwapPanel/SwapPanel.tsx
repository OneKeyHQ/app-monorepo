/* eslint-disable @typescript-eslint/no-unused-vars */
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
    amount,
    tradeType,
    antiMEV,
    handleAmountChange,
    handleTradeTypeChange,
    handleAntiMEVToggle,
    selectedTokenForAmountInput,
    selectableTokensForAmountInput,
    handleInputTokenChange,
    currentExecutingToken,
    totalValue,
    balance,
    balanceToken,
    networkId,
    isApproved,
    setIsApproved,
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

  return (
    <YStack gap="$4" p="$4" maxWidth="$100">
      {/* Trade type selector */}
      <TradeTypeSelector value={tradeType} onChange={handleTradeTypeChange} />

      {/* Token input section */}
      <TokenInputSection
        tradeType={tradeType}
        value={amount}
        onChange={handleAmountChange}
        selectedToken={selectedTokenForAmountInput}
        selectableTokens={defaultTokens.map((token) => ({
          label: token.symbol,
          value: token.symbol,
          price: 1,
          decimals: token.decimals,
          logoURI: token.logoURI,
        }))}
        onTokenChange={handleInputTokenChange}
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
          amount={amount}
          token={currentExecutingToken}
          totalValue={totalValue}
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
