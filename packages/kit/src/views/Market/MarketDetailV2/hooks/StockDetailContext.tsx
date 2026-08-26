import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import type { PropsWithChildren } from 'react';

import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import type {
  IMarketStockPublicDetail,
  IMarketStockTokenVariant,
} from '@onekeyhq/shared/types/marketV2';

type IStockDetailContextValue = {
  stockId?: string;
  isStockRoute: boolean;
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
  children,
}: PropsWithChildren<{ stockId?: string }>) {
  const normalizedStockId = stockId?.trim().toUpperCase() || undefined;
  const [selectedTokenId, setSelectedTokenId] = useState<string>();

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
        return { stockId: normalizedStockId, data };
      } catch (_error) {
        return { stockId: normalizedStockId, failed: true };
      }
    },
    [normalizedStockId],
    {
      watchLoading: true,
      checkIsFocused: false,
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
        return {
          stockId: normalizedStockId,
          items: response.items,
          defaultTokenId: response.defaultTokenId,
        };
      } catch (_error) {
        return { stockId: normalizedStockId, items: [], failed: true };
      }
    },
    [normalizedStockId],
    {
      watchLoading: true,
      checkIsFocused: false,
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

    const hasCurrentToken = tokenVariants.some(
      (item) =>
        item.tokenId === selectedTokenId && isStockTokenVariantTradable(item),
    );
    if (hasCurrentToken) return;

    const defaultToken = tokenVariants.find(
      (item) =>
        item.tokenId === tokenVariantResult?.defaultTokenId &&
        isStockTokenVariantTradable(item),
    );
    const firstTradableToken = tokenVariants.find(isStockTokenVariantTradable);
    setSelectedTokenId(defaultToken?.tokenId ?? firstTradableToken?.tokenId);
  }, [
    normalizedStockId,
    selectedTokenId,
    tokenVariantResult?.defaultTokenId,
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
    }),
    [
      isStockDetailLoading,
      isTokenVariantsLoading,
      handleSetSelectedTokenId,
      normalizedStockId,
      retryStockDetail,
      retryTokenVariants,
      selectedTokenId,
      selectedTokenVariant,
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
