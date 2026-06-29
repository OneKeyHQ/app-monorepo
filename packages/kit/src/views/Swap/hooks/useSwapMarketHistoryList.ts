import { useEffect, useMemo } from 'react';

import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import { useInAppNotificationAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { appEventBus } from '@onekeyhq/shared/src/eventBus/appEventBus';
import { EAppEventBusNames } from '@onekeyhq/shared/src/eventBus/appEventBusNames';
import type { EProtocolOfExchange } from '@onekeyhq/shared/types/swap/types';

import { getSwapMarketPendingHistoryKey } from '../utils/swapMarketHistory';

// Reads the persisted swap history and keeps it fresh on the two signals that
// can change it: a pending order transitioning (via the derived key, which also
// drives pending-status polling) and the explicit RefreshSwapHistoryList event
// cleanSwapHistoryItems emits — the pending key cannot detect a finished-order
// clear, so the event covers that gap. Shared by the list view and the clear
// control so the fetch + subscription is defined once.
export function useSwapMarketHistoryList(protocol?: EProtocolOfExchange) {
  const [{ swapHistoryPendingList }] = useInAppNotificationAtom();
  const marketPendingKey = useMemo(
    () => getSwapMarketPendingHistoryKey(swapHistoryPendingList, protocol),
    [protocol, swapHistoryPendingList],
  );
  const { result, isLoading, run } = usePromiseResult(
    async () => backgroundApiProxy.serviceSwap.fetchSwapHistoryListFromSimple(),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [marketPendingKey],
    { watchLoading: true },
  );
  useEffect(() => {
    const handleRefresh = () => {
      void run();
    };
    appEventBus.on(EAppEventBusNames.RefreshSwapHistoryList, handleRefresh);
    return () => {
      appEventBus.off(EAppEventBusNames.RefreshSwapHistoryList, handleRefresh);
    };
  }, [run]);

  return { swapTxHistoryList: result, isLoading };
}
