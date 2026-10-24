import type { PropsWithChildren } from 'react';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import type { IPageNavigationProp } from '@onekeyhq/components';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { useLocaleVariant } from '@onekeyhq/kit/src/hooks/useLocaleVariant';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import {
  StockDetailProvider,
  useStockDetail,
} from '@onekeyhq/kit/src/views/Market/MarketDetailV2/hooks/StockDetailContext';
import { resolveMarketStockId } from '@onekeyhq/kit/src/views/Market/MarketDetailV2/utils/resolveIsStockToken';
import type { EJotaiContextStoreNames } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { EModalRoutes } from '@onekeyhq/shared/src/routes';
import {
  EModalSwapRoutes,
  type IModalSwapParamList,
} from '@onekeyhq/shared/src/routes/swap';
import { swrKeys } from '@onekeyhq/shared/src/utils/swrCacheUtils';
import { equalTokenNoCaseSensitive } from '@onekeyhq/shared/src/utils/tokenUtils';
import type {
  IMarketStockDetailPreview,
  IMarketStockPublicItem,
  IMarketStockTokenVariant,
} from '@onekeyhq/shared/types/marketV2';
import type { ISwapToken } from '@onekeyhq/shared/types/swap/types';

import { getTokenIdentityKey } from '../../hooks/swapStockChannelUtils';
import { ESwapStockChannelAsyncStatus } from '../../hooks/useSwapStockChannel';
import { useSwapTokenRiskCheck } from '../../hooks/useSwapTokenRiskCheck';
import {
  type ISwapStockAvailability,
  type ISwapStockSelectionKind,
  type ISwapStockSelectionOperation,
  type ISwapStockTokenIdentityResult,
  fetchSwapStockSelection,
  fetchSwapStockTokenIdentity,
  fetchSwapStockVariantToken,
  getCachedSwapStockAssetPreview,
  getCachedSwapStockId,
  getCachedSwapStockSelection,
  getCachedSwapStockVariantToken,
  resolveSwapStockAvailability,
  resolveSwapStockLoadingScopes,
  resolveSwapStockSelectionToken,
  resolveSwapStockTokenSelectionKind,
} from '../../utils/swapStockMarketData';

import { useSwapStockTradeContext } from './SwapStockTradeProvider';

type ISwapStockSelection = {
  storeName: EJotaiContextStoreNames;
  cancelSelection: () => void;
  selecting: boolean;
  stockSelectionPending: boolean;
  loadingScopes: ReturnType<typeof resolveSwapStockLoadingScopes>;
  pendingStock?: IMarketStockDetailPreview;
  selectedStockPreview?: IMarketStockDetailPreview;
  availability: ISwapStockAvailability;
  selectionError: boolean;
  retrySelection: () => Promise<boolean>;
  identityResolutionError: boolean;
  retryIdentityResolution: () => void;
  selectStock: (
    stock: IMarketStockPublicItem,
    query?: string,
  ) => Promise<boolean>;
  selectVariant: (variant: IMarketStockTokenVariant) => Promise<boolean>;
  selectToken: (token: ISwapToken) => Promise<boolean>;
};

const SwapStockSelectionContext = createContext<
  ISwapStockSelection | undefined
>(undefined);

