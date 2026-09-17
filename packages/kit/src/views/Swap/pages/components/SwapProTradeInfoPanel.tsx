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
  return (
    <YStack gap="$2.5" flex={1}>
      <YStack gap="$3" flex={1}>
        <SwapProTokenDetailGroup />
        <SwapProPriceInfo marketData={marketData} onPricePress={onPricePress} />
        <SwapProTokenTransactionList marketData={marketData} />
      </YStack>
      <SwapProBuySellGroup supportSpeedSwap={supportSpeedSwap} />
    </YStack>
  );
};

export default SwapProTradeInfoPanel;
