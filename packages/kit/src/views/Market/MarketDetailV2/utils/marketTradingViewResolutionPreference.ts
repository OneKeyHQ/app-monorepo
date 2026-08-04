import appStorage from '@onekeyhq/shared/src/storage/appStorage';
import { normalizeTokenContractAddress } from '@onekeyhq/shared/src/utils/tokenUtils';

export type IMarketTradingViewResolutionNamespace =
  | 'market'
  | 'market-hyperliquid';

export interface IMarketTradingViewFirstScreenRequestPreference {
  resolution: string;
  historySeconds?: number;
  futureSeconds?: number;
  countBack?: number;
}

interface IStoredFirstScreenRequestRange {
  historySeconds: number;
  futureSeconds: number;
  countBack?: number;
}

type IStoredFirstScreenRequestRanges = Record<
  string,
  IStoredFirstScreenRequestRange
>;

const MARKET_TRADING_VIEW_LAST_RESOLUTION_STORAGE_KEYS: Record<
  IMarketTradingViewResolutionNamespace,
  string
> = {
  market: 'market_trading_view_last_resolution_v1',
  'market-hyperliquid': 'market_hyperliquid_trading_view_last_resolution_v1',
};
const MARKET_TRADING_VIEW_FIRST_SCREEN_REQUEST_STORAGE_KEYS: Record<
  IMarketTradingViewResolutionNamespace,
  string
> = {
  market: 'market_trading_view_first_screen_request_v1',
  'market-hyperliquid':
    'market_hyperliquid_trading_view_first_screen_request_v1',
};
const DEFAULT_MARKET_TRADING_VIEW_RESOLUTION = '1m';
const MAX_FIRST_SCREEN_HISTORY_SECONDS = 5 * 365 * 24 * 60 * 60;
const MAX_FIRST_SCREEN_FUTURE_SECONDS = 24 * 60 * 60;
const MAX_FIRST_SCREEN_COUNT_BACK = 2000;
const MAX_MARKET_TRADING_VIEW_SESSION_PREFERENCES = 100;

const cachedResolutions = new Map<
  IMarketTradingViewResolutionNamespace,
  string
>();
const hydratePromises = new Map<
  IMarketTradingViewResolutionNamespace,
  Promise<void>
>();
const preferenceRevisions = new Map<
  IMarketTradingViewResolutionNamespace,
  number
>();
const cachedFirstScreenRequestRanges = new Map<
  IMarketTradingViewResolutionNamespace,
  IStoredFirstScreenRequestRanges
>();
const firstScreenRequestHydratePromises = new Map<
  IMarketTradingViewResolutionNamespace,
  Promise<void>
>();
const firstScreenRequestRevisions = new Map<
  IMarketTradingViewResolutionNamespace,
  number
>();
const sessionPreferences = new Map<
  string,
  IMarketTradingViewFirstScreenRequestPreference
>();
let preferencesHydrationGeneration = 0;
let preferencesHydrationPromise: Promise<void> | undefined;
let preferencesHydrated = false;

function buildMarketTradingViewSessionPreferenceKey({
  tokenAddress,
  networkId,
  namespace,
}: {
  tokenAddress: string;
  networkId: string;
  namespace: IMarketTradingViewResolutionNamespace;
}) {
  const normalizedNetworkId = networkId.trim();
  const normalizedTokenAddress =
    normalizeTokenContractAddress({
      networkId: normalizedNetworkId,
      contractAddress: tokenAddress.trim(),
    }) ?? '';

  return `${namespace}:${normalizedNetworkId}:${normalizedTokenAddress}`;
}

function setMarketTradingViewSessionPreference(
  key: string,
  preference: IMarketTradingViewFirstScreenRequestPreference,
) {
  sessionPreferences.delete(key);
  sessionPreferences.set(key, preference);

  if (sessionPreferences.size <= MAX_MARKET_TRADING_VIEW_SESSION_PREFERENCES) {
    return;
  }

  const oldestKey = sessionPreferences.keys().next().value;
  if (typeof oldestKey === 'string') {
    sessionPreferences.delete(oldestKey);
  }
}

