import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import type { PropsWithChildren } from 'react';

import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { useLocaleVariant } from '@onekeyhq/kit/src/hooks/useLocaleVariant';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import {
  swrCacheUtils,
  swrKeys,
} from '@onekeyhq/shared/src/utils/swrCacheUtils';
import {
  equalTokenNoCaseSensitive,
  normalizeTokenContractAddress,
} from '@onekeyhq/shared/src/utils/tokenUtils';
import type {
  IMarketStockDetailPreview,
  IMarketStockPublicDetail,
  IMarketStockTokenVariant,
} from '@onekeyhq/shared/types/marketV2';

import {
  isStockTokenVariantTradable,
  resolveStockTokenVariantSelection,
} from '../utils/stockTokenVariant';

export { isStockTokenVariantTradable } from '../utils/stockTokenVariant';

type IStockDetailContextValue = {
  stockId?: string;
  isStockRoute: boolean;
  stockPreview?: IMarketStockDetailPreview;
  stockDetail?: IMarketStockPublicDetail | null;
  isStockDetailLoading: boolean;
  isStockDetailError: boolean;
  retryStockDetail: () => Promise<void>;
  tokenVariants: IMarketStockTokenVariant[];
  isTokenVariantsLoading: boolean;
  isTokenVariantPending: boolean;
  isTokenVariantsError: boolean;
  retryTokenVariants: () => Promise<void>;
  selectedTokenId?: string;
  selectedTokenVariant?: IMarketStockTokenVariant;
  setSelectedTokenId: (tokenId: string) => void;
  // Network the detail page's account portfolio is fetched for. Consumers need
  // it to tell whether a portfolio entry can legitimately belong to a given
  // variant because `IMarketAccountPortfolioItem` carries no `networkId`.
  portfolioNetworkId?: string;
};

const StockDetailContext = createContext<IStockDetailContextValue>({
  isStockRoute: false,
  isStockDetailLoading: false,
  isStockDetailError: false,
  retryStockDetail: async () => undefined,
  tokenVariants: [],
  isTokenVariantsLoading: false,
  isTokenVariantPending: false,
  isTokenVariantsError: false,
  retryTokenVariants: async () => undefined,
  setSelectedTokenId: () => undefined,
});

// The detail endpoint carries the quote the header renders, so it has to keep
// refreshing while the page stays open. 15s: a stock quote does not need the
// 6s cadence the on-chain token detail polls at.
const STOCK_DETAIL_POLLING_INTERVAL = 15 * 1000;

type IStockDetailRequestResult = {
  stockId?: string;
  data?: IMarketStockPublicDetail | null;
  failed?: boolean;
};

type IStockTokenVariantsRequestResult = {
  stockId?: string;
  items: IMarketStockTokenVariant[];
  defaultTokenId?: string;
  failed?: boolean;
};

// The variant list backs the token selector and the tradable-variant checks,
// so it keeps the 6s cadence the rest of the detail page polls at.
const STOCK_TOKEN_VARIANTS_POLLING_INTERVAL = 6000;

