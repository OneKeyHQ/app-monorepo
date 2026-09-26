import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useSyncExternalStore,
} from 'react';

import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import {
  swrCacheUtils,
  swrKeys,
} from '@onekeyhq/shared/src/utils/swrCacheUtils';
import type { IBorrowHealthFactor } from '@onekeyhq/shared/types/staking';

import { isBorrowMetricReadyForMarketSwitch } from './borrowMetricSnapshot.utils';

interface IUseBorrowHealthFactorParams {
  networkId?: string;
  provider?: string;
  marketAddress?: string;
  accountId?: string;
  enabled?: boolean;
  isPreloading?: boolean;
}

const POLLING_INTERVAL = 30 * 1000; // 30 seconds
const PRELOADED_CACHE_TTL = 60_000;

type IHealthFactorRequest = Parameters<
  typeof backgroundApiProxy.serviceStaking.getBorrowHealthFactor
>[0];

const inFlightHealthFactors = new Map<string, Promise<IBorrowHealthFactor>>();
let accountInvalidationRegistered = false;
let lastAccountInvalidationAt = 0;
let accountGeneration = 0;
const accountGenerationListeners = new Set<() => void>();

function registerAccountInvalidation() {
  if (accountInvalidationRegistered) {
    return;
  }
  accountInvalidationRegistered = true;
  const invalidate = () => {
    inFlightHealthFactors.clear();
    lastAccountInvalidationAt = Date.now();
    accountGeneration += 1;
    accountGenerationListeners.forEach((listener) => listener());
  };
  appEventBus.on(EAppEventBusNames.WalletClear, invalidate);
  appEventBus.on(EAppEventBusNames.AccountRemove, invalidate);
  appEventBus.on(EAppEventBusNames.AccountUpdate, invalidate);
  appEventBus.on(EAppEventBusNames.GlobalDeriveTypeUpdate, invalidate);
  appEventBus.on(EAppEventBusNames.NetworkDeriveTypeChanged, invalidate);
}

function subscribeAccountGeneration(listener: () => void) {
  registerAccountInvalidation();
  accountGenerationListeners.add(listener);
  return () => accountGenerationListeners.delete(listener);
}

function getAccountGeneration() {
  return accountGeneration;
}

function fetchHealthFactor(params: IHealthFactorRequest, forceNew: boolean) {
  registerAccountInvalidation();
  const key = JSON.stringify([
    params.provider,
    params.networkId,
    params.marketAddress,
    params.accountId,
  ]);
  const existing = inFlightHealthFactors.get(key);
  if (existing && !forceNew) {
    return existing;
  }
  const requestGeneration = accountGeneration;
  const request: Promise<IBorrowHealthFactor> = Promise.resolve()
    .then(() => backgroundApiProxy.serviceStaking.getBorrowHealthFactor(params))
    .then((data) => {
      if (
        requestGeneration !== accountGeneration ||
        inFlightHealthFactors.get(key) !== request
      ) {
        throw new OneKeyLocalError('Borrow health factor request superseded');
      }
      return data;
    });
  inFlightHealthFactors.set(key, request);
  const clear = () => {
    if (inFlightHealthFactors.get(key) === request) {
      inFlightHealthFactors.delete(key);
    }
  };
  void request.then(clear, clear);
  return request;
}

type IScopedHealthFactorResult = {
  scopeKey: string;
  data: IBorrowHealthFactor | null;
  state: 'resolved' | 'error' | 'cancelled';
  accountGeneration?: number;
  resolvedAt?: number;
  fromFreshCache?: boolean;
};

