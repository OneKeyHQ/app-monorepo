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
import type { IBorrowRewards } from '@onekeyhq/shared/types/staking';

import { isBorrowMetricReadyForMarketSwitch } from './borrowMetricSnapshot.utils';

const PRELOADED_CACHE_TTL = 60_000;

type IRewardsRequest = Parameters<
  typeof backgroundApiProxy.serviceStaking.getBorrowRewards
>[0];

const inFlightRewards = new Map<string, Promise<IBorrowRewards>>();
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
    inFlightRewards.clear();
    lastAccountInvalidationAt = Date.now();
    accountGeneration += 1;
    accountGenerationListeners.forEach((listener) => listener());
  };
  appEventBus.on(EAppEventBusNames.WalletClear, invalidate);
  appEventBus.on(EAppEventBusNames.AccountRemove, invalidate);
  appEventBus.on(EAppEventBusNames.AccountUpdate, invalidate);
  appEventBus.on(EAppEventBusNames.GlobalDeriveTypeUpdate, invalidate);
  appEventBus.on(EAppEventBusNames.NetworkDeriveTypeChanged, invalidate);
  appEventBus.on(
    EAppEventBusNames.AccountSelectorSelectedAccountUpdate,
    invalidate,
  );
}

function subscribeAccountGeneration(listener: () => void) {
  registerAccountInvalidation();
  accountGenerationListeners.add(listener);
  return () => accountGenerationListeners.delete(listener);
}

function getAccountGeneration() {
  return accountGeneration;
}

function fetchRewards(params: IRewardsRequest, forceNew: boolean) {
  registerAccountInvalidation();
  const key = JSON.stringify([
    params.provider,
    params.networkId,
    params.marketAddress,
    params.accountId,
  ]);
  const existing = inFlightRewards.get(key);
  if (existing && !forceNew) {
    return existing;
  }
  const requestGeneration = accountGeneration;
  const request: Promise<IBorrowRewards> = Promise.resolve()
    .then(() => backgroundApiProxy.serviceStaking.getBorrowRewards(params))
    .then((data) => {
      if (
        requestGeneration !== accountGeneration ||
        inFlightRewards.get(key) !== request
      ) {
        throw new OneKeyLocalError('Borrow rewards request superseded');
      }
      return data;
    });
  inFlightRewards.set(key, request);
  const clear = () => {
    if (inFlightRewards.get(key) === request) {
      inFlightRewards.delete(key);
    }
  };
  void request.then(clear, clear);
  return request;
}

type IScopedBorrowRewardsResult = {
  scopeKey: string;
  data: IBorrowRewards | null;
  state: 'resolved' | 'error' | 'cancelled';
  accountGeneration?: number;
  resolvedAt?: number;
  fromFreshCache?: boolean;
};

export const useBorrowRewards = ({
  networkId,
  provider,
  marketAddress,
  accountId,
  enabled = true,
  isPreloading = false,
}: {
  networkId?: string;
  provider?: string;
  marketAddress?: string;
  accountId?: string;
  enabled?: boolean;
  isPreloading?: boolean;
}) => {
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
    ? swrKeys.borrowRewards(requestParams)
    : undefined;
  const lastSuccessfulResultRef = useRef<{
    scopeKey: string;
    data: IBorrowRewards;
    accountGeneration: number;
  } | null>(null);
  const firstRequestScopeRef = useRef<string | null>(null);
  const forceNetworkRef = useRef(false);
  const {
    result: scopedResult,
    run,
    isLoading,
  } = usePromiseResult(
    async (): Promise<IScopedBorrowRewardsResult> => {
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
            swrCacheUtils.getWithTimestamp<IScopedBorrowRewardsResult>(swrKey);
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
          data: await fetchRewards(requestParams, forceNetwork),
          state: 'resolved',
          accountGeneration: requestGeneration,
          resolvedAt: Date.now(),
        };
      } catch (error) {
        const isSuperseded =
          error instanceof OneKeyLocalError &&
          error.message === 'Borrow rewards request superseded';
        if (!isSuperseded) {
          defaultLogger.app.error.log(
            `Borrow rewards request failed: ${String(error)}`,
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
      alwaysSetState: !isPreloading,
      swrKey,
      swrShouldPersist: (result) =>
        result?.state === 'resolved' &&
        !result.fromFreshCache &&
        Boolean(result.data),
    },
  );
  const hasSettledCurrentScope =
    scopedResult?.scopeKey === scopeKey &&
    scopedResult.state !== 'cancelled' &&
    (lastAccountInvalidationAt === 0 ||
      (scopedResult.accountGeneration === currentAccountGeneration &&
        (scopedResult.resolvedAt ?? 0) >= lastAccountInvalidationAt));
  const scopedBorrowRewards = hasSettledCurrentScope ? scopedResult.data : null;
  const settledAt = scopedResult?.resolvedAt;
  const isReadyForMarketSwitch = isBorrowMetricReadyForMarketSwitch({
    isApplicable: Boolean(requestParams),
    hasSettledCurrentScope: Boolean(hasSettledCurrentScope),
    state: scopedResult?.state,
    hasData: Boolean(scopedBorrowRewards),
    resolvedAt: settledAt,
    now: Date.now(),
  });
  const borrowRewards = isReadyForMarketSwitch ? scopedBorrowRewards : null;
  const isError =
    Boolean(requestParams) &&
    isReadyForMarketSwitch &&
    (scopedResult?.state === 'error' || !borrowRewards);
  useEffect(() => {
    if (borrowRewards && scopedResult?.state === 'resolved') {
      const cached =
        lastAccountInvalidationAt && swrKey
          ? swrCacheUtils.getWithTimestamp<IScopedBorrowRewardsResult>(swrKey)
          : undefined;
      if (!cached || cached.updatedAt > lastAccountInvalidationAt) {
        lastSuccessfulResultRef.current = {
          scopeKey,
          data: borrowRewards,
          accountGeneration,
        };
      }
    }
  }, [borrowRewards, scopeKey, scopedResult?.state, swrKey]);

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
    borrowRewards,
    isInitialLoading: Boolean(requestParams) && !isReadyForMarketSwitch,
    isLoading,
    isError,
    isReadyForMarketSwitch,
    refresh,
  };
};
