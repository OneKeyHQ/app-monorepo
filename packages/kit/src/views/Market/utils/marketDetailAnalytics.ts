import { createContext, createElement, useContext, useMemo } from 'react';
import type { PropsWithChildren } from 'react';

import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import type {
  IDexChartDisplayMode,
  IDexChartMode,
  IDexDetailKind,
  IDexDetailVisitFields,
} from '@onekeyhq/shared/src/logger/scopes/dex';
import { parseTokenDetailPreviewParam } from '@onekeyhq/shared/src/utils/marketTokenPreviewRoute';
import networkUtils from '@onekeyhq/shared/src/utils/networkUtils';

import { resolveMarketMobileDetailKind } from '../MarketDetailV2/utils/marketMobileDetailKind';

export type IMarketDetailAnalyticsAsset = Pick<
  IDexDetailVisitFields,
  'tokenSymbol' | 'network' | 'marketAssetId'
> & { detailKind: IDexDetailKind };

function nonEmptyString(value: unknown): string | undefined {
  return typeof value === 'string' && value ? value : undefined;
}

/**
 * The asset a Market detail route shows, from its params alone. The detail
 * kind comes from the asset (stock route, top coins category), never from
 * `entryCategory`, which is the list the row was pressed in.
 */
export function resolveMarketDetailAnalyticsAsset(
  routeParams: unknown,
  {
    fallbackSymbol,
    isInAppEntry,
  }: {
    fallbackSymbol?: string;
    // Whether our own navigation opened the route (it passes `from`). Only
    // then is the route's contract address trusted as an asset id; external
    // links can carry any address. Defaults to the params' own `from`.
    isInAppEntry?: boolean;
  } = {},
): IMarketDetailAnalyticsAsset {
  const params = (routeParams ?? {}) as {
    stockId?: unknown;
    stockPreviewSymbol?: unknown;
    marketTokenId?: unknown;
    network?: unknown;
    tokenAddress?: unknown;
    marketTokenCategory?: unknown;
    pendingMarketAsset?: { symbol?: unknown };
    legacyTokenPreview?: unknown;
    swapTokenSymbol?: unknown;
    from?: unknown;
  };
  const stockId = nonEmptyString(params.stockId);
  const detailKind: IDexDetailKind = resolveMarketMobileDetailKind({
    isStockToken: Boolean(stockId),
    marketTokenCategory: nonEmptyString(params.marketTokenCategory),
  });
  const routeNetwork = nonEmptyString(params.network);
  const network = routeNetwork
    ? networkUtils.getNetworkIdFromShortCode({ shortCode: routeNetwork }) ||
      routeNetwork
    : undefined;
  const tokenSymbol = stockId
    ? nonEmptyString(params.stockPreviewSymbol)
    : (nonEmptyString(params.pendingMarketAsset?.symbol) ??
      nonEmptyString(
        parseTokenDetailPreviewParam(params.legacyTokenPreview)?.symbol,
      ) ??
      nonEmptyString(params.swapTokenSymbol) ??
      nonEmptyString(fallbackSymbol));
  // Listed assets carry a Market id. Trending tokens have none, so their
  // contract address (unique per `network`) stands in for it, but only for
  // in-app entries.
  const trustsTokenAddress =
    isInAppEntry ?? Boolean(nonEmptyString(params.from));
  const marketAssetId =
    stockId ??
    nonEmptyString(params.marketTokenId) ??
    (trustsTokenAddress ? nonEmptyString(params.tokenAddress) : undefined);
  return {
    detailKind,
    ...(tokenSymbol ? { tokenSymbol } : undefined),
    ...(network ? { network } : undefined),
    ...(marketAssetId ? { marketAssetId } : undefined),
  };
}

/**
 * Keeps the fields an earlier report of the same visit already knew when a
 * later params update (a resolved pending asset) leaves them out.
 */
export function mergeMarketDetailAnalyticsAsset(
  previous: Partial<IMarketDetailAnalyticsAsset>,
  next: IMarketDetailAnalyticsAsset,
): IMarketDetailAnalyticsAsset {
  return {
    ...previous,
    ...(Object.fromEntries(
      Object.entries(next).filter(([, value]) => value !== undefined),
    ) as IMarketDetailAnalyticsAsset),
  };
}

// Monotonic, so wall clock changes never skew a visit.
function monotonicNow() {
  return globalThis.performance?.now?.() ?? Date.now();
}

/**
 * Measures the time a detail visit is active: focused and in the foreground.
 * Inactive stretches (another page on top, app in background, hidden tab)
 * are not counted.
 */
export function createMarketDetailVisitTimer({
  isActive,
  now = monotonicNow,
}: {
  isActive: boolean;
  now?: () => number;
}) {
  let accumulatedMs = 0;
  let activeSince: number | undefined = isActive ? now() : undefined;
  return {
    setActive(nextIsActive: boolean) {
      if (nextIsActive && activeSince === undefined) {
        activeSince = now();
      } else if (!nextIsActive && activeSince !== undefined) {
        accumulatedMs += now() - activeSince;
        activeSince = undefined;
      }
    },
    getDurationMs() {
      const runningMs = activeSince === undefined ? 0 : now() - activeSince;
      return Math.max(0, Math.round(accumulatedMs + runningMs));
    },
  };
}

export type IMarketDetailVisitTimer = ReturnType<
  typeof createMarketDetailVisitTimer
>;

const MarketDetailAnalyticsContext = createContext<
  { detailKind: IDexDetailKind } | undefined
>(undefined);

/**
 * Marks a Market detail page so its chart controls report analytics. Charts
 * rendered without it (Swap's stock panel) stay silent.
 */
export function MarketDetailAnalyticsProvider({
  detailKind,
  children,
}: PropsWithChildren<{ detailKind: IDexDetailKind }>) {
  const value = useMemo(() => ({ detailKind }), [detailKind]);
  return createElement(
    MarketDetailAnalyticsContext.Provider,
    { value },
    children,
  );
}

export function useMarketDetailChartAnalytics() {
  const context = useContext(MarketDetailAnalyticsContext);
  return useMemo(() => {
    if (!context) {
      return undefined;
    }
    const { detailKind } = context;
    return {
      onChartDisplayModeSwitch: (
        fromMode: IDexChartDisplayMode,
        toMode: IDexChartDisplayMode,
      ) => {
        if (fromMode === toMode) return;
        defaultLogger.dex.tradingView.dexChartDisplayModeSwitch({
          fromMode,
          toMode,
          detailKind,
        });
      },
      onSimpleChartRangeSelect: (fromRange: string, toRange: string) => {
        if (fromRange === toRange) return;
        defaultLogger.dex.tradingView.dexSimpleChartRange({
          rangeSelect: toRange,
          detailKind,
        });
      },
      onNativeChartIntervalSelect: (interval: string) => {
        defaultLogger.dex.tradingView.dexNativeChartInterval({
          intervalSelect: interval,
          detailKind,
        });
      },
    };
  }, [context]);
}

export function logMarketDetailChartModeSwitch({
  fromMode,
  detailKind,
}: {
  fromMode: IDexChartMode;
  detailKind: IDexDetailKind;
}) {
  defaultLogger.dex.tradingView.dexChartModeSwitch({
    fromMode,
    toMode: fromMode === 'native' ? 'tradingView' : 'native',
    detailKind,
  });
}
