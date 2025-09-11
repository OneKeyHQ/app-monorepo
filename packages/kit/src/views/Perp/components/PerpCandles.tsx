import { useEffect } from 'react';

import { Stack } from '@onekeyhq/components';
import { TradingViewPerpsV2 } from '@onekeyhq/kit/src/components/TradingView/TradingViewPerpsV2/TradingViewPerpsV2';

import { useCurrentTokenAtom } from '../../../states/jotai/contexts/hyperliquid';
import { useHyperliquidAccount } from '../hooks';
import { usePerpUseChainAccount } from '../hooks/usePerpUseChainAccount';

export function PerpCandles() {
  const [currentToken] = useCurrentTokenAtom();
  const { userAddress } = usePerpUseChainAccount();

  useEffect(() => {
    if (currentToken) {
      console.log('PerpCandles -> currentToken: ', currentToken);
    }
  }, [currentToken]);

  useEffect(() => {
    if (userAddress) {
      console.log('PerpCandles -> currentUser: ', userAddress);
    }
  }, [userAddress]);

  return (
    <Stack w="100%" h="100%">
      <TradingViewPerpsV2 userAddress={userAddress} symbol={currentToken} />
    </Stack>
  );
}
