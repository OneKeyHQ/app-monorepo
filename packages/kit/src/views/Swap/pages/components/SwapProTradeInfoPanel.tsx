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
    // The info block flexes so any residual column height sits between it and
    // the buy/sell group, pinning the group (and the 24H selector) to the
    // column bottom — flush with the action button in the trading column.
    <YStack gap="$2.5" flex={1}>
      <YStack gap="$3" flex={1}>
        <SwapProTokenDetailGroup />
        <SwapProPriceInfo onPricePress={onPricePress} />
        <SwapProTokenTransactionList supportSpeedSwap={supportSpeedSwap} />
      </YStack>
      <SwapProBuySellGroup supportSpeedSwap={supportSpeedSwap} />
    </YStack>
  );
};

export default SwapProTradeInfoPanel;