function SwapStockSelectionProvider({
  children,
  identityResolutionError,
  retryIdentityResolution,
  storeName,
}: PropsWithChildren<
  Pick<
    ISwapStockSelection,
    'identityResolutionError' | 'retryIdentityResolution'
  > & { storeName: EJotaiContextStoreNames }
>) {
  const locale = useLocaleVariant().toLowerCase();
  const {
    stockId,
    tokenVariants,
    isTokenVariantPending,
    isTokenVariantsError,
  } = useStockDetail();
  const { currentStockToken, selectStockSwapToken, stockTokenStatus } =
    useSwapStockTradeContext();
  const navigation =
    useAppNavigation<IPageNavigationProp<IModalSwapParamList>>();
  const checkRiskToken = useSwapTokenRiskCheck();
  const [operation, setOperation] = useState<ISwapStockSelectionOperation>({
    phase: 'idle',
  });
  const [selectedStockPreview, setSelectedStockPreview] =
    useState<IMarketStockDetailPreview>();
  const requestRef = useRef(0);
  const retrySelectionRef = useRef<(() => Promise<boolean>) | undefined>(
    undefined,
  );
  const currentStockIdRef = useRef<string | undefined>(undefined);
  currentStockIdRef.current =
    resolveMarketStockId(currentStockToken ?? {}) ?? stockId;
  const identity = getTokenIdentityKey(currentStockToken);
  const selectedVariant = tokenVariants.find(
    (variant) =>
      currentStockToken &&
      equalTokenNoCaseSensitive({ token1: variant, token2: currentStockToken }),
  );
  const selecting =
    operation.phase === 'resolving' || operation.phase === 'checkingRisk';
  const pendingStock =
    (operation.phase === 'resolving' || operation.phase === 'applying') &&
    operation.kind === 'ticker'
      ? operation.stockPreview
      : undefined;
  const selectionError = operation.phase === 'failed';
  const loadingScopes = useMemo(
    () =>
      resolveSwapStockLoadingScopes({
        operation,
        currentTokenKey: identity,
        isTokenVariantPending,
      }),
    [identity, isTokenVariantPending, operation],
  );
  const stockSelectionPending = loadingScopes.stock;
  const availability = resolveSwapStockAvailability({
    pending:
      operation.phase === 'checkingRisk' ||
      loadingScopes.tradeTarget ||
      isTokenVariantPending ||
      stockTokenStatus === ESwapStockChannelAsyncStatus.Initializing ||
      Boolean(currentStockToken && !stockId && !identityResolutionError),
    failed: isTokenVariantsError || identityResolutionError,
    selectedVariant,
  });
  useEffect(() => {
    // The fetched token may commit before its variant list catches up.
    if (
      operation.phase === 'applying' &&
      operation.tokenKey === identity &&
      !isTokenVariantPending
    ) {
      setOperation({ phase: 'idle' });
    }
  }, [identity, isTokenVariantPending, operation]);
  const identityRef = useRef(identity);
  identityRef.current = identity;
  const cancelSelection = useCallback(() => {
    requestRef.current += 1;
    setOperation({ phase: 'idle' });
    setSelectedStockPreview((preview) =>
      preview?.stockId.toUpperCase() ===
      currentStockIdRef.current?.toUpperCase()
        ? preview
        : undefined,
    );
  }, []);
  const retrySelection = useCallback(() => {
    const retry = retrySelectionRef.current;
    return retry ? retry() : Promise.resolve(false);
  }, []);
  useEffect(() => {
    requestRef.current += 1;
    setOperation((current) =>
      current.phase === 'applying' && current.tokenKey === identity
        ? current
        : { phase: 'idle' },
    );
    setSelectedStockPreview((preview) =>
      preview?.stockId.toUpperCase() ===
      currentStockIdRef.current?.toUpperCase()
        ? preview
        : undefined,
    );
  }, [identity]);
  useEffect(
    () => () => {
      requestRef.current += 1;
    },
    [],
  );

  const select = useCallback(
    async ({
      kind,
      fetchToken,
      stockPreview,
      hasCachedToken = false,
    }: {
      kind: ISwapStockSelectionKind;
      fetchToken: () => Promise<ISwapToken>;
      stockPreview?: IMarketStockDetailPreview;
      hasCachedToken?: boolean;
    }) => {
      requestRef.current += 1;
      const request = requestRef.current;
      const initialIdentity = identityRef.current;
      // Cached data needs only the risk check. Keep the committed display
      // coherent until that check permits the new token to commit.
      setOperation(
        hasCachedToken
          ? { phase: 'checkingRisk', kind }
          : { phase: 'resolving', kind, stockPreview },
      );
      try {
        const token = await fetchToken();
        if (
          request !== requestRef.current ||
          initialIdentity !== identityRef.current
        )
          return false;
        const commitSelection = () => {
          if (
            request === requestRef.current &&
            initialIdentity === identityRef.current
          ) {
            if (stockPreview) setSelectedStockPreview(stockPreview);
            setOperation({
              phase: 'applying',
              kind,
              tokenKey: getTokenIdentityKey(token),
              stockPreview,
            });
            selectStockSwapToken(token, { resetReceiveAmount: true });
          }
        };
        const isRiskToken = await checkRiskToken(token);
        if (
          request !== requestRef.current ||
          initialIdentity !== identityRef.current
        ) {
          return false;
        }
        if (isRiskToken) {
          setOperation({ phase: 'idle' });
          navigation.pushModal(EModalRoutes.SwapModal, {
            screen: EModalSwapRoutes.TokenRiskReminder,
            params: {
              storeName,
              token,
              onConfirm: (close) => {
                close();
                commitSelection();
              },
            },
          });
        } else {
          commitSelection();
        }
        return true;
      } catch (_error) {
        if (request === requestRef.current)
          setOperation({ phase: 'failed', kind });
        return false;
      }
    },
    [checkRiskToken, navigation, selectStockSwapToken, storeName],
  );
  const selectStock = useCallback(
    (stock: IMarketStockPublicItem, query?: string) => {
      const retry = () => {
        const cached = getCachedSwapStockSelection(stock, query, locale);
        return select({
          kind: 'ticker',
          fetchToken: async () =>
            cached ?? fetchSwapStockSelection(stock, query, locale),
          stockPreview: stock,
          hasCachedToken: Boolean(cached),
        });
      };
      retrySelectionRef.current = retry;
      return retry();
    },
    [locale, select],
  );
  const selectVariant = useCallback(
    (variant: IMarketStockTokenVariant) => {
      if (!stockId) return Promise.resolve(false);
      const retry = () => {
        const cached = getCachedSwapStockVariantToken(variant, stockId, locale);
        return select({
          kind: 'variant',
          fetchToken: async () =>
            cached ?? fetchSwapStockVariantToken(variant, stockId, locale),
          hasCachedToken: Boolean(cached),
        });
      };
      retrySelectionRef.current = retry;
      return retry();
    },
    [locale, select, stockId],
  );
  const selectToken = useCallback(
    (token: ISwapToken) => {
      const retry = () => {
        const stockPreview = getCachedSwapStockAssetPreview(token, locale);
        return select({
          kind:
            stockPreview?.stockId === currentStockIdRef.current
              ? 'token'
              : resolveSwapStockTokenSelectionKind(
                  token,
                  currentStockIdRef.current,
                ),
          fetchToken: () => resolveSwapStockSelectionToken(token, locale),
          stockPreview,
          hasCachedToken: Boolean(stockPreview),
        });
      };
      retrySelectionRef.current = retry;
      return retry();
    },
    [locale, select],
  );

  const value = useMemo(
    () => ({
      storeName,
      cancelSelection,
      selecting,
      stockSelectionPending,
      loadingScopes,
      pendingStock,
      selectedStockPreview,
      availability,
      selectionError,
      retrySelection,
      identityResolutionError,
      retryIdentityResolution,
      selectStock,
      selectVariant,
      selectToken,
    }),
    [
      storeName,
      cancelSelection,
      selecting,
      stockSelectionPending,
      loadingScopes,
      pendingStock,
      selectedStockPreview,
      availability,
      selectionError,
      retrySelection,
      identityResolutionError,
      retryIdentityResolution,
      selectStock,
      selectVariant,
      selectToken,
    ],
  );
  return (
    <SwapStockSelectionContext.Provider value={value}>
      {children}
    </SwapStockSelectionContext.Provider>
  );
}

