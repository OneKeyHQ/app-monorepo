import { YStack } from '@onekeyhq/components';

import SwapProBuySellGroup from './SwapProBuySellGroup';
import SwapProPriceInfo from './SwapProPriceInfo';
import SwapProTokenDetailGroup from './SwapProTokenDetailGroup';
import SwapProTokenTransactionList from './SwapProTokenTransactionList';

const SwapProTradeInfoPanel = () => {
  return (
    <YStack gap="$3" flex={1}>
      <SwapProTokenDetailGroup />
      <SwapProPriceInfo />
      <SwapProTokenTransactionList />
      <SwapProBuySellGroup />
    </YStack>
  );
};

export default SwapProTradeInfoPanel;