export function StockDetailProvider({
  stockId,
  initialStockPreview,
  initialNetworkId,
  initialTokenAddress,
  preserveInitialToken = false,
  children,
}: PropsWithChildren<{
  stockId?: string;
  initialStockPreview?: IMarketStockDetailPreview;
  initialNetworkId?: string;
  initialTokenAddress?: string;
  // Trading pages must keep showing the actual selected token even when paused.
  preserveInitialToken?: boolean;
}>) {
  const normalizedStockId = stockId?.trim().toUpperCase() || undefined;
  const stockPreview =
    initialStockPreview?.stockId.trim().toUpperCase() === normalizedStockId
      ? initialStockPreview
      : undefined;
  // Stock copy (about, trading-hour reasons) is localized.
  const locale = useLocaleVariant().toLowerCase();
  const stockDetailSwrKey = normalizedStockId
    ? swrKeys.marketStockDetail({ stockId: normalizedStockId, locale })
    : undefined;
  const tokenVariantsSwrKey = normalizedStockId
    ? swrKeys.marketStockTokenVariants({ stockId: normalizedStockId, locale })
    : undefined;
  const tokenRouteKey = JSON.stringify([
    normalizedStockId,
    initialNetworkId,
    initialNetworkId
      ? normalizeTokenContractAddress({
          networkId: initialNetworkId,
          contractAddress: initialTokenAddress,
        })
      : initialTokenAddress,
  ]);
  // Pick the variant from cached variants during the first render, so a
  // revisit knows its token identity before any request settles.
  const [initialSelectedTokenId] = useState(() => {
    if (!tokenVariantsSwrKey) return undefined;
    const cached =
      swrCacheUtils.get<IStockTokenVariantsRequestResult>(tokenVariantsSwrKey);
    if (!cached || cached.failed || cached.stockId !== normalizedStockId) {
      return undefined;
    }
    return resolveStockTokenVariantSelection({
      variants: cached.items,
      defaultTokenId: cached.defaultTokenId,
      routeNetworkId: initialNetworkId,
      routeTokenAddress: initialTokenAddress,
    })?.tokenId;
  });
  const [selectedTokenId, setSelectedTokenId] = useState<string | undefined>(
    initialSelectedTokenId,
  );
  // A cached list is enough to pick a token to render, but not enough to call
  // the route handled: the snapshot can predate the route's variant, and
  // marking it applied here made the effect below skip the fetched list that
  // finally contained it.
  const appliedTokenRouteRef = useRef<string | undefined>(undefined);
  // Set only where a variant list actually came back from the network, which
  // is the one thing that may retire the route.
  const fetchedTokenVariantsStockIdRef = useRef<string | undefined>(undefined);
  // Keep the last successful detail per stock so a superseded response cannot
  // replace the fallback used by the currently selected stock. Seeded from the
  // same cache usePromiseResult replays, so a first fetch that fails on a
  // revisit falls back to what the page is already showing instead of
  // replacing it with an error.
  const [successfulStockDetails] = useState(() => {
    const seeded = new Map<string, IStockDetailRequestResult>();
    const cached = stockDetailSwrKey
      ? swrCacheUtils.get<IStockDetailRequestResult>(stockDetailSwrKey)
      : undefined;
    if (
      normalizedStockId &&
      cached &&
      !cached.failed &&
      cached.data &&
      cached.stockId === normalizedStockId
    ) {
      seeded.set(normalizedStockId, cached);
    }
    return seeded;
  });
  // Same idea for the variant list, kept per stock because a failed fetch here
  // must not drop the token the user already selected.
  const [successfulTokenVariants] = useState(() => {
    const seeded = new Map<string, IStockTokenVariantsRequestResult>();
    const cached = tokenVariantsSwrKey
      ? swrCacheUtils.get<IStockTokenVariantsRequestResult>(tokenVariantsSwrKey)
      : undefined;
    if (
      normalizedStockId &&
      cached &&
      !cached.failed &&
      cached.stockId === normalizedStockId
    ) {
      seeded.set(normalizedStockId, cached);
    }
    return seeded;
  });

  const {
    result: stockDetailResult,
    isLoading: isStockDetailLoading,
    run: retryStockDetail,
  } = usePromiseResult<IStockDetailRequestResult>(
    async () => {
      if (!normalizedStockId) return {};
      try {
        const data =
          await backgroundApiProxy.serviceMarketV2.fetchMarketStockDetail({
            stockId: normalizedStockId,
          });
        if (data === null) {
          return { stockId: normalizedStockId, failed: true };
        }
        const result = { stockId: normalizedStockId, data };
        successfulStockDetails.set(normalizedStockId, result);
        return result;
      } catch (_error) {
        // A polling tick that fails must not turn a loaded page into an error
        // page: keep the last good payload and retry silently on the next
        // tick. Only a stock we never loaded surfaces the retryable error.
        const lastStockDetail = successfulStockDetails.get(normalizedStockId);
        if (lastStockDetail) {
          return lastStockDetail;
        }
        return { stockId: normalizedStockId, failed: true };
      }
    },
    // The map is useState-stable, so naming it here never re-runs the request.
    [normalizedStockId, successfulStockDetails],
    {
      watchLoading: true,
      // `checkIsFocused` stays at the repo default (true). It is what gates the
      // polling loop: usePromiseResult parks the pending tick on its deferred
      // promise while the route is blurred and releases it the moment focus
      // returns. Setting it to false disables that whole effect, which is what
      // kept this 15s quote refresh running for every stock detail page still
      // sitting in the navigation stack.
      //
      // `revalidateOnFocus` is deliberately omitted. With `pollingInterval` set
      // the parked tick already re-fetches immediately on refocus, while the
      // focus-triggered run reuses the current polling nonce — so each
      // blur/focus cycle would leave one more polling chain alive.
      pollingInterval: normalizedStockId
        ? STOCK_DETAIL_POLLING_INTERVAL
        : undefined,
      revalidateOnReconnect: true,
      swrKey: stockDetailSwrKey,
      swrShouldPersist: (r) => !r.failed && Boolean(r.data),
    },
  );

  const {
    result: tokenVariantResult,
    isLoading: isTokenVariantsLoading,
    run: retryTokenVariants,
  } = usePromiseResult<IStockTokenVariantsRequestResult>(
    async () => {
      if (!normalizedStockId) return { items: [] };
      try {
        const response =
          await backgroundApiProxy.serviceMarketV2.fetchMarketStockTokenVariants(
            { stockId: normalizedStockId },
          );
        const result = {
          stockId: normalizedStockId,
          items: response.items,
          defaultTokenId: response.defaultTokenId,
        };
        successfulTokenVariants.set(normalizedStockId, result);
        fetchedTokenVariantsStockIdRef.current = normalizedStockId;
        return result;
      } catch (_error) {
        const cachedResult = successfulTokenVariants.get(normalizedStockId);
        return {
          stockId: normalizedStockId,
          items: cachedResult?.items ?? [],
          defaultTokenId: cachedResult?.defaultTokenId,
          failed: true,
        };
      }
    },
    [normalizedStockId, successfulTokenVariants],
    {
      watchLoading: true,
      // Same focus contract as the detail request above, and `revalidateOnFocus`
      // is left off for the same reason: it would stack an extra polling chain
      // on top of the one the focus gate already resumes.
      pollingInterval: normalizedStockId
        ? STOCK_TOKEN_VARIANTS_POLLING_INTERVAL
        : undefined,
      revalidateOnReconnect: true,
      swrKey: tokenVariantsSwrKey,
      swrShouldPersist: (r) => !r.failed,
    },
  );

  const currentStockDetail =
    stockDetailResult?.stockId === normalizedStockId
      ? stockDetailResult?.data
      : undefined;
  const hasCurrentTokenVariants =
    tokenVariantResult?.stockId === normalizedStockId;
  const tokenVariants = useMemo(
    () => (hasCurrentTokenVariants ? (tokenVariantResult?.items ?? []) : []),
    [hasCurrentTokenVariants, tokenVariantResult?.items],
  );

  useEffect(() => {
    if (preserveInitialToken) return;
    if (!normalizedStockId) {
      appliedTokenRouteRef.current = undefined;
      setSelectedTokenId(undefined);
      return;
    }
    if (!hasCurrentTokenVariants || tokenVariantResult?.failed) return;

    // Apply explicit navigation once; polling must preserve manual selection.
    const routeChanged = appliedTokenRouteRef.current !== tokenRouteKey;
    const hasCurrentToken = tokenVariants.some(
      (item) => item.tokenId === selectedTokenId,
    );
    if (!routeChanged && hasCurrentToken) return;

    // Resolving against a cached list only picks something to render. Until a
    // fetched list has been resolved against, the route stays outstanding so a
    // later list carrying its variant is still applied.
    if (fetchedTokenVariantsStockIdRef.current === normalizedStockId) {
      appliedTokenRouteRef.current = tokenRouteKey;
    }
    setSelectedTokenId(
      resolveStockTokenVariantSelection({
        variants: tokenVariants,
        defaultTokenId: tokenVariantResult?.defaultTokenId,
        routeNetworkId: initialNetworkId,
        routeTokenAddress: initialTokenAddress,
      })?.tokenId,
    );
  }, [
    hasCurrentTokenVariants,
    initialNetworkId,
    initialTokenAddress,
    preserveInitialToken,
    normalizedStockId,
    selectedTokenId,
    tokenVariantResult?.defaultTokenId,
    tokenVariantResult?.failed,
    tokenVariants,
    tokenRouteKey,
  ]);

  const selectedTokenVariant = useMemo(
    () =>
      tokenVariants.find((item) =>
        preserveInitialToken
          ? equalTokenNoCaseSensitive({
              token1: item,
              token2: {
                networkId: initialNetworkId,
                contractAddress: initialTokenAddress,
              },
            })
          : item.tokenId === selectedTokenId,
      ),
    [
      initialNetworkId,
      initialTokenAddress,
      preserveInitialToken,
      selectedTokenId,
      tokenVariants,
    ],
  );
  const isPreservedTokenResolutionPending = Boolean(
    preserveInitialToken &&
    initialNetworkId &&
    initialTokenAddress &&
    !tokenVariantResult?.failed &&
    tokenVariants.some(isStockTokenVariantTradable) &&
    !selectedTokenVariant &&
    fetchedTokenVariantsStockIdRef.current !== normalizedStockId,
  );
  const handleSetSelectedTokenId = useCallback(
    (tokenId: string) => {
      const token = tokenVariants.find((item) => item.tokenId === tokenId);
      if (token && isStockTokenVariantTradable(token)) {
        setSelectedTokenId(tokenId);
      }
    },
    [tokenVariants],
  );

  const value = useMemo<IStockDetailContextValue>(
    () => ({
      stockId: normalizedStockId,
      isStockRoute: Boolean(normalizedStockId),
      stockPreview,
      stockDetail: currentStockDetail,
      isStockDetailLoading: Boolean(normalizedStockId && isStockDetailLoading),
      isStockDetailError: Boolean(
        normalizedStockId &&
        stockDetailResult?.stockId === normalizedStockId &&
        stockDetailResult.failed,
      ),
      retryStockDetail,
      tokenVariants,
      isTokenVariantPending: Boolean(
        normalizedStockId &&
        (!hasCurrentTokenVariants ||
          (!preserveInitialToken &&
            !tokenVariantResult?.failed &&
            tokenVariants.some(isStockTokenVariantTradable) &&
            !selectedTokenVariant) ||
          isPreservedTokenResolutionPending),
      ),
      isTokenVariantsLoading: Boolean(
        normalizedStockId && isTokenVariantsLoading,
      ),
      isTokenVariantsError: Boolean(
        normalizedStockId &&
        tokenVariantResult?.stockId === normalizedStockId &&
        tokenVariantResult.failed,
      ),
      retryTokenVariants,
      selectedTokenId: preserveInitialToken
        ? selectedTokenVariant?.tokenId
        : selectedTokenId,
      selectedTokenVariant,
      setSelectedTokenId: handleSetSelectedTokenId,
      portfolioNetworkId: selectedTokenVariant?.networkId ?? initialNetworkId,
    }),
    [
      hasCurrentTokenVariants,
      initialNetworkId,
      isStockDetailLoading,
      isTokenVariantsLoading,
      isPreservedTokenResolutionPending,
      handleSetSelectedTokenId,
      normalizedStockId,
      preserveInitialToken,
      retryStockDetail,
      retryTokenVariants,
      selectedTokenId,
      selectedTokenVariant,
      stockPreview,
      stockDetailResult?.failed,
      stockDetailResult?.stockId,
      tokenVariantResult?.failed,
      tokenVariantResult?.stockId,
      currentStockDetail,
      tokenVariants,
    ],
  );

  return (
    <StockDetailContext.Provider value={value}>
      {children}
    </StockDetailContext.Provider>
  );
}

export function useStockDetail() {
  return useContext(StockDetailContext);
}
