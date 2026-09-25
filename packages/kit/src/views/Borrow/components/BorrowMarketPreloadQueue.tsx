import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';

import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import { useSelectedAccount } from '@onekeyhq/kit/src/states/jotai/contexts/accountSelector';
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import {
  swrCacheUtils,
  swrKeys,
} from '@onekeyhq/shared/src/utils/swrCacheUtils';
import { EBorrowProviderEnum } from '@onekeyhq/shared/types/staking';
import type {
  IBorrowMarketItem,
  IBorrowReserveItem,
} from '@onekeyhq/shared/types/staking';

import { useEarnAccount } from '../../Staking/hooks/useEarnAccount';
import {
  getBorrowEarnAccountForNetwork,
  getBorrowEarnAccountId,
} from '../borrowEarnAccount';
import { buildBorrowMarketKey } from '../borrowMarketKey';
import { useBorrowEModeStatus } from '../hooks/useBorrowEModeStatus';
import { useBorrowHealthFactor } from '../hooks/useBorrowHealthFactor';
import {
  isBorrowReservesCacheReusable,
  isBorrowReservesPayloadUsable,
  useBorrowReserves,
} from '../hooks/useBorrowReserves';
import { useBorrowRewards } from '../hooks/useBorrowRewards';

import {
  createBorrowImagePrewarmSession,
  getBorrowVisibleAssetIconSources,
} from './borrowImagePrewarm';
import {
  BORROW_MARKET_PRELOAD_SUCCESS_TTL,
  type IBorrowMarketPreloadAttempt,
  type IBorrowMarketPreloadPhase,
  getBorrowMarketPreloadCompletionKey,
  getBorrowMarketPreloadNextWakeAt,
  getBorrowMarketPreloadRetryDelay,
  getNextBorrowMarketToPreload,
} from './borrowMarketPreload.utils';

const PRELOAD_START_DELAY = 500;
const PRELOAD_MARKET_GAP = 250;

type IPreloadQueueProps = {
  enabled: boolean;
  canStartNextMarket: boolean;
  markets: IBorrowMarketItem[];
  visibleMarketKey?: string;
  isMarketChangePending?: boolean;
  accountScopeKey: string;
  hasAccountContext: boolean;
};

