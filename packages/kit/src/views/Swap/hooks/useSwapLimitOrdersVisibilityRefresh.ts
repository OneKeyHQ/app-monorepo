import { useCallback, useEffect, useMemo } from 'react';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import { useHandleAppStateActive } from '../../../hooks/useHandleAppStateActive';
import { useActiveAccount } from '../../../states/jotai/contexts/accountSelector';

export function useSwapLimitOrdersVisibilityRefresh({
  enabled,
}: {
  enabled: boolean;
}) {
  const { activeAccount } = useActiveAccount({ num: 0 });
  const shouldRefresh = enabled && activeAccount.ready;
  const refresh = useCallback(() => {
    if (!shouldRefresh) {
      return;
    }
    void backgroundApiProxy.serviceSwap.refreshSwapLimitOrders(
      activeAccount.indexedAccount?.id,
      !activeAccount.indexedAccount?.id
        ? (activeAccount.account?.id ?? activeAccount.dbAccount?.id)
        : undefined,
    );
  }, [
    activeAccount.account?.id,
    activeAccount.dbAccount?.id,
    activeAccount.indexedAccount?.id,
    shouldRefresh,
  ]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const appStateHandlers = useMemo(
    () => ({
      onActiveFromBlur: refresh,
    }),
    [refresh],
  );
  useHandleAppStateActive(
    shouldRefresh ? refresh : undefined,
    shouldRefresh ? appStateHandlers : undefined,
  );
}
