import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import { usePromiseResult } from '../../../hooks/usePromiseResult';
import {
  useOpenOrdersListAtom,
  usePositionListAtom,
} from '../../../states/jotai/contexts/hyperliquid';

import { usePerpUseChainAccount } from './usePerpUseChainAccount';

export function usePerpPositions() {
  const [positions] = usePositionListAtom();
  return positions;
}

export function usePerpOrders() {
  const [orders] = useOpenOrdersListAtom();
  return orders;
}

export function usePerpTradesHistory() {
  const { userAddress } = usePerpUseChainAccount();
  const { result, isLoading } = usePromiseResult(
    async () => {
      if (userAddress) {
        const trades =
          await backgroundApiProxy.serviceHyperliquidInfo.getUserFillsByTime({
            user: userAddress,
            startTime: Date.now() - 1000 * 60 * 60 * 24 * 300, // 300 天前
            aggregateByTime: true,
          });

        const sortedTrades = trades.sort((a, b) => b.time - a.time);
        return sortedTrades;
      }
      return [];
    },
    [userAddress],
    { watchLoading: true, initResult: [] },
  );
  return {
    trades: result,
    isLoading,
  };
}
