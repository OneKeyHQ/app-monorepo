import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react';
import type { Dispatch, SetStateAction } from 'react';

import { appEventBus } from '@onekeyhq/shared/src/eventBus/appEventBus';
import { EAppEventBusNames } from '@onekeyhq/shared/src/eventBus/appEventBusNames';
import type {
  IDustSweepNetwork,
  IDustSweepRouteParams,
} from '@onekeyhq/shared/types/swap/dustSweep';

import { loadDustSweepNetworks } from '../utils/loadNetworks';
import {
  beginDustSweepNetworksCacheWrite,
  getDustSweepIdentityRevision,
  getDustSweepNetworksCache,
  getDustSweepNetworksCacheRevision,
  invalidateDustSweepNetworksCache,
  setDustSweepNetworksCache,
  subscribeDustSweepIdentity,
} from '../utils/networkCache';

import type { IDustSweepNetworksResult } from '../utils/loadNetworks';
import type { IDustSweepCacheWrite } from '../utils/networkCache';

const EMPTY_NETWORKS: IDustSweepNetwork[] = [];
export const DUST_SWEEP_REFRESH_INTERVAL = 15_000;

type ILoadState = {
  data?: IDustSweepNetworksResult;
  status: 'refreshing' | 'idle' | 'error';
  freshNetworks?: IDustSweepNetwork[];
};

type ILoadScope = {
  params: IDustSweepRouteParams;
  state: ILoadState;
  request?: AbortController;
  suspended: boolean;
  disposed: boolean;
  identityRevision: number;
  write?: IDustSweepCacheWrite;
};

export function useDustSweepNetworks(params: IDustSweepRouteParams) {
  const identityRevision = useSyncExternalStore(
    subscribeDustSweepIdentity,
    getDustSweepIdentityRevision,
    getDustSweepIdentityRevision,
  );
  const scope = useMemo<ILoadScope>(
    () => ({
      params,
      state: {
        data: getDustSweepNetworksCache(params),
        status: 'refreshing',
      },
      suspended: false,
      disposed: false,
      identityRevision: getDustSweepIdentityRevision(),
    }),
    [params],
  );
  const activeScope = useRef(scope);
  activeScope.current = scope;
  const [view, setView] = useState({ scope, state: scope.state });
  const visibleState = view.scope === scope ? view.state : scope.state;
  const identityChanged = scope.identityRevision !== identityRevision;
  const state: ILoadState =
    identityChanged && !scope.suspended
      ? { status: 'refreshing' }
      : visibleState;
  const publish = useCallback(
    (next: ILoadState) => {
      if (activeScope.current !== scope || scope.disposed) return;
      scope.state = next;
      setView({ scope, state: next });
    },
    [scope],
  );

  const refresh = useCallback(
    (isManualRefresh = true) => {
      if (activeScope.current !== scope || scope.suspended || scope.disposed)
        return;
      scope.request?.abort();
      const controller = new AbortController();
      scope.request = controller;
      const write = beginDustSweepNetworksCacheWrite(params);
      scope.write = write;
      const revision = write.revision;
      const isCurrent = () =>
        activeScope.current === scope &&
        scope.request === controller &&
        !controller.signal.aborted &&
        getDustSweepNetworksCacheRevision(params.walletId) === revision;
      publish({ ...scope.state, status: 'refreshing' });
      let freshSettled = false;
      void loadDustSweepNetworks(
        params,
        controller.signal,
        (cached) => {
          if (
            !isCurrent() ||
            freshSettled ||
            scope.state.data ||
            !cached.length
          )
            return;
          publish({
            ...scope.state,
            data: { networks: cached, partialError: false },
          });
        },
        { isManualRefresh, skipCache: !!scope.state.data },
      )
        .then((result) => {
          freshSettled = true;
          if (!isCurrent()) return;
          const data = {
            ...result,
            networks: [
              ...result.networks,
              ...(scope.state.data?.networks ?? []).filter((entry) =>
                result.failedNetworkOwners?.some(
                  (owner) =>
                    owner.networkId === entry.network.networkId &&
                    owner.accountId === entry.accountId &&
                    owner.address === entry.address,
                ),
              ),
            ],
          };
          setDustSweepNetworksCache(params, data, write);
          scope.request = undefined;
          publish({ data, status: 'idle', freshNetworks: result.networks });
        })
        .catch(() => {
          freshSettled = true;
          if (isCurrent()) {
            scope.request = undefined;
            publish({ ...scope.state, status: 'error' });
          }
        })
        .finally(() => {
          if (scope.request === controller) {
            scope.request = undefined;
            if (
              activeScope.current === scope &&
              !controller.signal.aborted &&
              getDustSweepNetworksCacheRevision(params.walletId) !== revision
            )
              publish({
                ...scope.state,
                status: scope.state.data ? 'idle' : 'error',
              });
          }
        });
    },
    [params, publish, scope],
  );

  const setNetworks: Dispatch<SetStateAction<IDustSweepNetwork[]>> =
    useCallback(
      (update) => {
        if (
          activeScope.current !== scope ||
          scope.disposed ||
          scope.identityRevision !== getDustSweepIdentityRevision() ||
          scope.write?.revision !==
            getDustSweepNetworksCacheRevision(params.walletId)
        )
          return;
        const previous = scope.state.data;
        const networks =
          typeof update === 'function'
            ? update(previous?.networks ?? EMPTY_NETWORKS)
            : update;
        const data = {
          ...previous,
          networks,
          partialError: previous?.partialError ?? false,
        };
        setDustSweepNetworksCache(params, data, scope.write);
        publish({ ...scope.state, data });
      },
      [params, publish, scope],
    );

  const suspend = useCallback(() => {
    if (
      activeScope.current !== scope ||
      scope.disposed ||
      scope.suspended ||
      identityRevision !== getDustSweepIdentityRevision() ||
      scope.identityRevision !== identityRevision
    )
      return false;
    // Retire pre-trade reads before execution starts, including shared cache writes.
    invalidateDustSweepNetworksCache(params.walletId);
    scope.suspended = true;
    scope.write = beginDustSweepNetworksCacheWrite(params);
    scope.request?.abort();
    scope.request = undefined;
    publish({ ...scope.state, status: 'idle' });
    return true;
  }, [identityRevision, params, publish, scope]);

  const resetIdentity = useCallback(() => {
    scope.request?.abort();
    scope.request = undefined;
    scope.identityRevision = getDustSweepIdentityRevision();
    publish({ status: 'refreshing' });
    refresh(true);
  }, [publish, refresh, scope]);

  const resume = useCallback(() => {
    if (activeScope.current !== scope || scope.disposed) return;
    scope.suspended = false;
    if (scope.identityRevision !== getDustSweepIdentityRevision())
      resetIdentity();
  }, [resetIdentity, scope]);

  const claimCacheWrite = useCallback(() => {
    if (
      activeScope.current !== scope ||
      scope.disposed ||
      scope.identityRevision !== getDustSweepIdentityRevision() ||
      scope.write?.revision !==
        getDustSweepNetworksCacheRevision(params.walletId)
    )
      return false;
    scope.write = beginDustSweepNetworksCacheWrite(params);
    return true;
  }, [params, scope]);

  useEffect(() => {
    scope.disposed = false;
    refresh(!!scope.state.data);
    return () => {
      scope.disposed = true;
      scope.request?.abort();
      scope.request = undefined;
    };
  }, [refresh, scope]);

  useEffect(() => {
    if (identityChanged && !scope.suspended) resetIdentity();
  }, [identityChanged, identityRevision, resetIdentity, scope]);

  const hasData = !!state.data;
  let loadStatus: 'ready' | 'loading' | 'error' = 'loading';
  if (hasData) loadStatus = 'ready';
  else if (state.status === 'error') loadStatus = 'error';
  const isRefreshing = useCallback(() => !!scope.request, [scope]);
  return {
    networks: state.data?.networks ?? EMPTY_NETWORKS,
    providerInfo: state.data?.providerInfo,
    failedNetworks: state.data?.failedNetworks,
    partialError: state.status === 'error' || !!state.data?.partialError,
    freshNetworks: state.freshNetworks,
    hasData,
    loadStatus,
    refreshStatus: state.status,
    isRefreshing,
    refresh,
    setNetworks,
    suspend,
    resume,
    claimCacheWrite,
    identityRevision,
  };
}

