import { YStack } from '@onekeyhq/components';

import SwapProBuySellGroup from './SwapProBuySellGroup';
import SwapProPriceInfo from './SwapProPriceInfo';
import SwapProTokenDetailGroup from './SwapProTokenDetailGroup';
import SwapProTokenTransactionList from './SwapProTokenTransactionList';

const SwapProTradeInfoPanel = () => {
  return (
    <YStack gap="$2.5" flex={1} justifyContent="space-between">
      <YStack gap="$3">
        <SwapProTokenDetailGroup />
        <SwapProPriceInfo />
        <SwapProTokenTransactionList />
      </YStack>
      <SwapProBuySellGroup />
    </YStack>
  );
};

export default SwapProTradeInfoPanel;
