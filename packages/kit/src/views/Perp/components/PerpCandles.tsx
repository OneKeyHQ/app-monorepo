import { useEffect } from 'react';

import { Stack } from '@onekeyhq/components';
import { TradingViewPerpsV2 } from '@onekeyhq/kit/src/components/TradingView/TradingViewPerpsV2/TradingViewPerpsV2';

import { useCurrentTokenAtom } from '../../../states/jotai/contexts/hyperliquid';
import { useHyperliquidAccount } from '../hooks';

export function PerpCandles() {
  const [currentToken] = useCurrentTokenAtom();
  const { currentUser } = useHyperliquidAccount();

  useEffect(() => {
    if (currentToken) {
      console.log('PerpCandles -> currentToken: ', currentToken);
    }
  }, [currentToken]);

  useEffect(() => {
    if (currentUser) {
      console.log('PerpCandles -> currentUser: ', currentUser);
    }
  }, [currentUser]);

  return (
    <Stack w="100%" h="100%">
      <TradingViewPerpsV2 userAddress={currentUser} symbol={currentToken} />
    </Stack>
  );
}
