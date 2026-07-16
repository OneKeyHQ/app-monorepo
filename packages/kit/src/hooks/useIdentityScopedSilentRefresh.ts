import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

export type IIdentityScopedSilentRefreshLoadResult<T> =
  | { status: 'success'; data: T }
  | { status: 'empty' };

export type IIdentityScopedSilentRefreshVisible<T> = {
  ownerKey: string;
  requestKey: string;
  data: T;
  source: 'snapshot' | 'live';
};

export type IIdentityScopedSilentRefreshPhase =
  | 'idle'
  | 'initial-loading'
  | 'refreshing'
  | 'ready'
  | 'empty'
  | 'stale-empty'
  | 'failed'
  | 'stale-error';

type IRequestState<T> = {
  ownerKey: string;
  requestKey: string;
  status: 'idle' | 'loading' | 'success' | 'empty' | 'error';
  data?: T;
  error?: unknown;
};

export function useIdentityScopedSilentRefresh<T>({
  enabled = true,
  load,
  onCommit,
  ownerKey,
  refreshKey,
  requestKey,
  restored,
}: {
  enabled?: boolean;
  load: () => Promise<IIdentityScopedSilentRefreshLoadResult<T>>;
  onCommit?: (value: IIdentityScopedSilentRefreshVisible<T>) => void;
  ownerKey: string;
  refreshKey?: string;
  requestKey: string;
  restored?: Omit<IIdentityScopedSilentRefreshVisible<T>, 'source'>;
}) {
  const restoredVisible = useMemo<
    IIdentityScopedSilentRefreshVisible<T> | undefined
  >(
    () =>
      restored?.ownerKey === ownerKey
        ? { ...restored, source: 'snapshot' }
        : undefined,
    [ownerKey, restored],
  );
  const [retainedState, setRetainedState] = useState<{
    ownerKey: string;
    visible?: IIdentityScopedSilentRefreshVisible<T>;
  }>({ ownerKey, visible: restoredVisible });
  const currentVisible =
    retainedState.ownerKey === ownerKey
      ? (retainedState.visible ?? restoredVisible)
      : restoredVisible;
  const [requestState, setRequestState] = useState<IRequestState<T>>({
    ownerKey: '',
    requestKey: '',
    status: 'idle',
  });
  const [refreshNonce, setRefreshNonce] = useState(0);
  const latestScopeRef = useRef({ enabled, ownerKey, requestKey });
  const loadRef = useRef(load);
  const onCommitRef = useRef(onCommit);
  latestScopeRef.current = { enabled, ownerKey, requestKey };
  loadRef.current = load;
  onCommitRef.current = onCommit;

  useEffect(() => {
    if (retainedState.ownerKey === ownerKey) {
      return;
    }
    setRetainedState({ ownerKey, visible: restoredVisible });
  }, [ownerKey, restoredVisible, retainedState.ownerKey]);

  useEffect(() => {
    if (!enabled || !ownerKey || !requestKey) {
      return;
    }
    let active = true;
    const dispatchedOwnerKey = ownerKey;
    const dispatchedRequestKey = requestKey;
    setRequestState({
      ownerKey: dispatchedOwnerKey,
      requestKey: dispatchedRequestKey,
      status: 'loading',
    });
    void Promise.resolve()
      .then(() => loadRef.current())
      .then((result) => {
        const latest = latestScopeRef.current;
        if (
          !active ||
          !latest.enabled ||
          latest.ownerKey !== dispatchedOwnerKey ||
          latest.requestKey !== dispatchedRequestKey
        ) {
          return;
        }
        if (result.status === 'empty') {
          setRequestState({
            ownerKey: dispatchedOwnerKey,
            requestKey: dispatchedRequestKey,
            status: 'empty',
          });
          return;
        }
        const nextVisible: IIdentityScopedSilentRefreshVisible<T> = {
          ownerKey: dispatchedOwnerKey,
          requestKey: dispatchedRequestKey,
          data: result.data,
          source: 'live',
        };
        setRetainedState({
          ownerKey: dispatchedOwnerKey,
          visible: nextVisible,
        });
        setRequestState({
          ownerKey: dispatchedOwnerKey,
          requestKey: dispatchedRequestKey,
          status: 'success',
          data: result.data,
        });
        onCommitRef.current?.(nextVisible);
      })
      .catch((error: unknown) => {
        const latest = latestScopeRef.current;
        if (
          !active ||
          !latest.enabled ||
          latest.ownerKey !== dispatchedOwnerKey ||
          latest.requestKey !== dispatchedRequestKey
        ) {
          return;
        }
        setRequestState({
          ownerKey: dispatchedOwnerKey,
          requestKey: dispatchedRequestKey,
          status: 'error',
          error,
        });
      });
    return () => {
      active = false;
    };
  }, [enabled, ownerKey, refreshKey, refreshNonce, requestKey]);

  const refresh = useCallback(() => {
    setRefreshNonce((value) => value + 1);
  }, []);
  const isRequestStateExact =
    requestState.ownerKey === ownerKey &&
    requestState.requestKey === requestKey;
  const isVisibleExact = Boolean(
    currentVisible?.ownerKey === ownerKey &&
    currentVisible.requestKey === requestKey,
  );

  let phase: IIdentityScopedSilentRefreshPhase;
  if (!ownerKey || !requestKey) {
    phase = 'idle';
  } else if (!enabled) {
    phase = currentVisible ? 'ready' : 'idle';
  } else if (!isRequestStateExact || requestState.status === 'loading') {
    phase = currentVisible ? 'refreshing' : 'initial-loading';
  } else if (requestState.status === 'success') {
    phase = 'ready';
  } else if (requestState.status === 'empty') {
    phase = currentVisible ? 'stale-empty' : 'empty';
  } else if (requestState.status === 'error') {
    phase = currentVisible ? 'stale-error' : 'failed';
  } else {
    phase = currentVisible ? 'refreshing' : 'initial-loading';
  }

  return {
    requested: { ownerKey, requestKey },
    visible: currentVisible,
    phase,
    isVisibleExact,
    error:
      isRequestStateExact && requestState.status === 'error'
        ? requestState.error
        : undefined,
    refresh,
  };
}
