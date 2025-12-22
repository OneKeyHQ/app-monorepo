import { YStack } from '@onekeyhq/components';

import SwapProBuySellGroup from './SwapProBuySellGroup';
import SwapProPriceInfo from './SwapProPriceInfo';
import SwapProTokenDetailGroup from './SwapProTokenDetailGroup';
import SwapProTokenTransactionList from './SwapProTokenTransactionList';

interface ISwapProTradeInfoPanelProps {
  onPricePress: (price: string) => void;
}
const SwapProTradeInfoPanel = ({
  onPricePress,
}: ISwapProTradeInfoPanelProps) => {
  return (
    <YStack gap="$2.5" flex={1} justifyContent="space-between">
      <YStack gap="$3">
        <SwapProTokenDetailGroup />
        <SwapProPriceInfo onPricePress={onPricePress} />
        <SwapProTokenTransactionList />
      </YStack>
      <SwapProBuySellGroup />
    </YStack>
  );
};

export default SwapProTradeInfoPanel;
