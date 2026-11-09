import { useEffect, useMemo } from 'react';

import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import { selectHeadlessBuyOrders } from '@onekeyhq/shared/src/modules3rdParty/onramper/orderStatus';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import type { IHeadlessBuyOrder } from '@onekeyhq/shared/types/fiatCrypto';

const EMPTY: IHeadlessBuyOrder[] = [];

// Device-local native buy orders. Reads the background store and re-reads on
// HeadlessBuyOrdersChanged; `refreshOnMount` performs ONE status lookup round
// (the product spec allows lookups only on page entry and on the detail
// page's focused poll — never in the background). Native iOS only: orders
// can only be created there, and other platforms must not even query.
export function useHeadlessBuyOrders({
  refreshOnMount = false,
}: { refreshOnMount?: boolean } = {}) {
  const enabled = platformEnv.isNativeIOS;
  const { result, run, isLoading } = usePromiseResult(
    async () =>
      enabled
        ? backgroundApiProxy.serviceFiatCrypto.getHeadlessBuyOrders()
        : EMPTY,
    [enabled],
    { watchLoading: true },
  );
  useEffect(() => {
    if (!enabled) {
      return undefined;
    }
    const handleChanged = () => {
      void run({ alwaysSetState: true });
    };
    appEventBus.on(EAppEventBusNames.HeadlessBuyOrdersChanged, handleChanged);
    return () => {
      appEventBus.off(
        EAppEventBusNames.HeadlessBuyOrdersChanged,
        handleChanged,
      );
    };
  }, [enabled, run]);
  useEffect(() => {
    if (enabled && refreshOnMount) {
      void backgroundApiProxy.serviceFiatCrypto.refreshHeadlessBuyOrders({});
    }
  }, [enabled, refreshOnMount]);
  const orders = result ?? EMPTY;
  // False until the first read has landed — pages hold their empty state
  // back until then instead of flashing "no orders" on entry.
  const isReady = !enabled || result !== undefined;
  const selection = useMemo(() => selectHeadlessBuyOrders(orders), [orders]);
  return { orders, ...selection, isReady, isLoading, refresh: run };
}