export const useBorrowHealthFactor = ({
  networkId,
  provider,
  marketAddress,
  accountId,
  enabled = true,
  isPreloading = false,
}: IUseBorrowHealthFactorParams) => {
  const currentAccountGeneration = useSyncExternalStore(
    subscribeAccountGeneration,
    getAccountGeneration,
    getAccountGeneration,
  );
  const scopeKey = JSON.stringify([
    networkId,
    provider?.toLowerCase(),
    marketAddress,
    accountId,
    enabled,
  ]);
  const requestParams = useMemo(
    () =>
      networkId && provider && marketAddress && accountId && enabled
        ? { networkId, provider, marketAddress, accountId }
        : null,
    [accountId, enabled, marketAddress, networkId, provider],
  );
  const swrKey = requestParams
    ? swrKeys.borrowHealthFactor(requestParams)
    : undefined;
  const lastSuccessfulResultRef = useRef<{
    scopeKey: string;
    data: IBorrowHealthFactor;
    accountGeneration: number;
  } | null>(null);
  const firstRequestScopeRef = useRef<string | null>(null);
  const forceNetworkRef = useRef(false);
  const {
    result: scopedResult,
    run,
    isLoading,
  } = usePromiseResult(
    async (): Promise<IScopedHealthFactorResult> => {
      if (!requestParams) {
        return { scopeKey, data: null, state: 'resolved' };
      }
      const requestGeneration = currentAccountGeneration;
      const forceNetwork = forceNetworkRef.current;
      forceNetworkRef.current = false;
      const isFirstRequestForScope = firstRequestScopeRef.current !== scopeKey;
      firstRequestScopeRef.current = scopeKey;
      try {
        registerAccountInvalidation();
        if (isFirstRequestForScope && !forceNetwork && swrKey) {
          const cached =
            swrCacheUtils.getWithTimestamp<IScopedHealthFactorResult>(swrKey);
          const now = Date.now();
          if (
            cached?.data.scopeKey === scopeKey &&
            cached.data.state === 'resolved' &&
            cached.data.data &&
            cached.updatedAt > lastAccountInvalidationAt &&
            cached.updatedAt <= now &&
            now - cached.updatedAt < PRELOADED_CACHE_TTL
          ) {
            return {
              ...cached.data,
              accountGeneration: requestGeneration,
              resolvedAt: cached.updatedAt,
              fromFreshCache: true,
            };
          }
        }
        return {
          scopeKey,
          data: await fetchHealthFactor(requestParams, forceNetwork),
          state: 'resolved',
          accountGeneration: requestGeneration,
          resolvedAt: Date.now(),
        };
      } catch (error) {
        const isSuperseded =
          error instanceof OneKeyLocalError &&
          error.message === 'Borrow health factor request superseded';
        if (!isSuperseded) {
          defaultLogger.app.error.log(
            `Borrow health factor request failed: ${String(error)}`,
          );
        }
        const previousData =
          !isSuperseded &&
          lastSuccessfulResultRef.current?.scopeKey === scopeKey &&
          lastSuccessfulResultRef.current.accountGeneration ===
            accountGeneration
            ? lastSuccessfulResultRef.current.data
            : null;
        return {
          scopeKey,
          data: previousData,
          state: isSuperseded ? 'cancelled' : 'error',
          accountGeneration: requestGeneration,
          resolvedAt: Date.now(),
        };
      }
    },
    [currentAccountGeneration, requestParams, scopeKey, swrKey],
    {
      initResult: null,
      watchLoading: true,
      pollingInterval: isPreloading ? undefined : POLLING_INTERVAL,
      revalidateOnFocus: !isPreloading,
      swrKey,
      swrShouldPersist: (result) =>
        result?.state === 'resolved' &&
        !result.fromFreshCache &&
        Boolean(result.data),
      // Fix: Ensure API responses update state even when page loses focus during request
      alwaysSetState: !isPreloading,
    },
  );
  const hasSettledCurrentScope =
    scopedResult?.scopeKey === scopeKey &&
    scopedResult.state !== 'cancelled' &&
    (lastAccountInvalidationAt === 0 ||
      (scopedResult.accountGeneration === currentAccountGeneration &&
        (scopedResult.resolvedAt ?? 0) >= lastAccountInvalidationAt));
  const scopedHealthFactorData = hasSettledCurrentScope
    ? scopedResult.data
    : null;
  const settledAt = scopedResult?.resolvedAt;
  const isReadyForMarketSwitch = isBorrowMetricReadyForMarketSwitch({
    isApplicable: Boolean(requestParams),
    hasSettledCurrentScope: Boolean(hasSettledCurrentScope),
    state: scopedResult?.state,
    hasData: Boolean(scopedHealthFactorData),
    resolvedAt: settledAt,
    now: Date.now(),
  });
  const healthFactorData = isReadyForMarketSwitch
    ? scopedHealthFactorData
    : null;
  const isError =
    Boolean(requestParams) &&
    isReadyForMarketSwitch &&
    (scopedResult?.state === 'error' || !healthFactorData);
  useEffect(() => {
    if (healthFactorData && scopedResult?.state === 'resolved') {
      const cached =
        lastAccountInvalidationAt && swrKey
          ? swrCacheUtils.getWithTimestamp<IScopedHealthFactorResult>(swrKey)
          : undefined;
      if (!cached || cached.updatedAt > lastAccountInvalidationAt) {
        lastSuccessfulResultRef.current = {
          scopeKey,
          data: healthFactorData,
          accountGeneration,
        };
      }
    }
  }, [healthFactorData, scopeKey, scopedResult?.state, swrKey]);

  const refresh = useCallback(
    (...args: Parameters<typeof run>) => {
      forceNetworkRef.current = true;
      try {
        return run(...args);
      } finally {
        forceNetworkRef.current = false;
      }
    },
    [run],
  );

  return {
    healthFactorData,
    isInitialLoading: Boolean(requestParams) && !isReadyForMarketSwitch,
    isLoading,
    isError,
    isReadyForMarketSwitch,
    refresh,
  };
};
