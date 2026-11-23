import { useEffect } from 'react';

import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import type { IAppEventBusPayload } from '@onekeyhq/shared/src/eventBus/appEventBus';

type ISettledOrder =
  IAppEventBusPayload[EAppEventBusNames.EarnServerOrderSettled];

/** Refresh data only; completion must never replay a navigation callback. */
export function useEarnServerOrderRefresh({
  accountId,
  indexedAccountId,
  networkId,
  provider,
  vault,
  onRefresh,
}: {
  accountId?: string;
  indexedAccountId?: string;
  networkId?: string;
  provider?: string;
  vault?: string;
  onRefresh: (order: ISettledOrder) => void;
}) {
  useEffect(() => {
    const onSettled = (order: ISettledOrder) => {
      // Portfolio accounts can span networks; only match siblings when the
      // background resolved the original account's indexed identity.
      const matchesAccount =
        (accountId && accountId === order.accountId) ||
        (indexedAccountId && indexedAccountId === order.indexedAccountId);
      if (
        matchesAccount &&
        (!networkId || networkId === order.networkId) &&
        (!provider ||
          provider.toLowerCase() === order.provider.toLowerCase()) &&
        (!vault || vault.toLowerCase() === order.vault?.toLowerCase())
      ) {
        onRefresh(order);
      }
    };
    appEventBus.on(EAppEventBusNames.EarnServerOrderSettled, onSettled);
    return () => {
      appEventBus.off(EAppEventBusNames.EarnServerOrderSettled, onSettled);
    };
  }, [accountId, indexedAccountId, networkId, provider, vault, onRefresh]);
}