function normalizeStoredResolution(resolution: string | null | undefined) {
  const normalizedResolution = resolution?.trim();
  if (!normalizedResolution) {
    return undefined;
  }

  const match = normalizedResolution.match(/^(\d+)([a-zA-Z]+)$/);
  if (!match) {
    return undefined;
  }

  const [, count, rawUnit] = match;
  if (rawUnit === 'M') {
    return `${count}M`;
  }

  switch (rawUnit.toLowerCase()) {
    case 'm':
      return `${count}m`;
    case 'h':
      return `${count}H`;
    case 'd':
      return `${count}D`;
    case 'w':
      return `${count}W`;
    case 'y':
      return `${count}y`;
    default:
      return undefined;
  }
}

function normalizeStoredSeconds(value: unknown, maxValue: number) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
    return undefined;
  }

  return Math.min(Math.floor(value), maxValue);
}

function normalizeStoredCountBack(value: unknown) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) {
    return undefined;
  }
  return Math.min(Math.floor(value), MAX_FIRST_SCREEN_COUNT_BACK);
}

function parseStoredFirstScreenRequestRanges(
  value: string | null,
): IStoredFirstScreenRequestRanges {
  if (!value) {
    return {};
  }

  try {
    const parsedValue: unknown = JSON.parse(value);
    if (
      !parsedValue ||
      typeof parsedValue !== 'object' ||
      Array.isArray(parsedValue)
    ) {
      return {};
    }

    const ranges: IStoredFirstScreenRequestRanges = {};
    for (const [resolution, rangeValue] of Object.entries(parsedValue)) {
      if (
        rangeValue &&
        typeof rangeValue === 'object' &&
        !Array.isArray(rangeValue)
      ) {
        const normalizedResolution = normalizeStoredResolution(resolution);
        const rangeRecord = rangeValue as Record<string, unknown>;
        const historySeconds = normalizeStoredSeconds(
          rangeRecord.historySeconds,
          MAX_FIRST_SCREEN_HISTORY_SECONDS,
        );
        const futureSeconds = normalizeStoredSeconds(
          rangeRecord.futureSeconds,
          MAX_FIRST_SCREEN_FUTURE_SECONDS,
        );
        const countBack = normalizeStoredCountBack(rangeRecord.countBack);
        if (
          normalizedResolution &&
          historySeconds !== undefined &&
          futureSeconds !== undefined
        ) {
          ranges[normalizedResolution] = {
            historySeconds,
            futureSeconds,
            ...(countBack !== undefined ? { countBack } : {}),
          };
        }
      }
    }
    return ranges;
  } catch {
    return {};
  }
}

export function getMarketTradingViewPrefetchResolution(
  namespace: IMarketTradingViewResolutionNamespace = 'market',
) {
  return (
    cachedResolutions.get(namespace) ?? DEFAULT_MARKET_TRADING_VIEW_RESOLUTION
  );
}

export function getMarketTradingViewFirstScreenRequestPreference(
  namespace: IMarketTradingViewResolutionNamespace = 'market',
): IMarketTradingViewFirstScreenRequestPreference {
  const resolution = getMarketTradingViewPrefetchResolution(namespace);
  const range = cachedFirstScreenRequestRanges.get(namespace)?.[resolution];

  return {
    resolution,
    historySeconds: range?.historySeconds,
    futureSeconds: range?.futureSeconds,
    countBack: range?.countBack,
  };
}

export function startMarketTradingViewSessionPreference({
  tokenAddress,
  networkId,
  namespace = 'market',
}: {
  tokenAddress: string;
  networkId: string;
  namespace?: IMarketTradingViewResolutionNamespace;
}): IMarketTradingViewFirstScreenRequestPreference {
  const preference = {
    ...getMarketTradingViewFirstScreenRequestPreference(namespace),
  };
  setMarketTradingViewSessionPreference(
    buildMarketTradingViewSessionPreferenceKey({
      tokenAddress,
      networkId,
      namespace,
    }),
    preference,
  );
  return preference;
}

