import { YStack } from '@onekeyhq/components';

import SwapProPriceInfo from './SwapProPriceInfo';
import SwapProTokenDetailGroup from './SwapProTokenDetailGroup';

const SwapProTradeInfoPanel = () => {
  return (
    <YStack gap="$3" flex={1}>
      <SwapProTokenDetailGroup />
      <SwapProPriceInfo />
    </YStack>
  );
};

export default SwapProTradeInfoPanel;
