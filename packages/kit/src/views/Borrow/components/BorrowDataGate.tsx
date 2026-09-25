import type { ReactNode } from 'react';
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import { useIsFocused } from '@react-navigation/core';
import { isEmpty } from 'lodash';

import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import { useRouteIsFocused } from '@onekeyhq/kit/src/hooks/useRouteIsFocused';
import { useActiveAccount } from '@onekeyhq/kit/src/states/jotai/contexts/accountSelector';
import {
  swrCacheUtils,
  swrKeys,
} from '@onekeyhq/shared/src/utils/swrCacheUtils';
import type { IBorrowReserveItem } from '@onekeyhq/shared/types/staking';

import { useEarnAccount } from '../../Staking/hooks/useEarnAccount';
import {
  EBorrowDataStatus,
  deriveBorrowDataStatus,
  isBorrowReservesPending,
} from '../borrowDataStatus';
import {
  getBorrowEarnAccountForNetwork,
  getBorrowEarnAccountId,
} from '../borrowEarnAccount';
import {
  buildBorrowMarketKey,
  useBorrowContext,
  useBorrowMarketRequestContext,
} from '../BorrowProvider';
import { useBorrowEModeStatus } from '../hooks/useBorrowEModeStatus';
import { useBorrowHealthFactor } from '../hooks/useBorrowHealthFactor';
import { useBorrowMarkets } from '../hooks/useBorrowMarkets';
import {
  getBorrowReservesCacheUpdatedAt,
  isBorrowReservesCacheReusable,
  isBorrowReservesPayloadUsable,
  isBorrowReservesRequestSuperseded,
  useBorrowReserves,
} from '../hooks/useBorrowReserves';
import { useBorrowRewards } from '../hooks/useBorrowRewards';

import {
  BORROW_MARKET_SKELETON_DELAY,
  BORROW_MARKET_SKELETON_MIN_DURATION,
  getBorrowReservesDataToPublish,
  getBorrowStatusWhileTargetMetricsLoad,
  getOwnedBorrowReservesResult,
  isBorrowEarnAccountLoading,
  isBorrowSnapshotReusable,
  isCurrentBorrowReservesRequest,
  isPreviousBorrowReservesSnapshotAvailable,
  shouldHoldBorrowMarketSkeleton,
  shouldPublishBorrowMarketChange,
  shouldRefreshBorrowDataOnActivation,
} from './borrowDataGate.utils';
import {
  getBorrowMarketIconSources,
  getBorrowVisibleAssetIconSources,
  prewarmBorrowImagesAndWait,
} from './borrowImagePrewarm';
import { BorrowMarketPreloadQueue } from './BorrowMarketPreloadQueue';

const BORROW_POLLING_INTERVAL = 1 * 60 * 1000; // 1 minute
const BORROW_STALE_TTL = BORROW_POLLING_INTERVAL;
// A cache hit normally settles in the same frame. On a weak network, do not
// hold the old market forever for a broken image CDN; the delayed skeleton
// will already be visible by this point and native fallback can take over.
const BORROW_MARKET_IMAGE_PRELOAD_MAX_WAIT = 800;

type IScopedBorrowReservesResult = {
  scopeKey: string;
  data: IBorrowReserveItem;
  fromCache?: boolean;
};

