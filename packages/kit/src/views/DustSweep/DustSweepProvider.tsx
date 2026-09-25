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

import { useDustSweepPreferencesPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import type {
  IDustSweepNetwork,
  IDustSweepRouteParams,
  IDustSweepSnapshot,
  IDustSweepThreshold,
} from '@onekeyhq/shared/types/swap/dustSweep';

import { useDustSweepPreview } from './hooks/useDustSweepPreview';
import { useDustSweepSession } from './hooks/useDustSweepSession';
import { filterDustSweepCandidates } from './utils/candidates';
import { loadDustSweepNetworks } from './utils/loadNetworks';

function useDustSweepController(params: IDustSweepRouteParams) {
  const [preferences, setPreferences] = useDustSweepPreferencesPersistAtom();
  const [networks, setNetworks] = useState<IDustSweepNetwork[]>([]);
  const [loadStatus, setLoadStatus] = useState<'loading' | 'ready' | 'error'>(
    'loading',
  );
  const [partialError, setPartialError] = useState(false);
  const [refresh, setRefresh] = useState(0);
  const [networkId, setNetworkId] = useState(params.networkId);
  const [includeHidden, setIncludeHidden] = useState(false);
  const [selection, setSelection] = useState<Set<string>>();
  const [slippage, setSlippage] = useState(5);
  const [previewRevision, setPreviewRevision] = useState(0);
  const visited = useRef(false);
  const firstVisit = useRef(true);
  const hiddenReported = useRef(false);
  const session = useDustSweepSession(networks);
  const selecting = session.state.phase === 'selecting';
  useEffect(() => {
    const controller = new AbortController();
    setLoadStatus('loading');
    void loadDustSweepNetworks(params, controller.signal)
      .then((result) => {
        if (controller.signal.aborted) return;
        setNetworks(result.networks);
        setPartialError(result.partialError);
        setLoadStatus('ready');
      })
      .catch(() => {
        if (!controller.signal.aborted) setLoadStatus('error');
      });
    return () => controller.abort();
  }, [params, refresh]);
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
    orderedNetworks[0];
  const currentNetworkId = current?.network.networkId;
  useEffect(() => {
    if (currentNetworkId && currentNetworkId !== networkId)
      setNetworkId(currentNetworkId);
  }, [currentNetworkId, networkId]);
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
            id: `${current.accountId}:${current.network.networkId}:${slippage}:${selected.map((token) => `${token.key}=${token.amount}`).join('|')}:${previewRevision}`,
            accountId: current.accountId,
            address: current.address,
            networkId: current.network.networkId,
            nativeToken: current.nativeToken,
            slippage,
            tokens: selected,
          }
        : undefined,
    [current, selecting, slippage, selected, previewRevision],
  );
  const preview = useDustSweepPreview(snapshot);
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
        const next = new Set(value ?? selected.map((token) => token.key));
        if (next.has(key)) next.delete(key);
        else next.add(key);
        return next;
      });
    },
    [selecting, selected],
  );
  const toggleAll = useCallback(() => {
    if (!selecting) return;
    setSelection(
      selected.length === visible.length
        ? new Set()
        : new Set(visible.map((token) => token.key)),
    );
  }, [selecting, selected.length, visible]);
  const addHidden = useCallback(() => {
    if (!selecting || includeHidden) return;
    setSelection(
      new Set(
        [...selected, ...hidden.filter((token) => !token.suspicious)].map(
          (token) => token.key,
        ),
      ),
    );
    setIncludeHidden(true);
    if (!hiddenReported.current) {
      hiddenReported.current = true;
      defaultLogger.dex.dustSweep.dustSweepAddHidden({
        hiddenCount: hidden.length,
        hiddenTotalUsd: hidden
          .reduce((sum, token) => sum.plus(token.valueUsd), new BigNumber(0))
          .toFixed(),
      });
    }
  }, [selecting, includeHidden, selected, hidden]);
  const sweepAgain = useCallback(() => {
    session.reset();
    setSelection(undefined);
    setIncludeHidden(false);
    setRefresh((value) => value + 1);
    setNetworks([]);
    setLoadStatus('loading');
    visited.current = false;
  }, [session]);
  const start = useCallback(() => {
    if (snapshot && selected.length && loadStatus === 'ready')
      session.start({ ...snapshot, id: `dust-${Date.now()}` });
  }, [snapshot, selected.length, loadStatus, session]);
  return {
    params,
    networks: orderedNetworks,
    current,
    visible,
    hidden,
    selected,
    valueUsd,
    loadStatus,
    partialError,
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
    retryPreview: () => setPreviewRevision((value) => value + 1),
  };
}

const DustSweepContext = createContext<
  ReturnType<typeof useDustSweepController> | undefined
>(undefined);

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
