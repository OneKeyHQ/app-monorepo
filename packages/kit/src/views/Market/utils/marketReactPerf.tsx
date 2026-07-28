import { useLayoutEffect, useRef } from 'react';

import platformEnv from '@onekeyhq/shared/src/platformEnv';

type IMarketReactPerfEntry = {
  name: string;
  time: number;
  phase: 'commit' | 'measure';
  duration?: number;
  detail?: Record<string, unknown>;
};

type IMarketReactPerfGlobal = typeof globalThis & {
  __onekeyMarketReactPerf?: IMarketReactPerfEntry[];
  __onekeyMarketReactPerfProbe?: boolean;
};

export function isMarketReactPerfProbeEnabled() {
  const perfGlobal = globalThis as IMarketReactPerfGlobal;
  const isEnvProbeEnabled =
    typeof process !== 'undefined' &&
    process.env.PERF_WEB_COLD_REACT_PROBE === '1';
  return (
    platformEnv.isWeb &&
    typeof performance !== 'undefined' &&
    (perfGlobal.__onekeyMarketReactPerfProbe === true || isEnvProbeEnabled)
  );
}

export function markMarketReactPerf({
  name,
  phase,
  duration,
  detail,
}: Omit<IMarketReactPerfEntry, 'time'>) {
  if (!isMarketReactPerfProbeEnabled()) {
    return;
  }

  const perfGlobal = globalThis as IMarketReactPerfGlobal;
  const entries = (perfGlobal.__onekeyMarketReactPerf ??= []);
  entries.push({
    name,
    time: performance.now(),
    phase,
    duration,
    detail,
  });
}

export function useMarketRenderCommitProbe(
  name: string,
  detail?: Record<string, unknown>,
) {
  const renderStartRef = useRef(0);
  const renderCountRef = useRef(0);
  const enabled = isMarketReactPerfProbeEnabled();

  if (enabled) {
    renderStartRef.current = performance.now();
    renderCountRef.current += 1;
  }

  useLayoutEffect(() => {
    if (!enabled) {
      return;
    }

    const commitTime = performance.now();
    markMarketReactPerf({
      name,
      phase: 'commit',
      duration: commitTime - renderStartRef.current,
      detail: {
        ...detail,
        renderCount: renderCountRef.current,
      },
    });
  });
}
