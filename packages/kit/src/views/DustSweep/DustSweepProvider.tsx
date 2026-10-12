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
} from '@onekeyhq/shared/types/swap/dustSweep';
import type { ISwapProviderInfo } from '@onekeyhq/shared/types/swap/SwapProvider.constants';

import { useDustSweepPreview } from './hooks/useDustSweepPreview';
import { useDustSweepSession } from './hooks/useDustSweepSession';
import { filterDustSweepCandidates } from './utils/candidates';
import { loadDustSweepNetworks } from './utils/loadNetworks';

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
  const [networksWithHidden, setNetworksWithHidden] = useState<Set<string>>(
    () => new Set(),
  );
  const [selection, setSelection] = useState<Set<string>>();
  const [slippage, setSlippage] = useState(5);
  const [previewRevision, setPreviewRevision] = useState(0);
  const visited = useRef(false);
  const firstVisit = useRef(true);
  const hiddenReported = useRef(false);
  const session = useDustSweepSession(networks);
  const { reset: resetSession, start: startSession } = session;
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
  const orderedNetworks = useMemo(
    () =>
      networks
        .map((entry) => ({
          ...entry,
          valueUsd: entry.tokens
            .filter((token) =>
              new BigNumber(token.valueUsd).lt(preferences.threshold),
            )
            .reduce((sum, token) => sum.plus(token.valueUsd), new BigNumber(0))
            .toFixed(),
        }))
        .toSorted(
          (a, b) => new BigNumber(b.valueUsd).comparedTo(a.valueUsd) ?? 0,
        ),
    [networks, preferences.threshold],
  );
  const current =
    orderedNetworks.find((entry) => entry.network.networkId === networkId) ??
    (selecting ? orderedNetworks[0] : undefined);
  const currentNetworkId = current?.network.networkId;
  const includeHidden =
    !!currentNetworkId && networksWithHidden.has(currentNetworkId);
  useEffect(() => {
    if (!selecting || !currentNetworkId || currentNetworkId === networkId)
      return;
    setNetworkId(currentNetworkId);
    setSelection(undefined);
    hiddenReported.current = false;
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
  const selectableHidden = useMemo(
    () => hidden.filter((token) => !token.suspicious),
    [hidden],
  );
  const selected = useMemo(
    () =>
      visible.filter((token) =>
        selection ? selection.has(token.key) : !token.suspicious,
      ),
    [visible, selection],
  );
  const valueUsd = selected
    .reduce((sum, token) => sum.plus(token.valueUsd), new BigNumber(0))
    .toFixed();
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
  const preview = useDustSweepPreview(snapshot, {
    enabled: selecting && isFocused && loadStatus === 'ready',
    revision: previewRevision,
  });
  const canStart =
    selecting &&
    isFocused &&
    loadStatus === 'ready' &&
    (preview.status === 'ready' || preview.status === 'partial') &&
    preview.quotedCount > 0;
  const quotedValueUsd = selected
    .filter((token) => preview.availableKeys.includes(token.key))
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
      hiddenReported.current = false;
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
          value ??
            visible
              .filter((token) => !token.suspicious)
              .map((token) => token.key),
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
    if (!selecting || includeHidden || !currentNetworkId) return;
    setSelection(
      new Set([...selected, ...selectableHidden].map((token) => token.key)),
    );
    setNetworksWithHidden((value) => new Set(value).add(currentNetworkId));
    if (!hiddenReported.current) {
      hiddenReported.current = true;
      defaultLogger.dex.dustSweep.dustSweepAddHidden({
        hiddenCount: hidden.length,
      });
    }
  }, [
    selecting,
    includeHidden,
    currentNetworkId,
    selected,
    selectableHidden,
    hidden.length,
  ]);
  const sweepAgain = useCallback(() => {
    if (
      session.state.phase !== 'completed' &&
      session.state.phase !== 'selecting'
    )
      return;
    resetSession();
    setSelection(undefined);
    setNetworksWithHidden(new Set());
    hiddenReported.current = false;
    setRefresh((value) => value + 1);
    setNetworks([]);
    setLoadStatus('loading');
    visited.current = false;
  }, [resetSession, session.state.phase]);
  const start = useCallback(() => {
    if (snapshot && canStart)
      return startSession(snapshot, preview.unavailable);
    return undefined;
  }, [snapshot, canStart, preview.unavailable, startSession]);
  const retryPreview = useCallback(() => {
    if (
      selecting &&
      isFocused &&
      selected.length &&
      loadStatus === 'ready' &&
      preview.status !== 'loading' &&
      preview.status !== 'refreshing'
    )
      setPreviewRevision((value) => value + 1);
  }, [selecting, isFocused, selected.length, loadStatus, preview.status]);
  return {
    params,
    networks: orderedNetworks,
    current,
    visible,
    hidden,
    selected,
    includeHidden,
    valueUsd,
    quotedValueUsd,
    canStart,
    isFocused,
    loadStatus,
    partialError,
    providerInfo,
    threshold: preferences.threshold,
    slippage,
    setSlippage,
    preview,
    session,
    selecting,
    toggle,
    toggleAll,
    addHidden,
    selectNetwork,
    selectThreshold,
    start,
    sweepAgain,
    retry: () => {
      if (selecting) setRefresh((value) => value + 1);
    },
    retryPreview,
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