export function getMarketTradingViewSessionPreference({
  tokenAddress,
  networkId,
  namespace = 'market',
}: {
  tokenAddress: string;
  networkId: string;
  namespace?: IMarketTradingViewResolutionNamespace;
}): IMarketTradingViewFirstScreenRequestPreference {
  const key = buildMarketTradingViewSessionPreferenceKey({
    tokenAddress,
    networkId,
    namespace,
  });
  const preference = sessionPreferences.get(key);
  if (preference) {
    setMarketTradingViewSessionPreference(key, preference);
    return preference;
  }

  return startMarketTradingViewSessionPreference({
    tokenAddress,
    networkId,
    namespace,
  });
}

export function updateMarketTradingViewSessionResolution({
  tokenAddress,
  networkId,
  resolution,
  namespace = 'market',
}: {
  tokenAddress: string;
  networkId: string;
  resolution: string;
  namespace?: IMarketTradingViewResolutionNamespace;
}) {
  const normalizedResolution = normalizeStoredResolution(resolution);
  if (!normalizedResolution) {
    return;
  }

  const range =
    cachedFirstScreenRequestRanges.get(namespace)?.[normalizedResolution];
  setMarketTradingViewSessionPreference(
    buildMarketTradingViewSessionPreferenceKey({
      tokenAddress,
      networkId,
      namespace,
    }),
    {
      resolution: normalizedResolution,
      historySeconds: range?.historySeconds,
      futureSeconds: range?.futureSeconds,
      countBack: range?.countBack,
    },
  );
}

export function hydrateMarketTradingViewFirstScreenRequestPreference(
  namespace: IMarketTradingViewResolutionNamespace = 'market',
): Promise<void> {
  let hydratePromise = firstScreenRequestHydratePromises.get(namespace);
  if (!hydratePromise) {
    const revisionAtStart = firstScreenRequestRevisions.get(namespace) ?? 0;
    hydratePromise = (async () => {
      try {
        const storedRanges = parseStoredFirstScreenRequestRanges(
          await appStorage.getItem(
            MARKET_TRADING_VIEW_FIRST_SCREEN_REQUEST_STORAGE_KEYS[namespace],
          ),
        );
        if (
          (firstScreenRequestRevisions.get(namespace) ?? 0) === revisionAtStart
        ) {
          cachedFirstScreenRequestRanges.set(namespace, storedRanges);
        }
      } catch {
        // The default first-screen window remains available without storage.
      }
    })();
    firstScreenRequestHydratePromises.set(namespace, hydratePromise);
  }

  return hydratePromise;
}

export function hydrateMarketTradingViewResolutionPreference(
  namespace: IMarketTradingViewResolutionNamespace = 'market',
): Promise<void> {
  let hydratePromise = hydratePromises.get(namespace);
  if (!hydratePromise) {
    const revisionAtStart = preferenceRevisions.get(namespace) ?? 0;
    hydratePromise = (async () => {
      try {
        const storedResolution = normalizeStoredResolution(
          await appStorage.getItem(
            MARKET_TRADING_VIEW_LAST_RESOLUTION_STORAGE_KEYS[namespace],
          ),
        );
        if (
          (preferenceRevisions.get(namespace) ?? 0) === revisionAtStart &&
          storedResolution
        ) {
          cachedResolutions.set(namespace, storedResolution);
        }
      } catch {
        // The default resolution remains available when storage is unavailable.
      }
    })();
    hydratePromises.set(namespace, hydratePromise);
  }

  return Promise.all([
    hydratePromise,
    hydrateMarketTradingViewFirstScreenRequestPreference(namespace),
  ]).then(() => undefined);
}

export function hydrateMarketTradingViewPreferences(): Promise<void> {
  if (!preferencesHydrationPromise) {
    const generationAtStart = preferencesHydrationGeneration;
    preferencesHydrationPromise = Promise.all([
      hydrateMarketTradingViewResolutionPreference('market'),
      hydrateMarketTradingViewResolutionPreference('market-hyperliquid'),
    ]).then(() => {
      if (preferencesHydrationGeneration === generationAtStart) {
        preferencesHydrated = true;
      }
    });
  }
  return preferencesHydrationPromise;
}

