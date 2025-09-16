import { Stack } from '@onekeyhq/components';
import { TradingViewPerpsV2 } from '@onekeyhq/kit/src/components/TradingView/TradingViewPerpsV2/TradingViewPerpsV2';
import { usePerpsSelectedAccountAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';

import { useCurrentTokenAtom } from '../../../states/jotai/contexts/hyperliquid';

export function PerpCandles() {
  const [currentToken] = useCurrentTokenAtom();
  const [currentAccount] = usePerpsSelectedAccountAtom();

  return (
    <Stack w="100%" h="100%">
      <TradingViewPerpsV2
        userAddress={currentAccount?.accountAddress}
        symbol={currentToken}
      />
    </Stack>
  );
}