export function SwapStockMarketProvider({
  children,
  storeName,
}: PropsWithChildren<{ storeName: EJotaiContextStoreNames }>) {
  const { currentStockToken, displayStockTokenDetail } =
    useSwapStockTradeContext();
  const locale = useLocaleVariant().toLowerCase();
  const explicitStockId =
    resolveMarketStockId(displayStockTokenDetail ?? {}) ??
    (currentStockToken
      ? getCachedSwapStockId(currentStockToken, locale)
      : undefined);
  const tokenIdentity = getTokenIdentityKey(currentStockToken);
  const networkId = currentStockToken?.networkId;
  const contractAddress = currentStockToken?.contractAddress;
  const identityResolutionSwrKey = tokenIdentity
    ? swrKeys.swapStockTokenIdentity({ tokenScope: tokenIdentity })
    : undefined;
  const { result: resolvedStock, run: retryResolution } = usePromiseResult<
    ISwapStockTokenIdentityResult | undefined
  >(
    async () => {
      if (explicitStockId || !contractAddress || !networkId) return undefined;
      try {
        const stock = await fetchSwapStockTokenIdentity({
          networkId,
          contractAddress,
        });
        return {
          tokenIdentity,
          stock,
          failed: false,
        };
      } catch (_error) {
        return { tokenIdentity, stock: undefined, failed: true };
      }
    },
    [contractAddress, networkId, explicitStockId, tokenIdentity],
    {
      checkIsFocused: false,
      // Persisted selections can predate `stockId`, which leaves this contract
      // lookup as the only way to learn the identity. Caching what it resolves
      // lets the next mount — including a cold start — key the stock detail
      // cache from the first render instead of waiting for the network again.
      swrKey: identityResolutionSwrKey,
      swrShouldPersist: (result) =>
        Boolean(result && !result.failed && result.stock),
    },
  );
  const stock =
    resolvedStock?.tokenIdentity === tokenIdentity
      ? resolvedStock.stock
      : undefined;
  const retryIdentityResolution = useCallback(() => {
    void retryResolution();
  }, [retryResolution]);
  const identityResolutionError = Boolean(
    !explicitStockId &&
    resolvedStock?.tokenIdentity === tokenIdentity &&
    resolvedStock?.failed,
  );
  return (
    <StockDetailProvider
      preserveInitialToken
      stockId={explicitStockId ?? stock?.stockId}
      initialStockPreview={stock}
      initialNetworkId={currentStockToken?.networkId}
      initialTokenAddress={currentStockToken?.contractAddress}
    >
      <SwapStockSelectionProvider
        identityResolutionError={identityResolutionError}
        retryIdentityResolution={retryIdentityResolution}
        storeName={storeName}
      >
        {children}
      </SwapStockSelectionProvider>
    </StockDetailProvider>
  );
}

export function useSwapStockSelection() {
  return useContext(SwapStockSelectionContext);
}