export function isMarketTradingViewPreferencesHydrated() {
  return preferencesHydrated;
}

export async function saveMarketTradingViewResolutionPreference(
  resolution: string,
  namespace: IMarketTradingViewResolutionNamespace = 'market',
) {
  const normalizedResolution = normalizeStoredResolution(resolution);
  if (
    !normalizedResolution ||
    normalizedResolution === cachedResolutions.get(namespace)
  ) {
    return;
  }

  preferenceRevisions.set(
    namespace,
    (preferenceRevisions.get(namespace) ?? 0) + 1,
  );
  cachedResolutions.set(namespace, normalizedResolution);
  try {
    await appStorage.setItem(
      MARKET_TRADING_VIEW_LAST_RESOLUTION_STORAGE_KEYS[namespace],
      normalizedResolution,
    );
  } catch {
    // Keep the current main-JS value when persistence is unavailable.
  }
}

export async function saveMarketTradingViewFirstScreenRequestPreference({
  resolution,
  from,
  to,
  firstDataRequest,
  countBack,
  namespace = 'market',
}: {
  resolution: string;
  from: number;
  to: number;
  firstDataRequest: boolean;
  countBack?: number;
  namespace?: IMarketTradingViewResolutionNamespace;
}) {
  if (
    !firstDataRequest ||
    !Number.isFinite(from) ||
    !Number.isFinite(to) ||
    from >= to
  ) {
    return;
  }

  const normalizedResolution = normalizeStoredResolution(resolution);
  if (!normalizedResolution) {
    return;
  }

  await hydrateMarketTradingViewFirstScreenRequestPreference(namespace);

  const nowSeconds = Math.floor(Date.now() / 1000);
  const historySeconds = normalizeStoredSeconds(
    Math.max(0, nowSeconds - from),
    MAX_FIRST_SCREEN_HISTORY_SECONDS,
  );
  const futureSeconds = normalizeStoredSeconds(
    Math.max(0, to - nowSeconds),
    MAX_FIRST_SCREEN_FUTURE_SECONDS,
  );
  const normalizedCountBack = normalizeStoredCountBack(countBack);
  if (historySeconds === undefined || futureSeconds === undefined) {
    return;
  }

  const currentRanges = cachedFirstScreenRequestRanges.get(namespace) ?? {};
  const currentRange = currentRanges[normalizedResolution];
  if (
    currentRange?.historySeconds === historySeconds &&
    currentRange.futureSeconds === futureSeconds &&
    currentRange.countBack === normalizedCountBack
  ) {
    return;
  }

  const nextRanges = {
    ...currentRanges,
    [normalizedResolution]: {
      historySeconds,
      futureSeconds,
      ...(normalizedCountBack !== undefined
        ? { countBack: normalizedCountBack }
        : {}),
    },
  };
  firstScreenRequestRevisions.set(
    namespace,
    (firstScreenRequestRevisions.get(namespace) ?? 0) + 1,
  );
  cachedFirstScreenRequestRanges.set(namespace, nextRanges);
  try {
    await appStorage.setItem(
      MARKET_TRADING_VIEW_FIRST_SCREEN_REQUEST_STORAGE_KEYS[namespace],
      JSON.stringify(nextRanges),
    );
  } catch {
    // Keep the current main-JS value when persistence is unavailable.
  }
}

export function clearMarketTradingViewResolutionPreferenceCache() {
  preferencesHydrationGeneration += 1;
  preferencesHydrationPromise = undefined;
  preferencesHydrated = false;
  cachedResolutions.clear();
  hydratePromises.clear();
  preferenceRevisions.clear();
  cachedFirstScreenRequestRanges.clear();
  firstScreenRequestHydratePromises.clear();
  firstScreenRequestRevisions.clear();
  sessionPreferences.clear();
}
