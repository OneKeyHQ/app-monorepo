import { usePerpsSelectedAccountAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import { usePromiseResult } from '../../../hooks/usePromiseResult';
import {
  useOpenOrdersListAtom,
  usePositionListAtom,
} from '../../../states/jotai/contexts/hyperliquid';

export function usePerpPositions() {
  const [positions] = usePositionListAtom();
  return positions;
}

export function usePerpOrders() {
  const [orders] = useOpenOrdersListAtom();
  return orders;
}

export function usePerpTradesHistory() {
  const [currentAccount] = usePerpsSelectedAccountAtom();
  const { result, isLoading } = usePromiseResult(
    async () => {
      if (currentAccount?.accountAddress) {
        const trades = await backgroundApiProxy.serviceHyperliquid.getUserFills(
          {
            user: currentAccount?.accountAddress,
            aggregateByTime: true,
          },
        );
        const sortedTrades = trades.sort((a, b) => b.time - a.time);
        return sortedTrades;
      }
      return [];
    },
    [currentAccount?.accountAddress],
    { watchLoading: true, initResult: [] },
  );
  return {
    trades: result,
    isLoading,
  };
}
