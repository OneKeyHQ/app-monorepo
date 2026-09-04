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
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import { equalTokenNoCaseSensitive } from '@onekeyhq/shared/src/utils/tokenUtils';
import type {
  IMarketStockDetailPreview,
  IMarketStockPublicDetail,
  IMarketStockTokenVariant,
} from '@onekeyhq/shared/types/marketV2';

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

export function isStockTokenVariantTradable(variant: IMarketStockTokenVariant) {
  return Boolean(
    variant.tradingEnabled &&
    !variant.isPaused &&
    !variant.tradingHours?.isPaused &&
    variant.status.trim().toLowerCase() === 'active',
  );
}

export function StockDetailProvider({
  stockId,
  initialStockPreview,
  initialNetworkId,
  initialTokenAddress,
  children,
}: PropsWithChildren<{
  stockId?: string;
  initialStockPreview?: IMarketStockDetailPreview;
  initialNetworkId?: string;
  initialTokenAddress?: string;
}>) {
  const normalizedStockId = stockId?.trim().toUpperCase() || undefined;
  const stockPreview =
    initialStockPreview?.stockId.trim().toUpperCase() === normalizedStockId
      ? initialStockPreview
      : undefined;
  const [selectedTokenId, setSelectedTokenId] = useState<string>();
  // Keep the last successful detail per stock so a superseded response cannot
  // replace the fallback used by the currently selected stock.
  const successfulStockDetailsRef = useRef(
    new Map<string, IStockDetailRequestResult>(),
  );
  // Same idea for the variant list, kept per stock because a failed fetch here
  // must not drop the token the user already selected.
  const successfulTokenVariantsRef = useRef(
    new Map<string, IStockTokenVariantsRequestResult>(),
  );

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
        successfulStockDetailsRef.current.set(normalizedStockId, result);
        return result;
      } catch (_error) {
        // A polling tick that fails must not turn a loaded page into an error
        // page: keep the last good payload and retry silently on the next
        // tick. Only a stock we never loaded surfaces the retryable error.
        const lastStockDetail =
          successfulStockDetailsRef.current.get(normalizedStockId);
        if (lastStockDetail) {
          return lastStockDetail;
        }
        return { stockId: normalizedStockId, failed: true };
      }
    },
    [normalizedStockId],
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
        successfulTokenVariantsRef.current.set(normalizedStockId, result);
        return result;
      } catch (_error) {
        const cachedResult =
          successfulTokenVariantsRef.current.get(normalizedStockId);
        return {
          stockId: normalizedStockId,
          items: cachedResult?.items ?? [],
          defaultTokenId: cachedResult?.defaultTokenId,
          failed: true,
        };
      }
    },
    [normalizedStockId],
    {
      watchLoading: true,
      // Same focus contract as the detail request above, and `revalidateOnFocus`
      // is left off for the same reason: it would stack an extra polling chain
      // on top of the one the focus gate already resumes.
      pollingInterval: normalizedStockId
        ? STOCK_TOKEN_VARIANTS_POLLING_INTERVAL
        : undefined,
      revalidateOnReconnect: true,
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
    if (!normalizedStockId) {
      setSelectedTokenId(undefined);
      return;
    }
    if (tokenVariantResult?.failed) return;

    const hasCurrentToken = tokenVariants.some(
      (item) => item.tokenId === selectedTokenId,
    );
    if (hasCurrentToken) return;

    const routeToken = tokenVariants.find(
      (item) =>
        isStockTokenVariantTradable(item) &&
        equalTokenNoCaseSensitive({
          token1: {
            networkId: item.networkId,
            contractAddress: item.contractAddress,
          },
          token2: {
            networkId: initialNetworkId,
            contractAddress: initialTokenAddress,
          },
        }),
    );
    const defaultToken = tokenVariants.find(
      (item) =>
        item.tokenId === tokenVariantResult?.defaultTokenId &&
        isStockTokenVariantTradable(item),
    );
    const firstTradableToken = tokenVariants.find(isStockTokenVariantTradable);
    setSelectedTokenId(
      routeToken?.tokenId ??
        defaultToken?.tokenId ??
        firstTradableToken?.tokenId,
    );
  }, [
    initialNetworkId,
    initialTokenAddress,
    normalizedStockId,
    selectedTokenId,
    tokenVariantResult?.defaultTokenId,
    tokenVariantResult?.failed,
    tokenVariants,
  ]);

  const selectedTokenVariant = useMemo(
    () => tokenVariants.find((item) => item.tokenId === selectedTokenId),
    [selectedTokenId, tokenVariants],
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
      isTokenVariantsLoading: Boolean(
        normalizedStockId && isTokenVariantsLoading,
      ),
      isTokenVariantsError: Boolean(
        normalizedStockId &&
        tokenVariantResult?.stockId === normalizedStockId &&
        tokenVariantResult.failed,
      ),
      retryTokenVariants,
      selectedTokenId,
      selectedTokenVariant,
      setSelectedTokenId: handleSetSelectedTokenId,
      portfolioNetworkId: selectedTokenVariant?.networkId ?? initialNetworkId,
    }),
    [
      initialNetworkId,
      isStockDetailLoading,
      isTokenVariantsLoading,
      handleSetSelectedTokenId,
      normalizedStockId,
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
