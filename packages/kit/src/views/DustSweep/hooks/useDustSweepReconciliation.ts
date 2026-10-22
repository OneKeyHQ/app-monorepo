import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Dispatch, SetStateAction } from 'react';

import type {
  IDustSweepNetwork,
  IDustSweepRouteParams,
  IDustSweepSnapshot,
} from '@onekeyhq/shared/types/swap/dustSweep';

import { refreshDustSweepNetwork } from '../utils/loadNetworks';

import type { IDustSweepState } from '../stateMachine';

export function getDustSweepSnapshotOwner(
  owner: Pick<IDustSweepSnapshot, 'accountId' | 'address' | 'networkId'>,
) {
  return `${owner.accountId}:${owner.address}:${owner.networkId}`;
}

export function getDustSweepNetworkOwner(entry: IDustSweepNetwork) {
  return getDustSweepSnapshotOwner({
    ...entry,
    networkId: entry.network.networkId,
  });
}

type IReconciliation = {
  status: 'refreshing' | 'ready' | 'error';
  sweptKeys: Set<string>;
};

type TOnRefreshed = (ownerKey: string) => void;

type IReconciliationScope = {
  history: { params: IDustSweepRouteParams; processed: Set<string> };
  identityRevision?: number;
  requests: Map<string, AbortController>;
};

type IReconciliationState = {
  scope: IReconciliationScope;
  entries: Record<string, IReconciliation>;
};

function getEntries(state: IReconciliationState, scope: IReconciliationScope) {
  if (state.scope.history !== scope.history) return {};
  if (state.scope === scope) return state.entries;
  // Cancel old reads without forgetting successful tokens for the same owner.
  return Object.fromEntries(
    Object.entries(state.entries).map(([key, entry]) => [
      key,
      entry.status === 'refreshing'
        ? { ...entry, status: 'error' as const }
        : entry,
    ]),
  );
}

export function useDustSweepReconciliation({
  params,
  networks,
  setNetworks,
  onRefreshed,
  onRefreshStarted,
  identityRevision,
}: {
  params: IDustSweepRouteParams;
  networks: IDustSweepNetwork[];
  setNetworks: Dispatch<SetStateAction<IDustSweepNetwork[]>>;
  onRefreshed?: TOnRefreshed;
  onRefreshStarted?: () => boolean;
  identityRevision?: number;
}) {
  const history = useMemo(
    () => ({ params, processed: new Set<string>() }),
    [params],
  );
  const scope = useMemo<IReconciliationScope>(
    () => ({
      history,
      identityRevision,
      requests: new Map<string, AbortController>(),
    }),
    [history, identityRevision],
  );
  const activeScope = useRef(scope);
  activeScope.current = scope;
  const [state, setState] = useState<IReconciliationState>({
    scope,
    entries: {},
  });
  const entries = useMemo(() => getEntries(state, scope), [state, scope]);

  useEffect(
    () => () => {
      scope.requests.forEach((request) => request.abort());
    },
    [scope],
  );

  const refresh = useCallback(
    (entry: IDustSweepNetwork, sweptKeys: string[] = []) => {
      if (activeScope.current !== scope) return;
      const canRefresh = onRefreshStarted?.() !== false;
      const key = getDustSweepNetworkOwner(entry);
      scope.requests.get(key)?.abort();
      const controller = new AbortController();
      if (canRefresh) scope.requests.set(key, controller);
      setState((previous) => {
        const current = getEntries(previous, scope);
        return {
          scope,
          entries: {
            ...current,
            [key]: {
              status: canRefresh ? 'refreshing' : 'error',
              sweptKeys: new Set([
                ...(current[key]?.sweptKeys ?? []),
                ...sweptKeys,
              ]),
            },
          },
        };
      });
      if (!canRefresh) return;
      const isCurrent = () =>
        activeScope.current === scope && !controller.signal.aborted;
      void refreshDustSweepNetwork(
        { entry, indexedAccountId: params.indexedAccountId },
        controller.signal,
      )
        .then((updated) => {
          if (!isCurrent()) return;
          scope.requests.delete(key);
          setNetworks((previous) =>
            previous.map((network) =>
              getDustSweepNetworkOwner(network) === key ? updated : network,
            ),
          );
          onRefreshed?.(key);
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
          scope.requests.delete(key);
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
    [
      onRefreshed,
      onRefreshStarted,
      params.indexedAccountId,
      scope,
      setNetworks,
    ],
  );

  const markFullLoadReady = useCallback(
    (updated: IDustSweepNetwork[]) => {
      if (activeScope.current.history !== history) return;
      const currentScope = activeScope.current;
      const refreshedOwners = new Set(updated.map(getDustSweepNetworkOwner));
      setState((previous) => {
        const current = getEntries(previous, currentScope);
        return {
          scope: currentScope,
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
    [history],
  );

  const reconcile = useCallback(
    (
      batch: IDustSweepState,
      { isStopped = false }: { isStopped?: boolean } = {},
    ) => {
      if (activeScope.current !== scope || !batch.snapshot) return;
      if (
        batch.phase !== 'completed' &&
        !(isStopped && batch.phase === 'paused')
      )
        return;
      if (scope.history.processed.has(batch.snapshot.id)) return;
      scope.history.processed.add(batch.snapshot.id);
      // Failed swaps and approvals can spend gas even without a successful swap.
      if (!batch.items.some((item) => item.txId || item.approvalTxIds?.length))
        return;
      const key = getDustSweepSnapshotOwner(batch.snapshot);
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

  const isRefreshing = useCallback(() => scope.requests.size > 0, [scope]);

  return {
    entries,
    isRefreshing,
    markFullLoadReady,
    reconcile,
    refresh,
  };
}
