import { useMemo } from 'react';

import { YStack } from '@onekeyhq/components';
import {
  useSwapProSelectTokenAtom,
  useSwapProTokenDetailWebsocketAtom,
  useSwapProTokenMarketDetailInfoAtom,
  useSwapTypeSwitchAtom,
} from '@onekeyhq/kit/src/states/jotai/contexts/swap';
import { ESwapTabSwitchType } from '@onekeyhq/shared/types/swap/types';

import { useSwapProMarketData } from '../../hooks/useSwapProMarketData';
import { isSwapProHyperliquidBtcToken } from '../../utils/swapProTransactionSource';

import SwapProBuySellGroup from './SwapProBuySellGroup';
import SwapProPriceInfo from './SwapProPriceInfo';
import SwapProTokenDetailGroup from './SwapProTokenDetailGroup';
import SwapProTokenTransactionList from './SwapProTokenTransactionList';

interface ISwapProTradeInfoPanelProps {
  onPricePress: (price: string) => void;
  isFocused: boolean;
  supportSpeedSwap?: boolean;
}
const SwapProTradeInfoPanel = ({
  onPricePress,
  isFocused,
  supportSpeedSwap,
}: ISwapProTradeInfoPanelProps) => {
  const [swapProSelectToken] = useSwapProSelectTokenAtom();
  const [swapTypeSwitch] = useSwapTypeSwitchAtom();
  const [swapProTokenWebsocket] = useSwapProTokenDetailWebsocketAtom();
  const [swapProTokenMarketDetailInfo] = useSwapProTokenMarketDetailInfoAtom();
  const enableMarketWebSocket = useMemo(
    () =>
      Boolean(
        swapProTokenWebsocket?.txs &&
        swapTypeSwitch === ESwapTabSwitchType.LIMIT,
      ),
    [swapProTokenWebsocket?.txs, swapTypeSwitch],
  );
  const marketData = useSwapProMarketData({
    tokenAddress: swapProSelectToken?.contractAddress ?? '',
    networkId: swapProSelectToken?.networkId ?? '',
    symbol: swapProSelectToken?.symbol ?? '',
    isNative: swapProSelectToken?.isNative,
    enabled: isFocused,
    enableMarketWebSocket,
    marketSnapshotPrice: swapProTokenMarketDetailInfo?.price,
  });
  const isHyperliquidBtc = isSwapProHyperliquidBtcToken(swapProSelectToken);
  return (
    // Regular tokens keep the existing bottom alignment. BTC has no buy/sell
    // ratio block, so let the 24H selector follow the fixed-height trade list
    // instead of placing the missing ratio block's space between them.
    <YStack gap="$2.5" flex={1}>
      <YStack gap="$3" flex={isHyperliquidBtc ? undefined : 1}>
        <SwapProTokenDetailGroup />
        <SwapProPriceInfo marketData={marketData} onPricePress={onPricePress} />
        <SwapProTokenTransactionList marketData={marketData} />
      </YStack>
      <SwapProBuySellGroup supportSpeedSwap={supportSpeedSwap} />
    </YStack>
  );
};

export default SwapProTradeInfoPanel;
