import { useCallback, useEffect, useRef, useState } from 'react';

import type { IHomeDefaultToken } from '@onekeyhq/shared/types/token';

import backgroundApiProxy from '../../background/instance/backgroundApiProxy';

export type INativeHomeDefaultTokenMapStatus = 'loading' | 'success' | 'error';

export interface INativeHomeDefaultTokenMapState {
  map: Record<string, IHomeDefaultToken>;
  status: INativeHomeDefaultTokenMapStatus;
}

const DEFAULT_TOKEN_MAP_RETRY_DELAY_MS = 3000;

export async function loadNativeHomeDefaultTokenMap({
  fetchMap,
  previousMap,
}: {
  fetchMap: () => Promise<Record<string, IHomeDefaultToken>>;
  previousMap: Record<string, IHomeDefaultToken>;
}): Promise<INativeHomeDefaultTokenMapState> {
  try {
    return {
      map: await fetchMap(),
      status: 'success',
    };
  } catch {
    return {
      map: previousMap,
      status: 'error',
    };
  }
}

export function resolveNativeHomeDefaultTokenProjection(
  status: INativeHomeDefaultTokenMapStatus,
): {
  hideZeroBalanceTokens: boolean;
  initialized: boolean;
} {
  return {
    hideZeroBalanceTokens: status === 'success',
    initialized: status !== 'loading',
  };
}

export function useNativeHomeDefaultTokenMap({
  retryDelayMs = DEFAULT_TOKEN_MAP_RETRY_DELAY_MS,
}: {
  retryDelayMs?: number;
} = {}): INativeHomeDefaultTokenMapState & { refresh: () => Promise<void> } {
  const [state, setState] = useState<INativeHomeDefaultTokenMapState>({
    map: {},
    status: 'loading',
  });
  const [retryGeneration, setRetryGeneration] = useState(0);
  const mapRef = useRef(state.map);
  const requestGenerationRef = useRef(0);

  const refresh = useCallback(async () => {
    requestGenerationRef.current += 1;
    const requestGeneration = requestGenerationRef.current;
    const nextState = await loadNativeHomeDefaultTokenMap({
      fetchMap: () => backgroundApiProxy.serviceToken.getHomeDefaultTokenMap(),
      previousMap: mapRef.current,
    });
    if (requestGeneration !== requestGenerationRef.current) {
      return;
    }
    mapRef.current = nextState.map;
    setState(nextState);
    if (nextState.status === 'error') {
      setRetryGeneration((generation) => generation + 1);
    }
  }, []);

  useEffect(() => {
    void refresh();
    return () => {
      requestGenerationRef.current += 1;
    };
  }, [refresh]);

  useEffect(() => {
    if (state.status !== 'error') {
      return;
    }
    const timer = setTimeout(() => {
      void refresh();
    }, retryDelayMs);
    return () => clearTimeout(timer);
  }, [refresh, retryDelayMs, retryGeneration, state.status]);

  return { ...state, refresh };
}
