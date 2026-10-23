import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import type { PropsWithChildren } from 'react';

import BigNumber from 'bignumber.js';

import { useRouteIsFocused } from '@onekeyhq/kit/src/hooks/useRouteIsFocused';
import { useDustSweepPreferencesPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import type {
  IDustSweepRouteParams,
  IDustSweepSnapshot,
  IDustSweepThreshold,
  IDustSweepToken,
} from '@onekeyhq/shared/types/swap/dustSweep';

import {
  useDustSweepNetworkRefresh,
  useDustSweepNetworks,
} from './hooks/useDustSweepNetworks';
import {
  getDustSweepNetworkOwner,
  getDustSweepSnapshotOwner,
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

import type { IDustSweepState } from './stateMachine';

// Added below-gas tokens are listed but left for the user to tick.
function isDefaultSelected(token: IDustSweepToken) {
  return !token.suspicious && !isDustSweepBelowGasThreshold(token);
}

function useDustSweepController(params: IDustSweepRouteParams) {
  const isFocused = useRouteIsFocused();
  const [preferences, setPreferences] = useDustSweepPreferencesPersistAtom();
  const [localThreshold, setLocalThreshold] = useState<IDustSweepThreshold>();
  // Native persistence echoes asynchronously; keep this page's choice immediate.
  const threshold = localThreshold ?? preferences.threshold;
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
  const data = useDustSweepNetworks(loadParams);
  const {
    networks,
    setNetworks,
    loadStatus,
    refreshStatus,
    partialError,
    providerInfo,
    freshNetworks,
    suspend,
    resume,
    refresh: refreshNetworks,
    isRefreshing: isRefreshingNetworks,
  } = data;
  const [networkId, setNetworkId] = useState(params.networkId);
  const networkChoiceScope = useRef<typeof loadParams | undefined>(undefined);
  // Add anyway applies to every network until the user leaves Dust Sweep.
  const [includeHidden, setIncludeHidden] = useState(false);
  const addedHidden = useRef(false);
  const [selectionState, setSelection] = useState<{
    scope: IDustSweepRouteParams;
    owner?: string;
    defaultThreshold?: IDustSweepThreshold;
    keys: Set<string>;
  }>();
  const [slippage, setSlippageValue] = useState(DUST_SWEEP_MIN_SLIPPAGE);
  const setSlippage = useCallback((value: number) => {
    if (isValidDustSweepSlippage(value.toString())) setSlippageValue(value);
  }, []);
  const visited = useRef<typeof loadParams | undefined>(undefined);
  const firstVisit = useRef(true);
  const session = useDustSweepSession(networks);
  const {
    reset: resetSession,
    start: startSession,
    stop: stopSession,
  } = session;
  const selecting = session.state.phase === 'selecting';
  const canSelectNetwork = selecting || session.state.phase === 'completed';
  const activeLoadParams = useRef(loadParams);
  activeLoadParams.current = loadParams;
  const executionScope = useRef<typeof loadParams | undefined>(undefined);
  const reconciliation = useDustSweepReconciliation({
    params: loadParams,
    networks,
    setNetworks,
    onRefreshStarted: data.claimCacheWrite,
    identityRevision: data.identityRevision,
  });
  const {
    markFullLoadReady,
    reconcile,
    refresh: refreshAssets,
    isRefreshing: isReconciling,
  } = reconciliation;
  const reconciling = isReconciling();
  useEffect(() => {
    if (selecting) resume();
  }, [resume, selecting]);
  const retry = useCallback(() => {
    if (!selecting || isReconciling()) return;
    networkChoiceScope.current = loadParams;
    refreshNetworks();
  }, [refreshNetworks, loadParams, isReconciling, selecting]);
  const autoRefreshTimerActive = useDustSweepNetworkRefresh({
    params: loadParams,
    isFocused,
    enabled: selecting && !reconciling,
    hasData: data.hasData,
    refreshStatus,
    refresh: retry,
    isRefreshing: isRefreshingNetworks,
  });
  useEffect(() => {
    if (freshNetworks) markFullLoadReady(freshNetworks);
  }, [freshNetworks, markFullLoadReady]);
  useEffect(() => {
    if (executionScope.current === loadParams) reconcile(session.state);
  }, [loadParams, reconcile, session.state]);
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
  const currentOwner = current ? getDustSweepNetworkOwner(current) : undefined;
  const selection =
    selectionState?.scope === loadParams &&
    selectionState.owner === currentOwner &&
    (selectionState.defaultThreshold === undefined ||
      selectionState.defaultThreshold === threshold)
      ? selectionState.keys
      : undefined;
  const currentReconciliation = current
    ? reconciliation.entries[getDustSweepNetworkOwner(current)]
    : undefined;
  const assetStatus = currentReconciliation?.status ?? 'ready';
  // Background discovery can use stale data. A post-transaction owner refresh
  // retains its own barrier and successful-token exclusions.
  const assetsReady = !!current && assetStatus === 'ready';
  const sweptKeys = currentReconciliation?.sweptKeys;
  useEffect(() => {
    if (!selecting || !currentNetworkId || currentNetworkId === networkId)
      return;
    setNetworkId(currentNetworkId);
  }, [currentNetworkId, networkId, selecting]);
  const { visible, hidden } = useMemo(
    () =>
      filterDustSweepCandidates(
        current?.tokens ?? [],
        threshold,
        includeHidden,
      ),
    [current, threshold, includeHidden],
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
  useEffect(() => {
    // Freeze each displayed selection before background reads can add tokens.
    if (selecting && current && !selection)
      setSelection({
        scope: loadParams,
        owner: currentOwner,
        defaultThreshold: threshold,
        keys: new Set(selected.map((token) => token.key)),
      });
  }, [
    current,
    currentOwner,
    loadParams,
    selected,
    selecting,
    selection,
    threshold,
  ]);
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
    if (!selecting || !isFocused) {
      visited.current = undefined;
      return;
    }
    if (refreshStatus !== 'idle' || visited.current === loadParams) return;
    visited.current = loadParams;
    defaultLogger.dex.dustSweep.dustSweepPageVisited({
      page: 'select',
      entry: firstVisit.current ? params.entry : undefined,
      tokenCount: visible.length,
      hiddenTokenCount: hidden.length,
    });
    firstVisit.current = false;
  }, [
    selecting,
    isFocused,
    loadParams,
    refreshStatus,
    params.entry,
    visible.length,
    hidden.length,
  ]);
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
    (value: IDustSweepThreshold) => {
      if (!selecting) return;
      networkChoiceScope.current = loadParams;
      setLocalThreshold(value);
      setSelection(undefined);
      void setPreferences((previous) => ({ ...previous, threshold: value }));
    },
    [selecting, setPreferences, loadParams],
  );
  const toggle = useCallback(
    (key: string) => {
      if (!selecting) return;
      networkChoiceScope.current = loadParams;
      setSelection((value) => {
        const currentSelection =
          value?.scope === loadParams && value.owner === currentOwner
            ? value.keys
            : undefined;
        const next = new Set(
          currentSelection ?? selected.map((token) => token.key),
        );
        if (next.has(key)) next.delete(key);
        else next.add(key);
        return { scope: loadParams, owner: currentOwner, keys: next };
      });
    },
    [selecting, selected, loadParams, currentOwner],
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
    setSelection({
      scope: loadParams,
      owner: currentOwner,
      keys: selectedKeys,
    });
  }, [selecting, selected, visible, loadParams, currentOwner]);
  const addHidden = useCallback(() => {
    if (!selecting || includeHidden || addedHidden.current || !hidden.length)
      return;
    addedHidden.current = true;
    networkChoiceScope.current = loadParams;
    setIncludeHidden(true);
    defaultLogger.dex.dustSweep.dustSweepAddHidden({
      hiddenCount: hidden.length,
      hiddenTotalUsd: hidden
        .reduce((sum, token) => sum.plus(token.valueUsd), new BigNumber(0))
        .toNumber(),
    });
  }, [selecting, includeHidden, hidden, loadParams]);
  // Keep unconverted choices even if the balance index still lists spent tokens.
  const retainUnconvertedSelection = useCallback(
    (batch: IDustSweepState) => {
      if (executionScope.current !== loadParams) {
        setSelection(undefined);
        return;
      }
      setSelection({
        scope: loadParams,
        owner: batch.snapshot
          ? getDustSweepSnapshotOwner(batch.snapshot)
          : undefined,
        keys: new Set(
          batch.items
            .filter((item) => item.status !== 'success')
            .map((item) => item.token.key),
        ),
      });
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
    if (
      !snapshot ||
      !canStart ||
      activeLoadParams.current !== loadParams ||
      !suspend()
    )
      return undefined;
    executionScope.current = loadParams;
    networkChoiceScope.current = loadParams;
    setSelection({
      scope: loadParams,
      owner: getDustSweepSnapshotOwner(snapshot),
      keys: new Set(snapshot.tokens.map((token) => token.key)),
    });
    return startSession(snapshot, { hiddenTokenCount: hidden.length });
  }, [snapshot, canStart, loadParams, startSession, hidden.length, suspend]);
  const retryAssets = useCallback(() => {
    if (!selecting || isRefreshingNetworks()) return;
    if (currentReconciliation?.status === 'error' && current)
      refreshAssets(current);
    else retry();
  }, [
    selecting,
    current,
    currentReconciliation?.status,
    refreshAssets,
    retry,
    isRefreshingNetworks,
  ]);
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
    failedNetworks: data.failedNetworks,
    isRefreshing: refreshStatus === 'refreshing' || reconciling,
    autoRefreshTimerActive,
    providerInfo,
    threshold,
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
