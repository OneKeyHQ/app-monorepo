import { YStack } from '@onekeyhq/components';

import { ActionButton } from './components/ActionButton';
import { AntiMEVToggle } from './components/AntiMEVToggle';
import { BalanceDisplay } from './components/BalanceDisplay';
import { SlippageSetting } from './components/SlippageSetting';
import { TokenInputSection } from './components/TokenInputSection';
import { TradeTypeSelector } from './components/TradeTypeSelector';
import { UnsupportedSwapWarning } from './components/UnsupportedSwapWarning';
import { useSwapPanel } from './useSwapPanel';

export function SwapPanel() {
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
    showUnsupportedSwapWarning,
  } = useSwapPanel();

  return (
    <YStack gap="$4" p="$4" maxWidth="$100">
      {/* Trade type selector */}
      <TradeTypeSelector value={tradeType} onChange={handleTradeTypeChange} />

      {/* Token input section */}
      <TokenInputSection
        value={amount}
        onChange={handleAmountChange}
        selectedToken={selectedTokenForAmountInput}
        selectableTokens={selectableTokensForAmountInput}
        onTokenChange={handleInputTokenChange}
      />

      {/* Balance display */}
      <BalanceDisplay balance={balance} token={balanceToken} />

      {/* Unsupported swap warning */}
      {showUnsupportedSwapWarning ? <UnsupportedSwapWarning /> : null}

      {/* Buy button */}
      <ActionButton
        tradeType={tradeType}
        amount={amount}
        token={currentExecutingToken}
        totalValue={totalValue}
      />

      {/* Slippage setting */}
      <SlippageSetting />

      {/* AntiMEV toggle */}
      <AntiMEVToggle value={antiMEV} onToggle={handleAntiMEVToggle} />
    </YStack>
  );
}
