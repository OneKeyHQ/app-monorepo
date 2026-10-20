import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Dispatch, SetStateAction } from 'react';

import type {
  IDustSweepNetwork,
  IDustSweepRouteParams,
  IDustSweepSnapshot,
} from '@onekeyhq/shared/types/swap/dustSweep';

import { refreshDustSweepNetwork } from '../utils/loadNetworks';

import type { IDustSweepState } from '../stateMachine';

function getOwnerKey(
  owner: Pick<IDustSweepSnapshot, 'accountId' | 'address' | 'networkId'>,
) {
  return `${owner.accountId}:${owner.address}:${owner.networkId}`;
}

export function getDustSweepNetworkOwner(entry: IDustSweepNetwork) {
  return getOwnerKey({ ...entry, networkId: entry.network.networkId });
}

type IReconciliation = {
  status: 'refreshing' | 'ready' | 'error';
  sweptKeys: Set<string>;
};

type TOnRefreshed = (ownerKey: string) => void;

export function useDustSweepReconciliation({
  params,
  networks,
  setNetworks,
  onRefreshed,
}: {
  params: IDustSweepRouteParams;
  networks: IDustSweepNetwork[];
  setNetworks: Dispatch<SetStateAction<IDustSweepNetwork[]>>;
  onRefreshed: TOnRefreshed;
}) {
  const scope = useMemo(
    () => ({
      params,
      processed: new Set<string>(),
      requests: new Map<string, AbortController>(),
    }),
    [params],
  );
  const activeScope = useRef(scope);
  activeScope.current = scope;
  const [state, setState] = useState<{
    scope: typeof scope;
    entries: Record<string, IReconciliation>;
  }>({ scope, entries: {} });
  const entries = state.scope === scope ? state.entries : {};

  useEffect(
    () => () => {
      scope.requests.forEach((request) => request.abort());
    },
    [scope],
  );

  const refresh = useCallback(
    (entry: IDustSweepNetwork, sweptKeys: string[] = []) => {
      const key = getDustSweepNetworkOwner(entry);
      scope.requests.get(key)?.abort();
      const controller = new AbortController();
      scope.requests.set(key, controller);
      setState((previous) => {
        const current = previous.scope === scope ? previous.entries : {};
        return {
          scope,
          entries: {
            ...current,
            [key]: {
              status: 'refreshing',
              sweptKeys: new Set([
                ...(current[key]?.sweptKeys ?? []),
                ...sweptKeys,
              ]),
            },
          },
        };
      });
      const isCurrent = () =>
        activeScope.current === scope && !controller.signal.aborted;
      void refreshDustSweepNetwork(
        { entry, indexedAccountId: params.indexedAccountId },
        controller.signal,
      )
        .then((updated) => {
          if (!isCurrent()) return;
          setNetworks((previous) =>
            previous.map((network) =>
              getDustSweepNetworkOwner(network) === key ? updated : network,
            ),
          );
          // Even unchanged balances need a new quote after a finished batch.
          // The caller decides whether this owner is still active.
          onRefreshed(key);
          setState((previous) => ({
            ...previous,
            entries: {
              ...previous.entries,
              [key]: { ...previous.entries[key], status: 'ready' },
            },
          }));
        })
        .catch(() => {
          if (!isCurrent()) return;
          setState((previous) => ({
            ...previous,
            entries: {
              ...previous.entries,
              [key]: { ...previous.entries[key], status: 'error' },
            },
          }));
        })
        .finally(() => {
          if (scope.requests.get(key) === controller)
            scope.requests.delete(key);
        });
    },
    [onRefreshed, params.indexedAccountId, scope, setNetworks],
  );

  const markFullLoadReady = useCallback(
    (updated: IDustSweepNetwork[]) => {
      const refreshedOwners = new Set(updated.map(getDustSweepNetworkOwner));
      setState((previous) => {
        const current = previous.scope === scope ? previous.entries : {};
        return {
          scope,
          entries: Object.entries(current).reduce<
            Record<string, IReconciliation>
          >((next, [key, entry]) => {
            next[key] = refreshedOwners.has(key)
              ? { ...entry, status: 'ready' }
              : entry;
            return next;
          }, {}),
        };
      });
    },
    [scope],
  );

  const reconcile = useCallback(
    (batch: IDustSweepState) => {
      if (batch.phase !== 'completed' || !batch.snapshot) return;
      if (scope.processed.has(batch.snapshot.id)) return;
      scope.processed.add(batch.snapshot.id);
      // Failed swaps and approvals can spend gas even without a successful swap.
      if (!batch.items.some((item) => item.txId || item.approvalTxIds?.length))
        return;
      const key = getOwnerKey(batch.snapshot);
      const entry = networks.find(
        (network) => getDustSweepNetworkOwner(network) === key,
      );
      if (entry)
        refresh(
          entry,
          batch.items
            .filter((item) => item.status === 'success')
            .map((item) => item.token.key),
        );
    },
    [networks, refresh, scope],
  );

  return {
    entries,
    isRefreshing: () => scope.requests.size > 0,
    markFullLoadReady,
    reconcile,
    refresh,
  };
}
