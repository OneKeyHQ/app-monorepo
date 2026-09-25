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
import {
  swrCacheUtils,
  swrKeys,
} from '@onekeyhq/shared/src/utils/swrCacheUtils';
import { EBorrowProviderEnum } from '@onekeyhq/shared/types/staking';
import type { IBorrowEModeStatus } from '@onekeyhq/shared/types/staking';

import { isBorrowMetricReadyForMarketSwitch } from './borrowMetricSnapshot.utils';

const PRELOADED_CACHE_TTL = 60_000;

type IEModeStatusRequest = Parameters<
  typeof backgroundApiProxy.serviceStaking.getBorrowEModeStatus
>[0];

const inFlightEModeStatuses = new Map<string, Promise<IBorrowEModeStatus>>();
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
    inFlightEModeStatuses.clear();
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

function fetchEModeStatus(params: IEModeStatusRequest, forceNew: boolean) {
  registerAccountInvalidation();
  const key = JSON.stringify([
    params.provider,
    params.networkId,
    params.marketAddress,
    params.accountId,
  ]);
  const existing = inFlightEModeStatuses.get(key);
  if (existing && !forceNew) {
    return existing;
  }
  const requestGeneration = accountGeneration;
  const request: Promise<IBorrowEModeStatus> = Promise.resolve()
    .then(() => backgroundApiProxy.serviceStaking.getBorrowEModeStatus(params))
    .then((data) => {
      if (
        requestGeneration !== accountGeneration ||
        inFlightEModeStatuses.get(key) !== request
      ) {
        throw new OneKeyLocalError('Borrow E-Mode request superseded');
      }
      return data;
    });
  inFlightEModeStatuses.set(key, request);
  const clear = () => {
    if (inFlightEModeStatuses.get(key) === request) {
      inFlightEModeStatuses.delete(key);
    }
  };
  void request.then(clear, clear);
  return request;
}

interface IUseBorrowEModeStatusParams {
  networkId?: string;
  provider?: string;
  marketAddress?: string;
  accountId?: string;
  enabled?: boolean;
  revalidateOnFocus?: boolean;
  isPreloading?: boolean;
}

type IScopedEModeResult = {
  scopeKey: string;
  eModeStatus: IBorrowEModeStatus | null;
  state: 'resolved' | 'error' | 'cancelled';
  accountGeneration?: number;
  resolvedAt?: number;
  fromFreshCache?: boolean;
};

export const useBorrowEModeStatus = ({
  networkId,
  provider,
  marketAddress,
  accountId,
  enabled = true,
  revalidateOnFocus = true,
  isPreloading = false,
}: IUseBorrowEModeStatusParams) => {
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
  const lastSuccessfulStatusRef = useRef<{
    scopeKey: string;
    eModeStatus: IBorrowEModeStatus;
    accountGeneration: number;
  } | null>(null);
  const firstRequestScopeRef = useRef<string | null>(null);
  const forceNetworkRef = useRef(false);
  const requestParams = useMemo(
    () =>
      networkId &&
      provider &&
      marketAddress &&
      accountId &&
      enabled &&
      provider.toLowerCase() === EBorrowProviderEnum.Aave
        ? { networkId, provider, marketAddress, accountId }
        : null,
    [accountId, enabled, marketAddress, networkId, provider],
  );
  const canRequestStatus = Boolean(requestParams);
  const swrKey = requestParams
    ? swrKeys.borrowEModeStatus(requestParams)
    : undefined;
  const {
    result: scopedResult,
    run,
    isLoading,
  } = usePromiseResult(
    async (): Promise<IScopedEModeResult> => {
      // e-mode is an Aave-only feature; never query it for other providers
      // (e.g. Kamino), which the backend rejects with "not implemented".
      if (!requestParams) {
        return { scopeKey, eModeStatus: null, state: 'resolved' };
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
            swrCacheUtils.getWithTimestamp<IScopedEModeResult>(swrKey);
          const now = Date.now();
          if (
            cached?.data.scopeKey === scopeKey &&
            cached.data.state === 'resolved' &&
            cached.data.eModeStatus &&
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
          eModeStatus: await fetchEModeStatus(requestParams, forceNetwork),
          state: 'resolved',
          accountGeneration: requestGeneration,
          resolvedAt: Date.now(),
        };
      } catch (error) {
        const isSuperseded =
          error instanceof OneKeyLocalError &&
          error.message === 'Borrow E-Mode request superseded';
        const previousStatus =
          !isSuperseded &&
          lastSuccessfulStatusRef.current?.scopeKey === scopeKey &&
          lastSuccessfulStatusRef.current.accountGeneration ===
            accountGeneration
            ? lastSuccessfulStatusRef.current.eModeStatus
            : null;
        return {
          scopeKey,
          eModeStatus: previousStatus,
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
      checkIsFocused: true,
      revalidateOnFocus,
      undefinedResultIfError: true,
      swrKey,
      swrShouldPersist: (result) =>
        result?.state === 'resolved' &&
        !result.fromFreshCache &&
        Boolean(result.eModeStatus),
    },
  );

  const hasResolvedCurrentScope =
    scopedResult?.scopeKey === scopeKey &&
    scopedResult.state !== 'cancelled' &&
    (lastAccountInvalidationAt === 0 ||
      (scopedResult.accountGeneration === currentAccountGeneration &&
        (scopedResult.resolvedAt ?? 0) >= lastAccountInvalidationAt));
  const scopedEModeStatus = hasResolvedCurrentScope
    ? scopedResult.eModeStatus
    : null;
  const settledAt = scopedResult?.resolvedAt;
  const isReadyForMarketSwitch = isBorrowMetricReadyForMarketSwitch({
    isApplicable: canRequestStatus,
    hasSettledCurrentScope: Boolean(hasResolvedCurrentScope),
    state: scopedResult?.state,
    hasData: Boolean(scopedEModeStatus),
    resolvedAt: settledAt,
    now: Date.now(),
  });
  const eModeStatus = isReadyForMarketSwitch ? scopedEModeStatus : null;
  // A resolved-but-empty payload leaves consumers with neither a status to
  // render nor an error to recover from, stranding them on their loading branch.
  const isError =
    canRequestStatus &&
    isReadyForMarketSwitch &&
    (scopedResult?.state === 'error' || !eModeStatus);
  useEffect(() => {
    if (eModeStatus && scopedResult?.state === 'resolved') {
      const cached =
        lastAccountInvalidationAt && swrKey
          ? swrCacheUtils.getWithTimestamp<IScopedEModeResult>(swrKey)
          : undefined;
      if (!cached || cached.updatedAt > lastAccountInvalidationAt) {
        lastSuccessfulStatusRef.current = {
          scopeKey,
          eModeStatus,
          accountGeneration,
        };
      }
    }
  }, [eModeStatus, scopeKey, scopedResult?.state, swrKey]);

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
    eModeStatus,
    isInitialLoading: canRequestStatus && !isReadyForMarketSwitch,
    isLoading,
    isError,
    isReadyForMarketSwitch,
    refresh,
  };
};
