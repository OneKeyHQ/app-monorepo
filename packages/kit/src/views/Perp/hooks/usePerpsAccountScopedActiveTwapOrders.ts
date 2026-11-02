import { useMemo } from 'react';

import {
  usePerpsActiveTwapOrdersAtom,
  usePerpsTwapHistoryAtom,
} from '@onekeyhq/kit/src/states/jotai/contexts/hyperliquid/atoms';
import {
  buildActiveTwapRuntimeInfoById,
  isTerminalTwapStatus,
} from '@onekeyhq/shared/src/utils/hyperliquidTwapUtils';

import { getPerpsAccountScopedListData } from '../utils/accountScopedData';

export function usePerpsAccountScopedActiveTwapOrders(
  accountAddress: string | null | undefined,
) {
  const [ordersState] = usePerpsActiveTwapOrdersAtom();
  const [historyState] = usePerpsTwapHistoryAtom();
  const historyRows = useMemo(
    () =>
      accountAddress
        ? getPerpsAccountScopedListData({
            activeAccountAddress: accountAddress,
            dataAccountAddress: historyState.accountAddress,
            data: historyState.history,
          })
        : [],
    [accountAddress, historyState.accountAddress, historyState.history],
  );
  const activeRuntimeInfoById = useMemo(
    () => buildActiveTwapRuntimeInfoById(historyRows),
    [historyRows],
  );
  const twapOrders = useMemo(
    () =>
      accountAddress
        ? getPerpsAccountScopedListData({
            activeAccountAddress: accountAddress,
            dataAccountAddress: ordersState.accountAddress,
            data: ordersState.twapOrders,
          }).filter(
            (order) =>
              !isTerminalTwapStatus(
                activeRuntimeInfoById.get(order.twapId)?.reportedStatus,
              ),
          )
        : [],
    [
      accountAddress,
      activeRuntimeInfoById,
      ordersState.accountAddress,
      ordersState.twapOrders,
    ],
  );

  return { twapOrders, historyRows, activeRuntimeInfoById };
}