function MarketPreloadWorker({
  market,
  phase,
  accountId,
  completionKey,
  imageOwnerKey,
  onSettled,
  onReservesReady,
}: {
  market: IBorrowMarketItem;
  phase: IBorrowMarketPreloadPhase;
  accountId?: string;
  completionKey: string;
  imageOwnerKey: string;
  onSettled: (key: string, succeeded: boolean) => void;
  onReservesReady: (
    key: string,
    sources: ReturnType<typeof getBorrowVisibleAssetIconSources>,
  ) => void;
}) {
  const { fetchReserves } = useBorrowReserves();
  const provider = market.provider;
  const networkId = market.networkId;
  const marketAddress = market.marketAddress;
  const scopeKey = `${provider}-${networkId}-${marketAddress}-${
    accountId ?? 'public'
  }`;
  const reservesSWRKey = swrKeys.borrowReserves({
    provider,
    networkId,
    marketAddress,
    accountId,
  });
  const { result: reservesResult, isLoading: reservesLoading } =
    usePromiseResult(
      async (): Promise<
        | { scopeKey: string; data: IBorrowReserveItem; fromCache?: boolean }
        | undefined
      > => {
        try {
          const cached = swrCacheUtils.getWithTimestamp<{
            scopeKey: string;
            data: IBorrowReserveItem;
          }>(reservesSWRKey);
          if (
            cached?.data?.scopeKey === scopeKey &&
            isBorrowReservesPayloadUsable(cached.data?.data) &&
            isBorrowReservesCacheReusable(cached.updatedAt) &&
            cached.updatedAt <= Date.now() &&
            Date.now() - cached.updatedAt < BORROW_MARKET_PRELOAD_SUCCESS_TTL
          ) {
            return { ...cached.data, fromCache: true };
          }
          const data = await fetchReserves({
            provider,
            networkId,
            marketAddress,
            accountId,
          });
          return { scopeKey, data };
        } catch {
          // A failed background market must not block the rest of the queue.
          return undefined;
        }
      },
      [
        accountId,
        fetchReserves,
        marketAddress,
        networkId,
        provider,
        reservesSWRKey,
        scopeKey,
      ],
      {
        swrKey: reservesSWRKey,
        swrShouldPersist: (result) =>
          !result?.fromCache && isBorrowReservesPayloadUsable(result?.data),
        watchLoading: true,
        undefinedResultIfReRun: false,
      },
    );

  useEffect(() => {
    if (
      reservesResult?.scopeKey !== scopeKey ||
      !isBorrowReservesPayloadUsable(reservesResult.data)
    ) {
      return;
    }
    const imageSources = [
      ...getBorrowVisibleAssetIconSources({
        reserves: reservesResult.data,
        market,
      }),
      ...getBorrowVisibleAssetIconSources({
        reserves: reservesResult.data,
        market,
        section: 'borrow',
      }),
    ];
    onReservesReady(imageOwnerKey, [
      ...new Map(
        imageSources.map((source) => [
          `${source.resizeWidth}:${source.uri}`,
          source,
        ]),
      ).values(),
    ]);
  }, [imageOwnerKey, market, onReservesReady, reservesResult, scopeKey]);

  const reservesSucceeded =
    reservesResult?.scopeKey === scopeKey &&
    isBorrowReservesPayloadUsable(reservesResult.data);
  const hasReportedReservesRef = useRef(false);
  useEffect(() => {
    if (
      !hasReportedReservesRef.current &&
      reservesLoading === false &&
      (phase === 'reserves' || !reservesSucceeded || !accountId)
    ) {
      hasReportedReservesRef.current = true;
      onSettled(completionKey, reservesSucceeded);
    }
  }, [
    accountId,
    completionKey,
    onSettled,
    phase,
    reservesLoading,
    reservesSucceeded,
  ]);

  // Only mount metric hooks in the second pass. A cold market's reserves
  // request should not initialize three extra hooks on the UI thread.
  if (
    phase !== 'metrics' ||
    !accountId ||
    reservesLoading !== false ||
    !reservesSucceeded
  ) {
    return null;
  }
  return (
    // eslint-disable-next-line @typescript-eslint/no-use-before-define
    <MarketMetricsPreloadWorker
      market={market}
      accountId={accountId}
      completionKey={completionKey}
      onSettled={onSettled}
    />
  );
}

function MarketMetricsPreloadWorker({
  market,
  accountId,
  completionKey,
  onSettled,
}: {
  market: IBorrowMarketItem;
  accountId: string;
  completionKey: string;
  onSettled: (key: string, succeeded: boolean) => void;
}) {
  const { networkId, provider, marketAddress } = market;
  const {
    isLoading: healthLoading,
    isInitialLoading: healthInitialLoading,
    isError: healthError,
  } = useBorrowHealthFactor({
    networkId,
    provider,
    marketAddress,
    accountId,
    enabled: true,
    isPreloading: true,
  });
  const {
    isLoading: rewardsLoading,
    isInitialLoading: rewardsInitialLoading,
    isError: rewardsError,
  } = useBorrowRewards({
    networkId,
    provider,
    marketAddress,
    accountId,
    enabled: true,
    isPreloading: true,
  });
  const {
    isLoading: eModeLoading,
    isInitialLoading: eModeInitialLoading,
    isError: eModeError,
  } = useBorrowEModeStatus({
    networkId,
    provider,
    marketAddress,
    accountId,
    enabled: true,
    isPreloading: true,
    revalidateOnFocus: false,
  });
  const hasReportedRef = useRef(false);
  const metricsSettled =
    !healthInitialLoading &&
    healthLoading === false &&
    !rewardsInitialLoading &&
    rewardsLoading === false &&
    (provider.toLowerCase() !== EBorrowProviderEnum.Aave ||
      (!eModeInitialLoading && eModeLoading === false));
  const metricsSucceeded =
    !healthError &&
    !rewardsError &&
    (provider.toLowerCase() !== EBorrowProviderEnum.Aave || !eModeError);

  useEffect(() => {
    if (!hasReportedRef.current && metricsSettled) {
      hasReportedRef.current = true;
      onSettled(completionKey, metricsSucceeded);
    }
  }, [completionKey, metricsSettled, metricsSucceeded, onSettled]);

  return null;
}

