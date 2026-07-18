import { YStack } from '@onekeyhq/components';

import SwapProBuySellGroup from './SwapProBuySellGroup';
import SwapProPriceInfo from './SwapProPriceInfo';
import SwapProTokenDetailGroup from './SwapProTokenDetailGroup';
import SwapProTokenTransactionList from './SwapProTokenTransactionList';

interface ISwapProTradeInfoPanelProps {
  onPricePress: (price: string) => void;
  supportSpeedSwap?: boolean;
}
const SwapProTradeInfoPanel = ({
  onPricePress,
  supportSpeedSwap,
}: ISwapProTradeInfoPanelProps) => {
  return (
    // Natural flow (no space-between): otherwise the spare column height is
    // dumped above the buy/sell ratio group as a stray gap, and the taller
    // column keeps the whole panel (and the action button) pushed down.
    <YStack gap="$2.5" flex={1}>
      <YStack gap="$3">
        <SwapProTokenDetailGroup />
        <SwapProPriceInfo onPricePress={onPricePress} />
        <SwapProTokenTransactionList supportSpeedSwap={supportSpeedSwap} />
      </YStack>
      <SwapProBuySellGroup supportSpeedSwap={supportSpeedSwap} />
    </YStack>
  );
};

export default SwapProTradeInfoPanel;
