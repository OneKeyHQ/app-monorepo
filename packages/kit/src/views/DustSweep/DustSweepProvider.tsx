import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import type { Dispatch, PropsWithChildren, SetStateAction } from 'react';

import BigNumber from 'bignumber.js';

import { useRouteIsFocused } from '@onekeyhq/kit/src/hooks/useRouteIsFocused';
import { useDustSweepPreferencesPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import { appEventBus } from '@onekeyhq/shared/src/eventBus/appEventBus';
import { EAppEventBusNames } from '@onekeyhq/shared/src/eventBus/appEventBusNames';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import type {
  IDustSweepNetwork,
  IDustSweepRouteParams,
  IDustSweepSnapshot,
  IDustSweepThreshold,
  IDustSweepToken,
} from '@onekeyhq/shared/types/swap/dustSweep';
import type { ISwapProviderInfo } from '@onekeyhq/shared/types/swap/SwapProvider.constants';

import {
  getDustSweepNetworkOwner,
  useDustSweepReconciliation,
} from './hooks/useDustSweepReconciliation';
import { useDustSweepSession } from './hooks/useDustSweepSession';
import {
  DUST_SWEEP_MIN_SLIPPAGE,
  DUST_SWEEP_THRESHOLDS,
  filterDustSweepCandidates,
  isDustSweepBelowGasThreshold,
  isValidDustSweepSlippage,
} from './utils/candidates';
import { loadDustSweepNetworks } from './utils/loadNetworks';

import type { IDustSweepState } from './stateMachine';

// Added below-gas tokens are listed but left for the user to tick.
function isDefaultSelected(token: IDustSweepToken) {
  return !token.suspicious && !isDustSweepBelowGasThreshold(token);
}

function useDustSweepController(params: IDustSweepRouteParams) {
  const isFocused = useRouteIsFocused();
  const [preferences, setPreferences] = useDustSweepPreferencesPersistAtom();
  const loadParams = useMemo(
    () => ({
      walletId: params.walletId,
      accountId: params.accountId,
      indexedAccountId: params.indexedAccountId,
      networkId: params.networkId,
      entry: params.entry,
    }),
    [
      params.accountId,
      params.entry,
      params.indexedAccountId,
      params.networkId,
      params.walletId,
    ],
  );
  const [networkState, setNetworkState] = useState<{
    scope: typeof loadParams;
    networks: IDustSweepNetwork[];
  }>();
  const networks = useMemo(
    () => (networkState?.scope === loadParams ? networkState.networks : []),
    [networkState, loadParams],
  );
  const setNetworks: Dispatch<SetStateAction<IDustSweepNetwork[]>> =
    useCallback(
      (update) => {
        setNetworkState((previous) => {
          const current =
            previous?.scope === loadParams ? previous.networks : [];
          return {
            scope: loadParams,
            networks: typeof update === 'function' ? update(current) : update,
          };
        });
      },
      [loadParams],
    );
  const [refresh, setRefresh] = useState({ isManualRefresh: false });
  const [invalidation, setInvalidation] = useState<{
    scope: typeof loadParams;
  }>();
  const consumedInvalidation = useRef(invalidation);
  const pendingInvalidation =
    invalidation?.scope === loadParams &&
    consumedInvalidation.current !== invalidation;
  const focusState = useRef({
    scope: loadParams,
    focused: isFocused,
    visited: isFocused,
  });
  const [loadState, setLoadState] = useState<{
    scope: typeof loadParams;
    refresh: typeof refresh;
    status: 'refreshing' | 'idle' | 'error';
    partialError: boolean;
    freshOwners: Set<string>;
    providerInfo?: ISwapProviderInfo;
  }>();
  const currentLoad =
    loadState?.scope === loadParams && loadState.refresh === refresh
      ? loadState
      : undefined;
  const refreshStatus = currentLoad?.status ?? 'refreshing';
  let loadStatus: 'loading' | 'ready' | 'error' = 'loading';
  if (networks.length || refreshStatus === 'idle') loadStatus = 'ready';
  else if (refreshStatus === 'error') loadStatus = 'error';
  const partialError = refreshStatus === 'error' || !!currentLoad?.partialError;
  const providerInfo = currentLoad?.providerInfo;
  const fullLoadPending = useRef(true);
  const [networkId, setNetworkId] = useState(params.networkId);
  const networkChoiceScope = useRef<typeof loadParams | undefined>(undefined);
  // Add anyway applies to every network until the user leaves Dust Sweep.
  const [includeHidden, setIncludeHidden] = useState(false);
  const [selectionState, setSelection] = useState<{
    scope: IDustSweepRouteParams;
    keys: Set<string>;
  }>();
  const [slippage, setSlippageValue] = useState(DUST_SWEEP_MIN_SLIPPAGE);
  const setSlippage = useCallback((value: number) => {
    if (isValidDustSweepSlippage(value.toString())) setSlippageValue(value);
  }, []);
  const visited = useRef(false);
  const firstVisit = useRef(true);
  const session = useDustSweepSession(networks);
  const {
    reset: resetSession,
    start: startSession,
    stop: stopSession,
  } = session;
  const selecting = session.state.phase === 'selecting';
  const canSelectNetwork = selecting || session.state.phase === 'completed';
  const selection =
    selectionState?.scope === loadParams ? selectionState.keys : undefined;
  const activeLoadParams = useRef(loadParams);
  activeLoadParams.current = loadParams;
  const executionScope = useRef<typeof loadParams | undefined>(undefined);
  const reconciliation = useDustSweepReconciliation({
    params: loadParams,
    networks,
    setNetworks,
  });
  const {
    markFullLoadReady,
    reconcile,
    refresh: refreshAssets,
  } = reconciliation;
  const reconciling = reconciliation.isRefreshing();
  useEffect(() => {
    const invalidate = () => {
      fullLoadPending.current = true;
      setInvalidation({ scope: loadParams });
    };
    appEventBus.on(EAppEventBusNames.SwapTxHistoryStatusUpdate, invalidate);
    return () => {
      appEventBus.off(EAppEventBusNames.SwapTxHistoryStatusUpdate, invalidate);
    };
  }, [loadParams]);
  useEffect(() => {
    const previous = focusState.current;
    if (
      previous.scope === loadParams &&
      previous.visited &&
      !previous.focused &&
      isFocused
    ) {
      fullLoadPending.current = true;
      setInvalidation({ scope: loadParams });
    }
    focusState.current = {
      scope: loadParams,
      focused: isFocused,
      visited: isFocused || (previous.scope === loadParams && previous.visited),
    };
  }, [isFocused, loadParams]);
  useEffect(() => {
    if (
      !pendingInvalidation ||
      !isFocused ||
      !selecting ||
      refreshStatus === 'refreshing' ||
      reconciling
    )
      return;
    consumedInvalidation.current = invalidation;
    networkChoiceScope.current = loadParams;
    fullLoadPending.current = true;
    setRefresh({ isManualRefresh: true });
  }, [
    invalidation,
    isFocused,
    loadParams,
    pendingInvalidation,
    reconciling,
    refreshStatus,
    selecting,
  ]);
  useEffect(() => {
    if (executionScope.current === loadParams) reconcile(session.state);
  }, [loadParams, reconcile, session.state]);
  useEffect(() => {
    const controller = new AbortController();
    fullLoadPending.current = true;
    setLoadState({
      scope: loadParams,
      refresh,
      status: 'refreshing',
      partialError: false,
      freshOwners: new Set(),
    });
    let freshSettled = false;
    const isCurrent = () =>
      !controller.signal.aborted && activeLoadParams.current === loadParams;
    void loadDustSweepNetworks(
      loadParams,
      controller.signal,
      (cached) => {
        if (!isCurrent() || freshSettled) return;
        // A retry retains the displayed snapshot and user choices. Its cache
        // must not roll back a live or post-transaction asset reconciliation.
        setNetworks((previous) => (previous.length ? previous : cached));
      },
      refresh,
    )
      .then((result) => {
        freshSettled = true;
        if (!isCurrent()) return;
        setNetworks((previous) => [
          ...result.networks,
          ...previous.filter((entry) =>
            result.failedNetworkIds?.includes(entry.network.networkId),
          ),
        ]);
        markFullLoadReady(result.networks);
        setLoadState({
          scope: loadParams,
          refresh,
          status: 'idle',
          partialError: result.partialError,
          freshOwners: new Set(result.networks.map(getDustSweepNetworkOwner)),
          providerInfo: result.providerInfo,
        });
      })
      .catch(() => {
        freshSettled = true;
        if (isCurrent())
          setLoadState({
            scope: loadParams,
            refresh,
            status: 'error',
            partialError: true,
            freshOwners: new Set(),
          });
      })
      .finally(() => {
        if (isCurrent()) fullLoadPending.current = false;
      });
    return () => controller.abort();
  }, [loadParams, markFullLoadReady, refresh, setNetworks]);
  // Network pickers hide chains with a $0.00 balance or nothing to sweep under
  // the largest threshold preset. The list deliberately stays the same when the
  // threshold changes (product decision); a network with nothing under the
  // selected threshold shows the empty state. An explicitly requested network
  // still resolves below and shows its empty state.
  const selectableNetworks = useMemo(() => {
    const maxThreshold = Math.max(...DUST_SWEEP_THRESHOLDS);
    return networks.filter(
      (entry) =>
        entry.tokens.some((token) =>
          new BigNumber(token.valueUsd).lt(maxThreshold),
        ) && new BigNumber(entry.balanceUsd).decimalPlaces(2).gt(0),
    );
  }, [networks]);
  // Pickers list chains by the displayed network balance.
  const visibleNetworks = useMemo(
    () =>
      selectableNetworks.toSorted(
        (a, b) => new BigNumber(b.balanceUsd).comparedTo(a.balanceUsd) ?? 0,
      ),
    [selectableNetworks],
  );
  const defaultNetwork = visibleNetworks[0];
  const chosenNetwork = networks.find(
    (entry) => entry.network.networkId === networkId,
  );
  // A provisional cache default follows the displayed order after refresh.
  // Explicit user/route choices and execution keep their selected network.
  const keepChosenNetwork =
    chosenNetwork &&
    (!selecting ||
      !!params.networkId ||
      networkChoiceScope.current === loadParams);
  let current = selecting ? defaultNetwork : undefined;
  if (keepChosenNetwork) current = chosenNetwork;
  // An explicitly requested network stays visible (first) in the picker while
  // it is selected, even when the rules above would hide it.
  const pickerNetworks = useMemo(
    () =>
      current && !visibleNetworks.includes(current)
        ? [current, ...visibleNetworks]
        : visibleNetworks,
    [current, visibleNetworks],
  );
  const currentNetworkId = current?.network.networkId;
  const currentReconciliation = current
    ? reconciliation.entries[getDustSweepNetworkOwner(current)]
    : undefined;
  const hasFreshAssets =
    !!current &&
    !!currentLoad?.freshOwners.has(getDustSweepNetworkOwner(current));
  let assetStatus: 'refreshing' | 'ready' | 'error' =
    currentReconciliation?.status ?? 'ready';
  if (!hasFreshAssets && (current || refreshStatus !== 'idle')) {
    assetStatus = refreshStatus === 'refreshing' ? 'refreshing' : 'error';
  }
  const assetsReady =
    hasFreshAssets &&
    assetStatus === 'ready' &&
    refreshStatus === 'idle' &&
    !pendingInvalidation;
  const sweptKeys = currentReconciliation?.sweptKeys;
  useEffect(() => {
    if (!selecting || !currentNetworkId || currentNetworkId === networkId)
      return;
    setNetworkId(currentNetworkId);
    setSelection(undefined);
  }, [currentNetworkId, networkId, selecting]);
  const { visible, hidden } = useMemo(
    () =>
      filterDustSweepCandidates(
        current?.tokens ?? [],
        preferences.threshold,
        includeHidden,
      ),
    [current, preferences.threshold, includeHidden],
  );
  const selected = useMemo(
    () =>
      visible.filter((token) =>
        selection
          ? selection.has(token.key)
          : isDefaultSelected(token) && !sweptKeys?.has(token.key),
      ),
    [visible, selection, sweptKeys],
  );
  const snapshot = useMemo<IDustSweepSnapshot | undefined>(
    () =>
      current && selecting && assetsReady
        ? {
            id: `${current.accountId}:${current.address}:${current.network.networkId}:${slippage}:${current.denySingleSwapProvider ?? ''}:${selected.map((token) => `${token.key}=${token.amount}`).join('|')}`,
            accountId: current.accountId,
            address: current.address,
            networkId: current.network.networkId,
            deriveAddressEncoding: current.deriveAddressEncoding,
            nativeToken: current.nativeToken,
            slippage,
            tokens: selected,
            denySingleSwapProvider: current.denySingleSwapProvider,
          }
        : undefined,
    [current, selecting, assetsReady, slippage, selected],
  );
  // Nothing is quoted while selecting: every selected token is submitted and
  // quoted on its own turn, and one without a quote is skipped then.
  const canStart = selecting && isFocused && assetsReady && selected.length > 0;
  const selectedValueUsd = selected
    .reduce((sum, token) => sum.plus(token.valueUsd), new BigNumber(0))
    .toFixed();
  useEffect(() => {
    if (refreshStatus !== 'idle' || visited.current) return;
    visited.current = true;
    defaultLogger.dex.dustSweep.dustSweepPageVisited({
      page: 'select',
      entry: firstVisit.current ? params.entry : undefined,
      tokenCount: visible.length,
      hiddenTokenCount: hidden.length,
    });
    firstVisit.current = false;
  }, [refreshStatus, params.entry, visible.length, hidden.length]);
  const selectNetwork = useCallback(
    (id: string) => {
      if (!canSelectNetwork) return;
      if (!selecting) resetSession();
      networkChoiceScope.current = loadParams;
      setNetworkId(id);
      setSelection(undefined);
    },
    [canSelectNetwork, resetSession, selecting, loadParams],
  );
  const selectThreshold = useCallback(
    (threshold: IDustSweepThreshold) => {
      if (!selecting) return;
      networkChoiceScope.current = loadParams;
      setPreferences((value) => ({ ...value, threshold }));
      setSelection(undefined);
    },
    [selecting, setPreferences, loadParams],
  );
  const toggle = useCallback(
    (key: string) => {
      if (!selecting) return;
      networkChoiceScope.current = loadParams;
      setSelection((value) => {
        const currentSelection =
          value?.scope === loadParams ? value.keys : undefined;
        const next = new Set(
          currentSelection ?? selected.map((token) => token.key),
        );
        if (next.has(key)) next.delete(key);
        else next.add(key);
        return { scope: loadParams, keys: next };
      });
    },
    [selecting, selected, loadParams],
  );
  const toggleAll = useCallback(() => {
    if (!selecting) return;
    networkChoiceScope.current = loadParams;
    const selectableKeys = visible
      .filter((token) => !token.suspicious)
      .map((token) => token.key);
    const selectedKeys = new Set(selected.map((token) => token.key));
    const selectedSelectableCount = selectableKeys.filter((key) =>
      selectedKeys.has(key),
    ).length;
    if (selectedSelectableCount === selectableKeys.length) {
      selectableKeys.forEach((key) => selectedKeys.delete(key));
    } else {
      selectableKeys.forEach((key) => selectedKeys.add(key));
    }
    setSelection({ scope: loadParams, keys: selectedKeys });
  }, [selecting, selected, visible, loadParams]);
  const addHidden = useCallback(() => {
    if (!selecting || includeHidden) return;
    networkChoiceScope.current = loadParams;
    setIncludeHidden(true);
    defaultLogger.dex.dustSweep.dustSweepAddHidden({
      hiddenCount: hidden.length,
    });
  }, [selecting, includeHidden, hidden.length, loadParams]);
  // Keep unconverted choices even if the balance index still lists spent tokens.
  const retainUnconvertedSelection = useCallback(
    (batch: IDustSweepState) => {
      if (executionScope.current !== loadParams) {
        setSelection(undefined);
        return;
      }
      setSelection({
        scope: loadParams,
        keys: new Set(
          batch.items
            .filter((item) => item.status !== 'success')
            .map((item) => item.token.key),
        ),
      });
      visited.current = false;
    },
    [loadParams],
  );
  const sweepAgain = useCallback(() => {
    if (session.state.phase !== 'completed') return;
    retainUnconvertedSelection(session.state);
    resetSession();
  }, [resetSession, retainUnconvertedSelection, session.state]);
  const stop = useCallback(async () => {
    await stopSession((batch) => {
      if (
        activeLoadParams.current !== loadParams ||
        executionScope.current !== loadParams
      )
        return;
      reconcile(batch, { isStopped: true });
      retainUnconvertedSelection(batch);
    });
  }, [loadParams, reconcile, retainUnconvertedSelection, stopSession]);
  const start = useCallback(() => {
    if (!snapshot || !canStart || fullLoadPending.current) return undefined;
    executionScope.current = loadParams;
    networkChoiceScope.current = loadParams;
    setSelection({
      scope: loadParams,
      keys: new Set(snapshot.tokens.map((token) => token.key)),
    });
    return startSession(snapshot);
  }, [snapshot, canStart, loadParams, startSession]);
  const retry = useCallback(() => {
    if (selecting && !reconciliation.isRefreshing()) {
      // Claim before React renders so a same-event local retry cannot race it.
      fullLoadPending.current = true;
      consumedInvalidation.current = invalidation;
      setRefresh({ isManualRefresh: true });
    }
  }, [invalidation, selecting, reconciliation]);
  const retryAssets = useCallback(() => {
    if (!selecting || assetStatus !== 'error' || fullLoadPending.current)
      return;
    if (hasFreshAssets && current) refreshAssets(current);
    else retry();
  }, [selecting, current, assetStatus, hasFreshAssets, refreshAssets, retry]);
  return {
    params,
    networks: pickerNetworks,
    current,
    visible,
    hidden,
    selected,
    includeHidden,
    selectedValueUsd,
    canStart,
    isFocused,
    loadStatus,
    refreshStatus,
    assetStatus,
    retryAssets,
    partialError,
    providerInfo,
    threshold: preferences.threshold,
    slippage,
    setSlippage,
    session,
    selecting,
    canSelectNetwork,
    toggle,
    toggleAll,
    addHidden,
    selectNetwork,
    selectThreshold,
    start,
    sweepAgain,
    stop,
    stopping: session.stopping,
    retry,
  };
}

const DustSweepContext = createContext<
  ReturnType<typeof useDustSweepController> | undefined
>(undefined);

export function DustSweepScreenProvider({
  value,
  children,
}: PropsWithChildren<{
  value: ReturnType<typeof useDustSweepController>;
}>) {
  return (
    <DustSweepContext.Provider value={value}>
      {children}
    </DustSweepContext.Provider>
  );
}

export function DustSweepProvider({
  params,
  children,
}: PropsWithChildren<{ params: IDustSweepRouteParams }>) {
  const value = useDustSweepController(params);
  return (
    <DustSweepContext.Provider value={value}>
      {children}
    </DustSweepContext.Provider>
  );
}

export function useDustSweep() {
  const context = useContext(DustSweepContext);
  if (!context) throw new OneKeyLocalError('DustSweepProvider is required');
  return context;
}