/**
 * Preload one non-visible market at a time after the current page settles.
 * Fill every market's reserves cache before fetching its smaller metrics.
 * Existing data hooks remain the only writers of their SWR entries; this queue
 * never publishes background results to the visible Borrow context.
 */
export function BorrowMarketPreloadQueue({
  enabled,
  canStartNextMarket,
  markets,
  visibleMarketKey,
  isMarketChangePending = false,
  accountScopeKey,
  hasAccountContext,
}: IPreloadQueueProps) {
  const { selectedAccount } = useSelectedAccount({ num: 0 });
  const selectedAccountKey = JSON.stringify([
    selectedAccount.othersWalletAccountId,
    selectedAccount.indexedAccountId,
    selectedAccount.deriveType,
  ]);
  const [deriveRevision, setDeriveRevision] = useState(0);
  const sessionScopeKey = `${accountScopeKey}:${selectedAccountKey}:${deriveRevision}`;
  const [attempts, setAttempts] = useState(
    () => new Map<string, IBorrowMarketPreloadAttempt>(),
  );
  const [activePreload, setActivePreload] = useState<{
    market: IBorrowMarketItem;
    phase: IBorrowMarketPreloadPhase;
    completionKey: string;
    sessionScopeKey: string;
  } | null>(null);
  const [mayStart, setMayStart] = useState(false);
  const [queueRevision, setQueueRevision] = useState(0);
  const [isCoolingDown, setIsCoolingDown] = useState(false);
  const cooldownTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const activeCompletionKeyRef = useRef<string | undefined>(undefined);
  const imageSourcesScopeKeyRef = useRef<string | undefined>(undefined);
  const imageSourcesByMarketRef = useRef(
    new Map<string, ReturnType<typeof getBorrowVisibleAssetIconSources>>(),
  );
  const accountScopeByMarketRef = useRef(
    new Map<string, { accountId?: string; accountAddress?: string }>(),
  );
  const imagePrewarmSessionRef = useRef<
    ReturnType<typeof createBorrowImagePrewarmSession> | undefined
  >(undefined);

  useLayoutEffect(() => {
    if (imageSourcesScopeKeyRef.current !== sessionScopeKey) {
      imageSourcesScopeKeyRef.current = sessionScopeKey;
      imageSourcesByMarketRef.current.clear();
      accountScopeByMarketRef.current.clear();
    }
    if (!enabled) {
      return undefined;
    }
    const session = createBorrowImagePrewarmSession(sessionScopeKey);
    imagePrewarmSessionRef.current = session;
    imageSourcesByMarketRef.current.forEach((sources, key) => {
      session.enqueue(key, sources);
    });
    return () => {
      session.cancel();
      if (imagePrewarmSessionRef.current === session) {
        imagePrewarmSessionRef.current = undefined;
      }
    };
  }, [enabled, sessionScopeKey]);

  const prewarmMarketImages = useCallback(
    (
      key: string,
      sources: ReturnType<typeof getBorrowVisibleAssetIconSources>,
    ) => {
      const session = imagePrewarmSessionRef.current;
      if (session?.scopeKey === sessionScopeKey) {
        imageSourcesByMarketRef.current.set(key, sources);
        session.enqueue(key, sources);
      }
    },
    [sessionScopeKey],
  );

  useEffect(() => {
    // Account data can change without changing the selected account IDs.
    // Drop the derived account and image ownership of the old preload session.
    const restartForAccountChange = () =>
      setDeriveRevision((value) => value + 1);
    appEventBus.on(EAppEventBusNames.WalletClear, restartForAccountChange);
    appEventBus.on(EAppEventBusNames.AccountRemove, restartForAccountChange);
    appEventBus.on(EAppEventBusNames.AccountUpdate, restartForAccountChange);
    appEventBus.on(
      EAppEventBusNames.AccountSelectorSelectedAccountUpdate,
      restartForAccountChange,
    );
    appEventBus.on(
      EAppEventBusNames.GlobalDeriveTypeUpdate,
      restartForAccountChange,
    );
    appEventBus.on(
      EAppEventBusNames.NetworkDeriveTypeChanged,
      restartForAccountChange,
    );
    return () => {
      appEventBus.off(EAppEventBusNames.WalletClear, restartForAccountChange);
      appEventBus.off(EAppEventBusNames.AccountRemove, restartForAccountChange);
      appEventBus.off(EAppEventBusNames.AccountUpdate, restartForAccountChange);
      appEventBus.off(
        EAppEventBusNames.AccountSelectorSelectedAccountUpdate,
        restartForAccountChange,
      );
      appEventBus.off(
        EAppEventBusNames.GlobalDeriveTypeUpdate,
        restartForAccountChange,
      );
      appEventBus.off(
        EAppEventBusNames.NetworkDeriveTypeChanged,
        restartForAccountChange,
      );
    };
  }, []);

  useEffect(() => {
    setMayStart(false);
    if (!enabled || !canStartNextMarket) {
      return undefined;
    }
    const timer = setTimeout(() => setMayStart(true), PRELOAD_START_DELAY);
    return () => clearTimeout(timer);
  }, [canStartNextMarket, enabled, sessionScopeKey]);
  useEffect(() => {
    setAttempts(new Map());
  }, [sessionScopeKey]);
  useEffect(
    () => () => {
      if (cooldownTimerRef.current) {
        clearTimeout(cooldownTimerRef.current);
      }
    },
    [],
  );

  const activeMarketKey = activePreload
    ? buildBorrowMarketKey(activePreload.market)
    : undefined;
  const activeMarketIsAvailable = Boolean(
    activeMarketKey &&
    markets.some((item) => buildBorrowMarketKey(item) === activeMarketKey),
  );
  const currentPreload =
    enabled &&
    !isMarketChangePending &&
    activePreload?.sessionScopeKey === sessionScopeKey &&
    activeMarketKey !== visibleMarketKey &&
    activeMarketIsAvailable
      ? activePreload
      : null;
  activeCompletionKeyRef.current = currentPreload?.completionKey;

  useEffect(() => {
    if (activePreload && !currentPreload) {
      setActivePreload(null);
    }
  }, [activePreload, currentPreload]);

  useEffect(() => {
    if (
      !enabled ||
      isMarketChangePending ||
      !canStartNextMarket ||
      !mayStart ||
      isCoolingDown ||
      activePreload
    ) {
      return undefined;
    }
    const now = Date.now();
    const market = getNextBorrowMarketToPreload({
      markets,
      visibleMarketKey,
      attempts,
      sessionScopeKey,
      hasAccountContext,
      now,
    });
    if (market) {
      setActivePreload({
        ...market,
        completionKey: getBorrowMarketPreloadCompletionKey({
          sessionScopeKey,
          market: market.market,
          phase: market.phase,
        }),
        sessionScopeKey,
      });
      return undefined;
    }
    const nextWakeAt = getBorrowMarketPreloadNextWakeAt({
      markets,
      visibleMarketKey,
      attempts,
      sessionScopeKey,
      hasAccountContext,
      now,
    });
    if (nextWakeAt === undefined) {
      return undefined;
    }
    const timer = setTimeout(
      () => setQueueRevision((revision) => revision + 1),
      Math.max(0, nextWakeAt - now),
    );
    return () => clearTimeout(timer);
  }, [
    activePreload,
    attempts,
    canStartNextMarket,
    enabled,
    hasAccountContext,
    isMarketChangePending,
    isCoolingDown,
    mayStart,
    markets,
    queueRevision,
    sessionScopeKey,
    visibleMarketKey,
  ]);

  const marketToPreload = currentPreload?.market;
  const preloadPhase = currentPreload?.phase;
  const imageOwnerKey = currentPreload
    ? getBorrowMarketPreloadCompletionKey({
        sessionScopeKey,
        market: currentPreload.market,
        phase: 'reserves',
      })
    : undefined;
  const accountFromReservesPass =
    preloadPhase === 'metrics' && imageOwnerKey
      ? accountScopeByMarketRef.current.get(imageOwnerKey)
      : undefined;
  const networkId = marketToPreload?.networkId;
  const accountLookupNetworkId =
    hasAccountContext && !accountFromReservesPass ? networkId : undefined;
  const accountLookupKey = accountLookupNetworkId
    ? `${sessionScopeKey}:${accountLookupNetworkId}`
    : undefined;
  const [startedAccountLookupKey, setStartedAccountLookupKey] = useState<
    string | undefined
  >();
  useEffect(() => {
    setStartedAccountLookupKey(accountLookupKey);
  }, [accountLookupKey]);
  const { earnAccount, isLoading: earnAccountLoading } = useEarnAccount({
    networkId: accountLookupNetworkId,
  });
  const scopedEarnAccount = getBorrowEarnAccountForNetwork(
    earnAccount,
    accountLookupNetworkId,
  );
  useLayoutEffect(() => {
    if (
      preloadPhase === 'reserves' &&
      imageOwnerKey &&
      hasAccountContext &&
      startedAccountLookupKey === accountLookupKey &&
      earnAccountLoading === false &&
      scopedEarnAccount !== undefined
    ) {
      accountScopeByMarketRef.current.set(imageOwnerKey, {
        accountId: getBorrowEarnAccountId(scopedEarnAccount),
        accountAddress: scopedEarnAccount?.accountAddress,
      });
    }
  }, [
    accountLookupKey,
    earnAccountLoading,
    hasAccountContext,
    imageOwnerKey,
    preloadPhase,
    scopedEarnAccount,
    startedAccountLookupKey,
  ]);
  const accountId =
    accountFromReservesPass?.accountId ??
    getBorrowEarnAccountId(scopedEarnAccount);
  const accountAddress =
    accountFromReservesPass?.accountAddress ??
    scopedEarnAccount?.accountAddress;
  const completionKey = currentPreload?.completionKey;
  const settleMarket = useCallback((key: string, succeeded: boolean) => {
    if (activeCompletionKeyRef.current !== key) {
      return;
    }
    setActivePreload(null);
    setAttempts((previous) => {
      const next = new Map(previous);
      const failedAttempts = succeeded
        ? 0
        : (previous.get(key)?.failedAttempts ?? 0) + 1;
      next.set(key, {
        failedAttempts,
        nextEligibleAt:
          Date.now() +
          (succeeded
            ? BORROW_MARKET_PRELOAD_SUCCESS_TTL
            : getBorrowMarketPreloadRetryDelay(failedAttempts)),
      });
      return next;
    });
    setIsCoolingDown(true);
    if (cooldownTimerRef.current) {
      clearTimeout(cooldownTimerRef.current);
    }
    cooldownTimerRef.current = setTimeout(() => {
      cooldownTimerRef.current = null;
      setIsCoolingDown(false);
    }, PRELOAD_MARKET_GAP);
  }, []);

  useEffect(() => {
    if (
      completionKey &&
      hasAccountContext &&
      !accountFromReservesPass &&
      startedAccountLookupKey === accountLookupKey &&
      earnAccountLoading === false &&
      scopedEarnAccount === undefined
    ) {
      settleMarket(completionKey, false);
    }
  }, [
    settleMarket,
    completionKey,
    accountLookupKey,
    accountFromReservesPass,
    earnAccountLoading,
    hasAccountContext,
    scopedEarnAccount,
    startedAccountLookupKey,
  ]);

  if (
    !marketToPreload ||
    !completionKey ||
    !imageOwnerKey ||
    (hasAccountContext &&
      !accountFromReservesPass &&
      (startedAccountLookupKey !== accountLookupKey ||
        earnAccountLoading !== false ||
        scopedEarnAccount === undefined))
  ) {
    return null;
  }

  return (
    <MarketPreloadWorker
      key={`${completionKey}:${accountId ?? 'public'}:${accountAddress ?? ''}`}
      market={marketToPreload}
      phase={preloadPhase ?? 'reserves'}
      accountId={accountId}
      completionKey={completionKey}
      imageOwnerKey={imageOwnerKey}
      onSettled={settleMarket}
      onReservesReady={prewarmMarketImages}
    />
  );
}
