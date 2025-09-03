import { useEffect } from 'react';

import { Stack } from '@onekeyhq/components';
import { TradingViewPerpsV2 } from '@onekeyhq/kit/src/components/TradingView/TradingViewPerpsV2/TradingViewPerpsV2';

import { useCurrentTokenAtom } from '../../../states/jotai/contexts/hyperliquid';

export function PerpCandles() {
  const [currentToken] = useCurrentTokenAtom();

  useEffect(() => {
    if (currentToken) {
      console.log('PerpCandles -> currentToken: ', currentToken);
    }
  }, [currentToken]);

  return (
    <Stack w="100%" h="100%">
      <TradingViewPerpsV2 symbol={currentToken} />
    </Stack>
  );
}
