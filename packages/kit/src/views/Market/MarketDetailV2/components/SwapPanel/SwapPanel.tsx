import { useState } from 'react';

import { YStack } from '@onekeyhq/components';

import { ActionButton } from './components/ActionButton';
import { AmountInputSection } from './components/AmountInputSection';
import { AntiMEVToggle } from './components/AntiMEVToggle';
import { BalanceDisplay } from './components/BalanceDisplay';
import { QuickAmountSelector } from './components/QuickAmountSelector';
import { SlippageSetting } from './components/SlippageSetting';
import { TradeTypeSelector } from './components/TradeTypeSelector';

export function SwapPanel() {
  const [amount, setAmount] = useState('1');

  return (
    <YStack gap="$4" p="$4" maxWidth="$100">
      <TradeTypeSelector />
      <AmountInputSection value={amount} onChange={setAmount} />
      <QuickAmountSelector />
      <BalanceDisplay />
      <ActionButton />
      <SlippageSetting />
      <AntiMEVToggle />
    </YStack>
  );
}
