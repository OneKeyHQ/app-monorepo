import { useMemo, useRef, useSyncExternalStore } from 'react';

import type { ISwrCacheNamespace } from '@onekeyhq/shared/src/utils/swrCacheNamespaceNames';
import {
  prefixOf,
  swrCacheUtils,
} from '@onekeyhq/shared/src/utils/swrCacheUtils';

import { usePromiseResult } from './usePromiseResult';

export type IUiResourceResult<T> =
  | { scopeKey: string; status: 'ready'; data: T; revalidationError?: true }
  | { scopeKey: string; status: 'error' };

// One descriptor per resource, owned by the UI runtime. It holds no business data.
export function createUiResource(namespace: ISwrCacheNamespace) {
  let epoch = 0;
  const listeners = new Set<() => void>();
  return {
    getEpoch: () => epoch,
    subscribe: (listener: () => void) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    isCurrent: (version: number | undefined) => version === epoch,
    invalidate() {
      epoch += 1;
      swrCacheUtils.removeByPrefix(prefixOf(namespace));
      swrCacheUtils.flushNow();
      listeners.forEach((listener) => listener());
    },
  };
}

export function useUiResource<T>(
  resource: ReturnType<typeof createUiResource>,
  scopeKey: string | undefined,
  load: () => Promise<T>,
) {
  const epoch = useSyncExternalStore(
    resource.subscribe,
    resource.getEpoch,
    resource.getEpoch,
  );
  const readyRef = useRef<
    { epoch: number; result: IUiResourceResult<T> } | undefined
  >(undefined);
  const scopeRef = useRef({ epoch, scopeKey });
  const scopeChanged =
    scopeRef.current.epoch !== epoch || scopeRef.current.scopeKey !== scopeKey;
  if (scopeChanged) {
    readyRef.current = undefined;
    scopeRef.current = { epoch, scopeKey };
  }
  const loadRef = useRef(load);
  loadRef.current = load;
  const { result, isLoading, run } = usePromiseResult<
    IUiResourceResult<T> | undefined
  >(
    async () => {
      if (!scopeKey || !resource.isCurrent(epoch)) return undefined;
      try {
        return { scopeKey, status: 'ready', data: await loadRef.current() };
      } catch {
        const previous = readyRef.current;
        if (
          previous?.epoch === epoch &&
          previous.result.scopeKey === scopeKey &&
          previous.result.status === 'ready'
        ) {
          return { ...previous.result, revalidationError: true };
        }
        return { scopeKey, status: 'error' };
      }
    },
    [resource, scopeKey, epoch],
    {
      swrKey: scopeKey,
      checkIsFocused: false,
      watchLoading: Boolean(scopeKey),
      resultVersion: epoch,
      isResultVersionCurrent: resource.isCurrent,
      swrShouldPersist: (value) =>
        value?.status === 'ready' && !value.revalidationError,
    },
  );
  if (
    !scopeChanged &&
    result?.scopeKey === scopeKey &&
    result?.status === 'ready'
  ) {
    readyRef.current = { epoch, result };
  }
  return useMemo(
    () => ({
      epoch,
      status:
        result && result.scopeKey === scopeKey
          ? result.status
          : ('pending' as const),
      result: result?.scopeKey === scopeKey ? result : undefined,
      freshness:
        isLoading === false &&
        result?.status === 'ready' &&
        !result.revalidationError
          ? ('fresh' as const)
          : ('stale' as const),
      reload: run,
    }),
    [epoch, result, scopeKey, isLoading, run],
  );
}