export const BorrowDataGate = ({
  children,
  isActive = true,
  onBorrowNetworksChange,
}: {
  children: ReactNode;
  isActive?: boolean;
  onBorrowNetworksChange?: (networkIds: string[]) => void;
}) => {
  const isFocused = useIsFocused();
  const isViewActive = isFocused && isActive;
  const isViewActiveRef = useRef(isViewActive);
  const {
    markets,
    isLoading: marketsLoading,
    refetchMarkets,
  } = useBorrowMarkets({ isActive: isViewActive });
  const availableMarkets = useMemo(() => markets ?? [], [markets]);
  const borrowNetworkIds = useMemo(() => {
    const ids = availableMarkets.map((item) => item.networkId);
    return [
      ...new Set(
        ids.filter((networkId): networkId is string => Boolean(networkId)),
      ),
    ];
  }, [availableMarkets]);
  useEffect(() => {
    onBorrowNetworksChange?.(borrowNetworkIds);
  }, [borrowNetworkIds, onBorrowNetworksChange, isViewActive]);

  const {
    market,
    rememberedMarketKey,
    setMarkets,
    setMarket,
    setReserves,
    setEarnAccount,
    setBorrowDataStatus,
  } = useBorrowContext();
  const { requestedMarket, setRequestedMarket } =
    useBorrowMarketRequestContext();
  const requestedMarketKey = requestedMarket
    ? buildBorrowMarketKey(requestedMarket)
    : undefined;
  const requestedMarketToLoad = useMemo(
    () =>
      requestedMarketKey
        ? availableMarkets.find(
            (item) => buildBorrowMarketKey(item) === requestedMarketKey,
          )
        : undefined,
    [availableMarkets, requestedMarketKey],
  );

  useLayoutEffect(() => {
    if (requestedMarket && !requestedMarketToLoad) {
      setRequestedMarket(null);
    }
  }, [requestedMarket, requestedMarketToLoad, setRequestedMarket]);

  useLayoutEffect(() => {
    setMarkets(availableMarkets);
  }, [availableMarkets, setMarkets]);

  useLayoutEffect(() => {
    setMarket((currentMarket) => {
      // A user-initiated switch owns the next market. Market-list refreshes
      // may update or remove entries while its reserves request is in flight;
      // keep the visible snapshot stable until that request settles or is
      // cancelled by the availability check above.
      if (requestedMarket) {
        return currentMarket;
      }
      if (!availableMarkets.length) {
        return currentMarket ? null : currentMarket;
      }

      const currentMarketKey = buildBorrowMarketKey(currentMarket ?? undefined);
      const refreshedCurrentMarket = availableMarkets.find(
        (item) => buildBorrowMarketKey(item) === currentMarketKey,
      );
      if (refreshedCurrentMarket) {
        return refreshedCurrentMarket;
      }
      // Land on the remembered market directly rather than let the restore
      // correct it afterwards: that correction costs a discarded reserves
      // request and a frame showing the wrong market. Only when nothing is
      // selected yet — a refresh that drops the current market still falls
      // back, and the user's own pick is never overridden.
      if (!currentMarket && rememberedMarketKey) {
        const rememberedMarket = availableMarkets.find(
          (item) => buildBorrowMarketKey(item) === rememberedMarketKey,
        );
        if (rememberedMarket) {
          return rememberedMarket;
        }
      }

      return availableMarkets[0];
    });
  }, [availableMarkets, rememberedMarketKey, requestedMarket, setMarket]);

  const { activeAccount } = useActiveAccount({ num: 0 });
  const marketToLoad = requestedMarketToLoad ?? market;
  const visibleMarketKey = market ? buildBorrowMarketKey(market) : undefined;
  const isMarketChangePending = Boolean(
    requestedMarketKey && requestedMarketKey !== visibleMarketKey,
  );
  const pendingMarketKeyRef = useRef<string | undefined>(undefined);
  pendingMarketKeyRef.current = isMarketChangePending
    ? requestedMarketKey
    : undefined;
  const [delayedSkeleton, setDelayedSkeleton] = useState<{
    marketKey: string;
    startedAt: number;
  } | null>(null);
  const [targetImagesSettled, setTargetImagesSettled] = useState<{
    marketKey: string;
    settled: boolean;
  } | null>(null);
  useEffect(() => {
    if (!isViewActive || !isMarketChangePending || !requestedMarketKey) {
      return undefined;
    }
    const timer = setTimeout(() => {
      if (pendingMarketKeyRef.current === requestedMarketKey) {
        setDelayedSkeleton({
          marketKey: requestedMarketKey,
          startedAt: Date.now(),
        });
      }
    }, BORROW_MARKET_SKELETON_DELAY);
    return () => clearTimeout(timer);
  }, [isMarketChangePending, isViewActive, requestedMarketKey]);
  // Fetch the requested scope without publishing its partial states. Keep the
  // previous market visible but block its actions until the target can replace
  // market identity and reserves in one provider update.
  const {
    earnAccount: earnAccountData,
    refreshAccount,
    isLoading: earnAccountLoading,
    isError: earnAccountError,
  } = useEarnAccount({
    networkId: marketToLoad?.networkId,
  });
  const refreshEarnAccount = useCallback(async () => {
    await refreshAccount();
  }, [refreshAccount]);

  const { fetchReserves, accountRevision } = useBorrowReserves();
  const accountRevisionRef = useRef(accountRevision);
  accountRevisionRef.current = accountRevision;
  const lastFetchKeyRef = useRef<string | null>(null);
  const prevFetchKeyRef = useRef<string | null>(null);
  const lastReservesUpdatedAtRef = useRef<number | null>(null);
  const reservesResultRef = useRef<IBorrowReserveItem | undefined>(undefined);
  const reservesRequestIdRef = useRef(0);
  const forceRefreshCounterRef = useRef(0);
  const lastForceRefreshCounterRef = useRef(0);
  const wasActiveRef = useRef(isViewActive);
  const prevReservesDataRef = useRef<IBorrowReserveItem | null>(null);
  const [reservesErrorOwner, setReservesErrorOwner] = useState<{
    key: string;
    accountRevision: number;
  } | null>(null);

  const marketProvider = marketToLoad?.provider;
  const marketNetworkId = marketToLoad?.networkId;
  const marketAddress = marketToLoad?.marketAddress;
  const currentMarketKey = marketToLoad
    ? buildBorrowMarketKey(marketToLoad)
    : undefined;
  const scopedEarnAccountData = getBorrowEarnAccountForNetwork(
    earnAccountData,
    marketNetworkId,
  );
  const accountId = getBorrowEarnAccountId(scopedEarnAccountData);
  const shouldLoadTargetMetrics = Boolean(
    isViewActive &&
    accountId &&
    currentMarketKey &&
    (isMarketChangePending || delayedSkeleton?.marketKey === currentMarketKey),
  );
  const targetMetricParams = {
    networkId: marketNetworkId,
    provider: marketProvider,
    marketAddress,
    accountId,
    enabled: shouldLoadTargetMetrics,
    isPreloading: true,
  };
  const { isReadyForMarketSwitch: isHealthReady } =
    useBorrowHealthFactor(targetMetricParams);
  const { isReadyForMarketSwitch: isRewardsReady } =
    useBorrowRewards(targetMetricParams);
  const { isReadyForMarketSwitch: isEModeReady } = useBorrowEModeStatus({
    ...targetMetricParams,
    revalidateOnFocus: false,
  });
  const areTargetMetricsPending =
    shouldLoadTargetMetrics &&
    (!isHealthReady || !isRewardsReady || !isEModeReady);
  const activeAccountId = activeAccount.account?.id;
  const activeIndexedAccountId = activeAccount.indexedAccount?.id;
  const hasAccountContext = Boolean(activeAccountId || activeIndexedAccountId);
  const hasAccountLookupError = Boolean(
    hasAccountContext && marketNetworkId && earnAccountError,
  );
  const isEarnAccountLoading =
    isBorrowEarnAccountLoading({
      isLoading: earnAccountLoading,
      hasAccountContext,
      hasMarketNetwork: Boolean(marketNetworkId),
      isAccountUnresolved: scopedEarnAccountData === undefined,
    }) && !hasAccountLookupError;
  const shouldWaitForAccount =
    !activeAccount.ready ||
    (hasAccountContext && scopedEarnAccountData === undefined);
  const fetchKey = useMemo(
    () =>
      !shouldWaitForAccount && !isEmpty(marketToLoad)
        ? `${marketProvider}-${marketNetworkId}-${marketAddress}-${
            accountId ?? 'public'
          }`
        : null,
    [
      accountId,
      marketToLoad,
      marketAddress,
      marketNetworkId,
      marketProvider,
      shouldWaitForAccount,
    ],
  );
  const reservesSWRKey = useMemo(
    () =>
      fetchKey && marketProvider && marketNetworkId && marketAddress
        ? swrKeys.borrowReserves({
            provider: marketProvider,
            networkId: marketNetworkId,
            marketAddress,
            accountId,
          })
        : undefined,
    [accountId, fetchKey, marketAddress, marketNetworkId, marketProvider],
  );
  const cachedReservesEntry = reservesSWRKey
    ? swrCacheUtils.getWithTimestamp<IScopedBorrowReservesResult>(
        reservesSWRKey,
      )
    : undefined;
  // Invalidate before usePromiseResult reruns for the new key; a later effect
  // can let that rerun reuse only a cache entry for the exact same scope.
  if (prevFetchKeyRef.current !== fetchKey) {
    prevFetchKeyRef.current = fetchKey;
    reservesRequestIdRef.current += 1;
    const cachedScopeData =
      cachedReservesEntry?.data?.scopeKey === fetchKey &&
      isBorrowReservesPayloadUsable(cachedReservesEntry.data?.data) &&
      isBorrowReservesCacheReusable(cachedReservesEntry.updatedAt)
        ? cachedReservesEntry.data.data
        : undefined;
    // A stale SWR snapshot still belongs to this account and market. Keep it
    // available for stale-while-revalidate display; the age check below still
    // forces a network request when it is outside the refresh TTL.
    lastReservesUpdatedAtRef.current = cachedScopeData
      ? (cachedReservesEntry?.updatedAt ?? null)
      : null;
    reservesResultRef.current = cachedScopeData;
    prevReservesDataRef.current = cachedScopeData ?? null;
  }

  // Mark modal dismiss before usePromiseResult's focus revalidation so the
  // next run bypasses the display TTL without clearing the visible snapshot.
  // Must be declared BEFORE usePromiseResult so the effect fires first.
  const isRouteFocused = useRouteIsFocused();
  const prevRouteFocusedRef = useRef(isRouteFocused);
  useEffect(() => {
    if (isRouteFocused && !prevRouteFocusedRef.current) {
      // Revalidate after dismissing a modal without clearing the snapshot
      // rendered underneath it. The force counter makes the next run bypass
      // the display TTL while the old same-scope data stays visible.
      forceRefreshCounterRef.current += 1;
    }
    prevRouteFocusedRef.current = isRouteFocused;
  }, [isRouteFocused]);

  const {
    result: reservesResult,
    // OK-60105: undefined until usePromiseResult's effect has fired, which left
    // dataStatus falling through to Idle between markets resolving and the
    // reserves request starting. useBorrowMarkets already defaults the same
    // way; the terminal Idle (settled with no result, e.g. after an error) is
    // untouched, so a failed load still reaches the real empty state.
    isLoading: reservesLoading = true,
    run: refreshReserves,
  } = usePromiseResult(
    async (): Promise<IScopedBorrowReservesResult | undefined> => {
      if (
        !fetchKey ||
        !marketProvider ||
        !marketNetworkId ||
        !marketAddress ||
        shouldWaitForAccount
      ) {
        return fetchKey && reservesResultRef.current
          ? {
              scopeKey: fetchKey,
              data: reservesResultRef.current,
              fromCache: true,
            }
          : undefined;
      }
      const shouldForceRefresh =
        forceRefreshCounterRef.current > lastForceRefreshCounterRef.current;
      if (!isViewActiveRef.current && !shouldForceRefresh) {
        return reservesResultRef.current
          ? {
              scopeKey: fetchKey,
              data: reservesResultRef.current,
              fromCache: true,
            }
          : undefined;
      }
      const lastUpdatedAt = lastReservesUpdatedAtRef.current;
      const isStale =
        !lastUpdatedAt ||
        !isBorrowReservesCacheReusable(lastUpdatedAt) ||
        Date.now() - lastUpdatedAt > BORROW_STALE_TTL;
      // Also fetch if we have no cached result (e.g., after fetchKey changed and cache was cleared)
      const hasNoCache = reservesResultRef.current === undefined;
      const shouldFetch = shouldForceRefresh || isStale || hasNoCache;
      if (!shouldFetch) {
        return reservesResultRef.current
          ? {
              scopeKey: fetchKey,
              data: reservesResultRef.current,
              fromCache: true,
            }
          : undefined;
      }
      lastForceRefreshCounterRef.current = forceRefreshCounterRef.current;
      const requestKey = fetchKey;
      const requestId = reservesRequestIdRef.current + 1;
      reservesRequestIdRef.current = requestId;
      setReservesErrorOwner(null);
      const isCurrentRequest = () =>
        accountRevision === accountRevisionRef.current &&
        isCurrentBorrowReservesRequest({
          requestKey,
          currentKey: prevFetchKeyRef.current,
          requestId,
          currentRequestId: reservesRequestIdRef.current,
        });
      try {
        const result = await fetchReserves(
          {
            provider: marketProvider,
            networkId: marketNetworkId,
            marketAddress,
            accountId,
          },
          { forceNew: shouldForceRefresh },
        );
        if (!isCurrentRequest()) {
          return reservesResultRef.current
            ? {
                scopeKey: fetchKey,
                data: reservesResultRef.current,
                fromCache: true,
              }
            : undefined;
        }
        reservesResultRef.current = result;
        lastReservesUpdatedAtRef.current = getBorrowReservesCacheUpdatedAt();
        return { scopeKey: requestKey, data: result };
      } catch (error) {
        if (isBorrowReservesRequestSuperseded(error)) {
          return undefined;
        }
        if (isCurrentRequest()) {
          setReservesErrorOwner({ key: requestKey, accountRevision });
        }
        throw error;
      }
    },
    [
      fetchKey,
      marketProvider,
      marketNetworkId,
      marketAddress,
      accountId,
      shouldWaitForAccount,
      fetchReserves,
      accountRevision,
    ],
    {
      watchLoading: true,
      checkIsFocused: true,
      // The SWR entry is scoped by the complete request identity, so keep it
      // visible while the authoritative refresh runs instead of returning the
      // page to independently loading skeletons.
      undefinedResultIfReRun: false,
      undefinedResultIfError: true,
      pollingInterval: isViewActive ? BORROW_POLLING_INTERVAL : undefined,
      revalidateOnFocus: true,
      alwaysSetState: true,
      swrKey: reservesSWRKey,
      swrShouldPersist: (result) =>
        !result?.fromCache && isBorrowReservesPayloadUsable(result?.data),
    },
  );
  const ownedReservesResultFromHook = getOwnedBorrowReservesResult({
    result: reservesResult?.data,
    resultOwnerKey: reservesResult?.scopeKey ?? null,
    currentKey: fetchKey,
  });
  const ownedReservesResult = isBorrowReservesPayloadUsable(
    ownedReservesResultFromHook,
  )
    ? ownedReservesResultFromHook
    : undefined;
  if (ownedReservesResult !== undefined && fetchKey) {
    reservesResultRef.current = ownedReservesResult;
  }
  const targetImageSources = useMemo(() => {
    if (
      !isMarketChangePending ||
      !requestedMarketKey ||
      !marketToLoad ||
      !ownedReservesResult
    ) {
      return [];
    }
    return [
      ...getBorrowMarketIconSources(marketToLoad, 'md'),
      ...getBorrowVisibleAssetIconSources({
        reserves: ownedReservesResult,
        market: marketToLoad,
      }),
      ...getBorrowVisibleAssetIconSources({
        reserves: ownedReservesResult,
        market: marketToLoad,
        section: 'borrow',
      }),
    ];
  }, [
    isMarketChangePending,
    marketToLoad,
    ownedReservesResult,
    requestedMarketKey,
  ]);
  // Polling may replace the reserves object without changing any visible
  // image URI. Keep the readiness effect keyed by the actual image set so a
  // background refresh cannot restart the foreground preload indefinitely.
  const targetImageSourcesKey = useMemo(
    () =>
      targetImageSources
        .map((source) => `${source.resizeWidth}:${source.uri}`)
        .toSorted()
        .join('|'),
    [targetImageSources],
  );
  const hasTargetMarket = Boolean(marketToLoad);
  const hasTargetImageInputs = Boolean(marketToLoad && ownedReservesResult);
  const targetImageSourcesRef = useRef<{
    key: string;
    sources: typeof targetImageSources;
  }>({ key: '', sources: [] });
  const targetImageGateKey = `${hasTargetImageInputs ? 'ready' : 'missing'}:${targetImageSourcesKey}`;
  if (targetImageSourcesRef.current.key !== targetImageGateKey) {
    targetImageSourcesRef.current = {
      key: targetImageGateKey,
      sources: targetImageSources,
    };
  }
  const hasReusableOwnedReservesResult =
    ownedReservesResult !== undefined &&
    (Boolean(
      lastReservesUpdatedAtRef.current &&
      isBorrowSnapshotReusable({
        updatedAt: lastReservesUpdatedAtRef.current,
        now: Date.now(),
        isAccountCacheReusable: isBorrowReservesCacheReusable(
          lastReservesUpdatedAtRef.current,
        ),
      }),
    ) ||
      Boolean(
        cachedReservesEntry &&
        cachedReservesEntry.data?.scopeKey === fetchKey &&
        isBorrowReservesPayloadUsable(cachedReservesEntry.data?.data) &&
        isBorrowSnapshotReusable({
          updatedAt: cachedReservesEntry.updatedAt,
          now: Date.now(),
          isAccountCacheReusable: isBorrowReservesCacheReusable(
            cachedReservesEntry.updatedAt,
          ),
        }),
      ));
  // Keep the last snapshot for the exact same fetch scope while the page is
  // covered by a modal or revalidating after focus returns. Display age is a
  // refresh policy; it must not turn a still-owned snapshot into an empty
  // page. Account invalidation remains a hard boundary through the cache
  // generation check below.
  const hasPreviousScopedReservesData = Boolean(
    isPreviousBorrowReservesSnapshotAvailable({
      previousData: prevReservesDataRef.current,
      previousFetchKey: lastFetchKeyRef.current,
      currentFetchKey: fetchKey,
      updatedAt: lastReservesUpdatedAtRef.current,
      now: Date.now(),
      isAccountCacheReusable:
        lastReservesUpdatedAtRef.current !== null &&
        isBorrowReservesCacheReusable(lastReservesUpdatedAtRef.current),
    }),
  );
  useEffect(() => {
    if (!isMarketChangePending || !requestedMarketKey || !hasTargetMarket) {
      if (!isMarketChangePending) {
        setTargetImagesSettled(null);
      }
      return undefined;
    }
    if (!hasTargetImageInputs) {
      setTargetImagesSettled({
        marketKey: requestedMarketKey,
        settled: false,
      });
      return undefined;
    }
    let isCurrent = true;
    setTargetImagesSettled((current) =>
      current?.marketKey === requestedMarketKey && !current.settled
        ? current
        : { marketKey: requestedMarketKey, settled: false },
    );
    const imagePreload = prewarmBorrowImagesAndWait(
      targetImageSourcesRef.current.sources,
      { priority: true },
    );
    const settle = () => {
      if (!isCurrent) {
        return;
      }
      setTargetImagesSettled({
        marketKey: requestedMarketKey,
        settled: true,
      });
    };
    const timeout = setTimeout(() => {
      // A failed or very slow image must not make the market selector feel
      // broken. The card stays structurally stable and native fallback takes
      // over after this bounded wait.
      isCurrent = false;
      setTargetImagesSettled({
        marketKey: requestedMarketKey,
        settled: true,
      });
      imagePreload.cancel();
    }, BORROW_MARKET_IMAGE_PRELOAD_MAX_WAIT);
    void imagePreload.promise.then(settle, settle);
    return () => {
      isCurrent = false;
      clearTimeout(timeout);
      imagePreload.cancel();
    };
  }, [
    hasTargetMarket,
    hasTargetImageInputs,
    isMarketChangePending,
    requestedMarketKey,
    targetImageGateKey,
  ]);
  const refreshReservesWithForce = useMemo(() => {
    return async () => {
      if (hasAccountLookupError) {
        await refreshEarnAccount();
        return;
      }
      forceRefreshCounterRef.current += 1;
      await refreshReserves();
    };
  }, [hasAccountLookupError, refreshEarnAccount, refreshReserves]);

  const reservesDataStatus = useMemo(
    () =>
      deriveBorrowDataStatus({
        isViewActive,
        wasViewActive: wasActiveRef.current,
        hasCachedReserves: Boolean(
          isMarketChangePending
            ? hasReusableOwnedReservesResult
            : hasPreviousScopedReservesData || hasReusableOwnedReservesResult,
        ),
        marketsLoading,
        hasMarket: Boolean(marketToLoad),
        hasFetchKey: Boolean(fetchKey),
        hasAccountError: hasAccountLookupError,
        shouldWaitForAccount,
        reservesLoading,
        isCurrentFetchKey:
          lastFetchKeyRef.current === fetchKey ||
          hasReusableOwnedReservesResult,
        hasOwnedReservesResult: hasReusableOwnedReservesResult,
        hasReservesError:
          reservesErrorOwner?.key === fetchKey &&
          reservesErrorOwner.accountRevision === accountRevision,
      }),
    [
      isViewActive,
      marketsLoading,
      marketToLoad,
      fetchKey,
      hasAccountLookupError,
      hasReusableOwnedReservesResult,
      hasPreviousScopedReservesData,
      isMarketChangePending,
      shouldWaitForAccount,
      reservesLoading,
      reservesErrorOwner,
      accountRevision,
    ],
  );
  const areTargetImagesPending =
    isMarketChangePending &&
    (targetImagesSettled?.marketKey !== requestedMarketKey ||
      !targetImagesSettled?.settled);
  const dataStatus = getBorrowStatusWhileTargetMetricsLoad({
    reservesStatus: reservesDataStatus,
    areTargetMetricsPending: areTargetMetricsPending || areTargetImagesPending,
  });
  const isTargetSnapshotReady =
    hasReusableOwnedReservesResult &&
    !areTargetMetricsPending &&
    !areTargetImagesPending;
  const skeletonIsForTarget = Boolean(
    delayedSkeleton && delayedSkeleton.marketKey === currentMarketKey,
  );
  const holdDelayedSkeleton = shouldHoldBorrowMarketSkeleton({
    skeletonMarketKey: delayedSkeleton?.marketKey,
    skeletonStartedAt: delayedSkeleton?.startedAt,
    targetMarketKey: currentMarketKey,
    requestedMarketKey,
    isTargetLoading:
      !isTargetSnapshotReady && dataStatus !== EBorrowDataStatus.Error,
    now: Date.now(),
  });
  const publishedDataStatus = holdDelayedSkeleton
    ? EBorrowDataStatus.LoadingReserves
    : dataStatus;

  useEffect(() => {
    if (delayedSkeleton && !isViewActive) {
      setDelayedSkeleton(null);
      return undefined;
    }
    if (
      delayedSkeleton &&
      !skeletonIsForTarget &&
      delayedSkeleton.marketKey !== requestedMarketKey
    ) {
      setDelayedSkeleton(null);
      return undefined;
    }
    if (
      !delayedSkeleton ||
      !skeletonIsForTarget ||
      (!isTargetSnapshotReady && dataStatus !== EBorrowDataStatus.Error)
    ) {
      return undefined;
    }
    const timer = setTimeout(
      () => {
        setDelayedSkeleton((current) =>
          current === delayedSkeleton ? null : current,
        );
      },
      Math.max(
        0,
        delayedSkeleton.startedAt +
          BORROW_MARKET_SKELETON_MIN_DURATION -
          Date.now(),
      ),
    );
    return () => clearTimeout(timer);
  }, [
    dataStatus,
    delayedSkeleton,
    isTargetSnapshotReady,
    isViewActive,
    requestedMarketKey,
    skeletonIsForTarget,
  ]);

  useEffect(() => {
    isViewActiveRef.current = isViewActive;
    if (
      shouldRefreshBorrowDataOnActivation({
        isViewActive,
        wasViewActive: wasActiveRef.current,
      })
    ) {
      void refetchMarkets();
      void refreshReserves();
    }
    wasActiveRef.current = isViewActive;
  }, [isViewActive, refetchMarkets, refreshReserves]);

  // Sync earnAccount to Context using IAsyncData format
  useEffect(() => {
    if (isMarketChangePending) {
      return;
    }
    setEarnAccount((current) => {
      const data = scopedEarnAccountData ?? null;
      if (
        current.data === data &&
        current.loading === isEarnAccountLoading &&
        current.isError === hasAccountLookupError &&
        current.refresh === refreshEarnAccount &&
        current.ownerMarketKey === currentMarketKey
      ) {
        return current;
      }
      return {
        data,
        loading: isEarnAccountLoading,
        isError: hasAccountLookupError,
        refresh: refreshEarnAccount,
        ownerMarketKey: currentMarketKey,
      };
    });
  }, [
    currentMarketKey,
    hasAccountLookupError,
    isEarnAccountLoading,
    isMarketChangePending,
    refreshEarnAccount,
    scopedEarnAccountData,
    setEarnAccount,
  ]);

  // Sync reserves to Context using IAsyncData format
  useLayoutEffect(() => {
    const isLoading = isBorrowReservesPending(publishedDataStatus);
    const isFetchKeyChanged = lastFetchKeyRef.current !== fetchKey;
    const dataToSet = getBorrowReservesDataToPublish({
      previousData: hasPreviousScopedReservesData
        ? prevReservesDataRef.current
        : null,
      ownedData: holdDelayedSkeleton ? undefined : ownedReservesResult,
      hasReusableOwnedData:
        hasReusableOwnedReservesResult && !holdDelayedSkeleton,
      isFetchKeyChanged,
      dataStatus: publishedDataStatus,
    });
    if (isFetchKeyChanged) {
      lastFetchKeyRef.current = fetchKey;
    }

    // Update the ref for next comparison
    prevReservesDataRef.current = dataToSet;

    if (
      !shouldPublishBorrowMarketChange({
        isMarketChangePending,
        dataStatus: publishedDataStatus,
        hasOwnedReservesResult: hasReusableOwnedReservesResult,
        showDelayedSkeleton: holdDelayedSkeleton,
      })
    ) {
      return;
    }

    setBorrowDataStatus(publishedDataStatus);

    if (isMarketChangePending) {
      pendingMarketKeyRef.current = undefined;
      setEarnAccount((current) => {
        const data = scopedEarnAccountData ?? null;
        if (
          current.data === data &&
          current.loading === isEarnAccountLoading &&
          current.isError === hasAccountLookupError &&
          current.refresh === refreshEarnAccount &&
          current.ownerMarketKey === currentMarketKey
        ) {
          return current;
        }
        return {
          data,
          loading: isEarnAccountLoading,
          isError: hasAccountLookupError,
          refresh: refreshEarnAccount,
          ownerMarketKey: currentMarketKey,
        };
      });
      setMarket(marketToLoad);
      setRequestedMarket(null);
    }

    setReserves((current) => {
      if (
        current.data === dataToSet &&
        current.loading === isLoading &&
        current.refresh === refreshReservesWithForce &&
        current.ownerMarketKey === currentMarketKey
      ) {
        return current;
      }
      return {
        data: dataToSet,
        loading: isLoading,
        refresh: refreshReservesWithForce,
        ownerMarketKey: currentMarketKey,
      };
    });
  }, [
    currentMarketKey,
    fetchKey,
    hasReusableOwnedReservesResult,
    hasAccountLookupError,
    hasPreviousScopedReservesData,
    holdDelayedSkeleton,
    isEarnAccountLoading,
    isMarketChangePending,
    marketToLoad,
    ownedReservesResult,
    publishedDataStatus,
    refreshEarnAccount,
    refreshReservesWithForce,
    scopedEarnAccountData,
    setEarnAccount,
    setMarket,
    setBorrowDataStatus,
    setRequestedMarket,
    setReserves,
  ]);

  return (
    <>
      {children}
      <BorrowMarketPreloadQueue
        enabled={Boolean(isViewActive && activeAccount.ready)}
        isMarketChangePending={isMarketChangePending}
        canStartNextMarket={Boolean(
          !isMarketChangePending &&
          publishedDataStatus === EBorrowDataStatus.Ready,
        )}
        markets={availableMarkets}
        visibleMarketKey={visibleMarketKey}
        accountScopeKey={`${activeAccountId ?? ''}:${
          activeIndexedAccountId ?? ''
        }`}
        hasAccountContext={hasAccountContext}
      />
    </>
  );
};
