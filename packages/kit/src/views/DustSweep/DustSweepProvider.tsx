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
  IDustSweepNetwork,
  IDustSweepRouteParams,
  IDustSweepSnapshot,
  IDustSweepThreshold,
  IDustSweepToken,
} from '@onekeyhq/shared/types/swap/dustSweep';
import type { ISwapProviderInfo } from '@onekeyhq/shared/types/swap/SwapProvider.constants';

import { useDustSweepSession } from './hooks/useDustSweepSession';
import {
  DUST_SWEEP_THRESHOLDS,
  filterDustSweepCandidates,
  isDustSweepBelowGasThreshold,
} from './utils/candidates';
import { loadDustSweepNetworks } from './utils/loadNetworks';

// Added below-gas tokens are listed but left for the user to tick.
function isDefaultSelected(token: IDustSweepToken) {
  return !token.suspicious && !isDustSweepBelowGasThreshold(token);
}

function useDustSweepController(params: IDustSweepRouteParams) {
  const isFocused = useRouteIsFocused();
  const [preferences, setPreferences] = useDustSweepPreferencesPersistAtom();
  const [networks, setNetworks] = useState<IDustSweepNetwork[]>([]);
  const [loadStatus, setLoadStatus] = useState<'loading' | 'ready' | 'error'>(
    'loading',
  );
  const [partialError, setPartialError] = useState(false);
  const [refresh, setRefresh] = useState(0);
  const [networkId, setNetworkId] = useState(params.networkId);
  // Add anyway applies to every network until the user leaves Dust Sweep.
  const [includeHidden, setIncludeHidden] = useState(false);
  const [selection, setSelection] = useState<Set<string>>();
  const [slippage, setSlippage] = useState(5);
  const visited = useRef(false);
  const firstVisit = useRef(true);
  const session = useDustSweepSession(networks);
  const {
    reset: resetSession,
    start: startSession,
    stop: stopSession,
  } = session;
  const selecting = session.state.phase === 'selecting';
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
  const [providerMetadata, setProviderMetadata] = useState<{
    loadParams: typeof loadParams;
    refresh: number;
    info?: ISwapProviderInfo;
  }>();
  // Invalidate during render so a new account cannot briefly display the
  // previous load's provider before the effect starts its replacement request.
  const providerInfo =
    providerMetadata?.loadParams === loadParams &&
    providerMetadata.refresh === refresh &&
    loadStatus === 'ready'
      ? providerMetadata.info
      : undefined;
  useEffect(() => {
    const controller = new AbortController();
    setLoadStatus('loading');
    setProviderMetadata(undefined);
    void loadDustSweepNetworks(loadParams, controller.signal)
      .then((result) => {
        if (controller.signal.aborted) return;
        setNetworks(result.networks);
        setProviderMetadata({ loadParams, refresh, info: result.providerInfo });
        setPartialError(result.partialError);
        setLoadStatus('ready');
      })
      .catch(() => {
        if (!controller.signal.aborted) setLoadStatus('error');
      });
    return () => controller.abort();
  }, [loadParams, refresh]);
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
  // The default selection is the chain with the most dust under the current
  // threshold; ties keep the loaded order.
  const defaultNetwork = useMemo(() => {
    let best: IDustSweepNetwork | undefined;
    let bestDustUsd = new BigNumber(-1);
    // Only picker-eligible networks can be chosen automatically; when none
    // qualify, nothing is selected and the empty state shows.
    for (const entry of selectableNetworks) {
      const dustUsd = entry.tokens
        .filter((token) =>
          new BigNumber(token.valueUsd).lt(preferences.threshold),
        )
        .reduce((sum, token) => sum.plus(token.valueUsd), new BigNumber(0));
      if (dustUsd.gt(bestDustUsd)) {
        best = entry;
        bestDustUsd = dustUsd;
      }
    }
    return best;
  }, [selectableNetworks, preferences.threshold]);
  const current =
    networks.find((entry) => entry.network.networkId === networkId) ??
    (selecting ? defaultNetwork : undefined);
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
        selection ? selection.has(token.key) : isDefaultSelected(token),
      ),
    [visible, selection],
  );
  const snapshot = useMemo<IDustSweepSnapshot | undefined>(
    () =>
      current && selecting
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
    [current, selecting, slippage, selected],
  );
  // Nothing is quoted while selecting: every selected token is submitted and
  // quoted on its own turn, and one without a quote is skipped then.
  const canStart =
    selecting && isFocused && loadStatus === 'ready' && selected.length > 0;
  const selectedValueUsd = selected
    .reduce((sum, token) => sum.plus(token.valueUsd), new BigNumber(0))
    .toFixed();
  useEffect(() => {
    if (loadStatus !== 'ready' || visited.current) return;
    visited.current = true;
    defaultLogger.dex.dustSweep.dustSweepPageVisited({
      page: 'select',
      entry: firstVisit.current ? params.entry : undefined,
      tokenCount: visible.length,
      hiddenTokenCount: hidden.length,
    });
    firstVisit.current = false;
  }, [loadStatus, params.entry, visible.length, hidden.length]);
  const selectNetwork = useCallback(
    (id: string) => {
      if (!selecting) return;
      setNetworkId(id);
      setSelection(undefined);
    },
    [selecting],
  );
  const selectThreshold = useCallback(
    (threshold: IDustSweepThreshold) => {
      if (!selecting) return;
      setPreferences((value) => ({ ...value, threshold }));
      setSelection(undefined);
    },
    [selecting, setPreferences],
  );
  const toggle = useCallback(
    (key: string) => {
      if (!selecting) return;
      setSelection((value) => {
        const next = new Set(
          value ?? visible.filter(isDefaultSelected).map((token) => token.key),
        );
        if (next.has(key)) next.delete(key);
        else next.add(key);
        return next;
      });
    },
    [selecting, visible],
  );
  const toggleAll = useCallback(() => {
    if (!selecting) return;
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
    setSelection(selectedKeys);
  }, [selecting, selected, visible]);
  const addHidden = useCallback(() => {
    if (!selecting || includeHidden) return;
    setIncludeHidden(true);
    defaultLogger.dex.dustSweep.dustSweepAddHidden({
      hiddenCount: hidden.length,
    });
  }, [selecting, includeHidden, hidden.length]);
  // Back to selection with fresh balances, keeping the submitted selection.
  const reloadNetworks = useCallback(() => {
    setRefresh((value) => value + 1);
    setNetworks([]);
    setLoadStatus('loading');
    visited.current = false;
  }, []);
  const sweepAgain = useCallback(() => {
    if (
      session.state.phase !== 'completed' &&
      session.state.phase !== 'selecting'
    )
      return;
    resetSession();
    reloadNetworks();
  }, [resetSession, reloadNetworks, session.state.phase]);
  const stop = useCallback(async () => {
    if (await stopSession()) reloadNetworks();
  }, [stopSession, reloadNetworks]);
  const start = useCallback(() => {
    if (!snapshot || !canStart) return undefined;
    // Done / Stop come back with what was submitted; tokens that converted
    // drop out on reload because they are no longer listed.
    setSelection(new Set(snapshot.tokens.map((token) => token.key)));
    return startSession(snapshot);
  }, [snapshot, canStart, startSession]);
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
    partialError,
    providerInfo,
    threshold: preferences.threshold,
    slippage,
    setSlippage,
    session,
    selecting,
    toggle,
    toggleAll,
    addHidden,
    selectNetwork,
    selectThreshold,
    start,
    sweepAgain,
    stop,
    stopping: session.stopping,
    retry: () => {
      if (selecting) setRefresh((value) => value + 1);
    },
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
