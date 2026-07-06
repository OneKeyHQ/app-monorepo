import platformEnv from '@onekeyhq/shared/src/platformEnv';

type IMarketPerfEntry = {
  name: string;
  time: number;
  detail?: Record<string, unknown>;
};

type IMarketPerfGlobal = typeof globalThis & {
  __onekeyMarketPerf?: IMarketPerfEntry[];
};

export function markMarketPerf(name: string, detail?: Record<string, unknown>) {
  if (!platformEnv.isWeb || typeof performance === 'undefined') {
    return;
  }

  const perfGlobal = globalThis as IMarketPerfGlobal;
  const entries = (perfGlobal.__onekeyMarketPerf ??= []);
  entries.push({
    name,
    time: performance.now(),
    detail,
  });
}
