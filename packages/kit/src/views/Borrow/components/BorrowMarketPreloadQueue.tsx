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
import type {
  IBorrowMarketItem,
  IBorrowReserveItem,
} from '@onekeyhq/shared/types/staking';

import { buildBorrowMarketKey } from '../borrowMarketKey';
import {
  isBorrowReservesCacheReusable,
  isBorrowReservesPayloadUsable,
  useBorrowReserves,
} from '../hooks/useBorrowReserves';

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
};

// Background work is deliberately public-only. Account-scoped metrics belong
// to the foreground market selected by the user.
function MarketPreloadWorker({
  market,
  completionKey,
  imageOwnerKey,
  onSettled,
  onReservesReady,
}: {
  market: IBorrowMarketItem;
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
  const scopeKey = `${provider}-${networkId}-${marketAddress}-public`;
  const reservesSWRKey = swrKeys.borrowReserves({
    provider,
    networkId,
    marketAddress,
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
          });
          return { scopeKey, data };
        } catch {
          // A failed background market must not block the rest of the queue.
          return undefined;
        }
      },
      [
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
    if (!hasReportedReservesRef.current && reservesLoading === false) {
      hasReportedReservesRef.current = true;
      onSettled(completionKey, reservesSucceeded);
    }
  }, [completionKey, onSettled, reservesLoading, reservesSucceeded]);

  return null;
}

/** Preload public reserves and visible asset images for non-selected markets. */
export function BorrowMarketPreloadQueue({
  enabled,
  canStartNextMarket,
  markets,
  visibleMarketKey,
  isMarketChangePending = false,
  accountScopeKey,
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
  const imagePrewarmSessionRef = useRef<
    ReturnType<typeof createBorrowImagePrewarmSession> | undefined
  >(undefined);

  useLayoutEffect(() => {
    if (imageSourcesScopeKeyRef.current !== sessionScopeKey) {
      imageSourcesScopeKeyRef.current = sessionScopeKey;
      imageSourcesByMarketRef.current.clear();
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
    const restartForAccountChange = () =>
      setDeriveRevision((value) => value + 1);
    appEventBus.on(EAppEventBusNames.WalletClear, restartForAccountChange);
    appEventBus.on(EAppEventBusNames.AccountRemove, restartForAccountChange);
    appEventBus.on(EAppEventBusNames.AccountUpdate, restartForAccountChange);
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
    isMarketChangePending,
    isCoolingDown,
    mayStart,
    markets,
    queueRevision,
    sessionScopeKey,
    visibleMarketKey,
  ]);

  const marketToPreload = currentPreload?.market;
  const completionKey = currentPreload?.completionKey;
  const imageOwnerKey = currentPreload
    ? getBorrowMarketPreloadCompletionKey({
        sessionScopeKey,
        market: currentPreload.market,
        phase: 'reserves',
      })
    : undefined;

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

  if (!marketToPreload || !completionKey || !imageOwnerKey) {
    return null;
  }

  return (
    <MarketPreloadWorker
      key={completionKey}
      market={marketToPreload}
      completionKey={completionKey}
      imageOwnerKey={imageOwnerKey}
      onSettled={settleMarket}
      onReservesReady={prewarmMarketImages}
    />
  );
}
