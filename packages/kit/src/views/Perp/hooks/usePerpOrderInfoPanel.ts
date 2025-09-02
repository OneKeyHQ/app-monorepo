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

export function usePerpTradesHistory({ useAddress }: { useAddress?: string }) {
  const { result, isLoading } = usePromiseResult(
    async () => {
      if (useAddress) {
        const addressHex = useAddress as `0x${string}`;
        const trades =
          await backgroundApiProxy.serviceHyperliquidInfo.getUserFillsByTime({
            user: addressHex,
            startTime: Date.now() - 1000 * 60 * 60 * 24 * 12, // 12 天前
            aggregateByTime: true,
          });
        return trades;
      }
      return [];
    },
    [useAddress],
    { watchLoading: true, initResult: [] },
  );
  return {
    trades: result,
    isLoading,
  };
}