export function useDustSweepNetworkRefresh({
  params,
  isFocused,
  enabled,
  hasData,
  refreshStatus,
  refresh,
  isRefreshing,
}: {
  params: IDustSweepRouteParams;
  isFocused: boolean;
  enabled: boolean;
  hasData: boolean;
  refreshStatus: ILoadState['status'];
  refresh: () => void;
  isRefreshing: () => boolean;
}) {
  const [invalidation, setInvalidation] = useState<{ scope: typeof params }>();
  const consumed = useRef(invalidation);
  const focus = useRef({ params, focused: isFocused, visited: isFocused });
  const pending =
    invalidation?.scope === params && invalidation !== consumed.current;
  const [autoRefreshTimerActive, setAutoRefreshTimerActive] = useState(false);

  useEffect(() => {
    const invalidate = () => setInvalidation({ scope: params });
    appEventBus.on(EAppEventBusNames.SwapTxHistoryStatusUpdate, invalidate);
    return () => {
      appEventBus.off(EAppEventBusNames.SwapTxHistoryStatusUpdate, invalidate);
    };
  }, [params]);

  useEffect(() => {
    const previous = focus.current;
    if (
      previous.params === params &&
      previous.visited &&
      !previous.focused &&
      isFocused
    )
      setInvalidation({ scope: params });
    focus.current = {
      params,
      focused: isFocused,
      visited: isFocused || (previous.params === params && previous.visited),
    };
  }, [isFocused, params]);

  useEffect(() => {
    if (
      !pending ||
      !isFocused ||
      !enabled ||
      refreshStatus === 'refreshing' ||
      isRefreshing()
    )
      return;
    consumed.current = invalidation;
    refresh();
  }, [
    enabled,
    invalidation,
    isFocused,
    pending,
    refresh,
    refreshStatus,
    isRefreshing,
  ]);

  useEffect(() => {
    if (
      !enabled ||
      !isFocused ||
      !hasData ||
      pending ||
      refreshStatus === 'refreshing'
    ) {
      setAutoRefreshTimerActive(false);
      return;
    }
    setAutoRefreshTimerActive(true);
    const timer = setTimeout(() => {
      setAutoRefreshTimerActive(false);
      if (!isRefreshing()) refresh();
    }, DUST_SWEEP_REFRESH_INTERVAL);
    return () => clearTimeout(timer);
  }, [
    enabled,
    hasData,
    isFocused,
    params,
    pending,
    refresh,
    refreshStatus,
    isRefreshing,
  ]);

  return (
    autoRefreshTimerActive &&
    enabled &&
    isFocused &&
    refreshStatus !== 'refreshing' &&
    !pending
  );
}
