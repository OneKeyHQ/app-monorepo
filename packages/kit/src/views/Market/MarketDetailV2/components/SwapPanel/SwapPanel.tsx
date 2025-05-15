import { YStack } from '@onekeyhq/components';

import { ActionButton } from './components/ActionButton';
import { AmountInputSection } from './components/AmountInputSection';
import { AntiMEVToggle } from './components/AntiMEVToggle';
import { BalanceDisplay } from './components/BalanceDisplay';
import { QuickAmountSelector } from './components/QuickAmountSelector';
import { SlippageSetting } from './components/SlippageSetting';
import { TradeTypeSelector } from './components/TradeTypeSelector';
import { useSwapPanel } from './useSwapPanel';

export function SwapPanel() {
  const {
    amount,
    tradeType,
    antiMEV,
    handleAmountChange,
    handleTradeTypeChange,
    handleAntiMEVToggle,
    handleQuickAmountSelect,
    selectedTokenForAmountInput,
    selectableTokensForAmountInput,
    handleInputTokenChange,
    currentExecutingToken,
    totalValue,
    balance,
    balanceToken,
  } = useSwapPanel();

  return (
    <YStack gap="$4" p="$4" maxWidth="$100">
      <TradeTypeSelector value={tradeType} onChange={handleTradeTypeChange} />
      <AmountInputSection
        value={amount}
        onChange={handleAmountChange}
        selectedToken={selectedTokenForAmountInput}
        selectableTokens={selectableTokensForAmountInput}
        onTokenChange={handleInputTokenChange}
      />
      <QuickAmountSelector onSelect={handleQuickAmountSelect} />
      <BalanceDisplay balance={balance} token={balanceToken} />
      <ActionButton
        tradeType={tradeType}
        amount={amount}
        token={currentExecutingToken}
        totalValue={totalValue}
      />
      <SlippageSetting />
      <AntiMEVToggle value={antiMEV} onToggle={handleAntiMEVToggle} />
    </YStack>
  );
}
