import { YStack } from '@onekeyhq/components';
import { useSwapProSelectTokenAtom } from '@onekeyhq/kit/src/states/jotai/contexts/swap';

import { isSwapProHyperliquidBtcToken } from '../../utils/swapProTransactionSource';

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
  const [swapProSelectToken] = useSwapProSelectTokenAtom();
  const isHyperliquidBtc = isSwapProHyperliquidBtcToken(swapProSelectToken);
  return (
    // Regular tokens keep the existing bottom alignment. BTC has no buy/sell
    // ratio block, so let the 24H selector follow the fixed-height trade list
    // instead of placing the missing ratio block's space between them.
    <YStack gap="$2.5" flex={1}>
      <YStack gap="$3" flex={isHyperliquidBtc ? undefined : 1}>
        <SwapProTokenDetailGroup />
        <SwapProPriceInfo onPricePress={onPricePress} />
        <SwapProTokenTransactionList supportSpeedSwap={supportSpeedSwap} />
      </YStack>
      <SwapProBuySellGroup supportSpeedSwap={supportSpeedSwap} />
    </YStack>
  );
};

export default SwapProTradeInfoPanel;
