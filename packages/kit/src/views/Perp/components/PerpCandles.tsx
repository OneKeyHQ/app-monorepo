import { Stack } from '@onekeyhq/components';
import { TradingViewPerpsV2 } from '@onekeyhq/kit/src/components/TradingView/TradingViewPerpsV2/TradingViewPerpsV2';

import { useCurrentTokenAtom } from '../../../states/jotai/contexts/hyperliquid';
import { usePerpUseChainAccount } from '../hooks/usePerpUseChainAccount';

export function PerpCandles() {
  const [currentToken] = useCurrentTokenAtom();
  const { userAddress } = usePerpUseChainAccount();

  return (
    <Stack w="100%" h="100%">
      <TradingViewPerpsV2 userAddress={userAddress} symbol={currentToken} />
    </Stack>
  );
}
