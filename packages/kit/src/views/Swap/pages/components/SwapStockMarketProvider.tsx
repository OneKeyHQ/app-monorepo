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
import {
  type EJotaiContextStoreNames,
  useSwapStockIssuerPreferencePersistAtom,
} from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import { EModalRoutes } from '@onekeyhq/shared/src/routes';
import {
  EModalSwapRoutes,
  type IModalSwapParamList,
} from '@onekeyhq/shared/src/routes/swap';
import { normalizeStockIssuer } from '@onekeyhq/shared/src/utils/stockTokenVariant';
import { swrKeys } from '@onekeyhq/shared/src/utils/swrCacheUtils';
import { equalTokenNoCaseSensitive } from '@onekeyhq/shared/src/utils/tokenUtils';
import type {
  IMarketStockDetailPreview,
  IMarketStockPublicItem,
  IMarketStockTokenVariant,
} from '@onekeyhq/shared/types/marketV2';
import type { ISwapToken } from '@onekeyhq/shared/types/swap/types';

import {
  getTokenIdentityKey,
  isSwapStockTokenKeySettled,
  settleSwapStockTokenKey,
} from '../../hooks/swapStockChannelUtils';
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
  resolveSwapStockAutoVariant,
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
  // A hand pick from the issuer list: also remembers the issuer once the
  // switch commits (not when a risk prompt is cancelled).
  pickVariant: (variant: IMarketStockTokenVariant) => Promise<boolean>;
  selectToken: (token: ISwapToken) => Promise<boolean>;
};

const SwapStockSelectionContext = createContext<
  ISwapStockSelection | undefined
>(undefined);

// Upper bound for holding the trade target while the automatic issuer switch
// is undecided (variant list) or in flight (target token), so a stalled
// request cannot hide it.
const AUTO_VARIANT_WAIT_MS = 8000;

function withAutoVariantTimeout<T>(request: Promise<T>) {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(
      () => reject(new OneKeyLocalError('Stock variant switch timed out')),
      AUTO_VARIANT_WAIT_MS,
    );
  });
  return Promise.race([request, timeout]).finally(() => clearTimeout(timer));
}

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
    isTokenVariantsFresh,
    defaultTokenId,
  } = useStockDetail();
  const { currentStockToken, selectStockSwapToken, stockTokenStatus } =
    useSwapStockTradeContext();
  const navigation =
    useAppNavigation<IPageNavigationProp<IModalSwapParamList>>();
  const checkRiskToken = useSwapTokenRiskCheck();
  const [{ issuer: preferredIssuer }, setIssuerPreference] =
    useSwapStockIssuerPreferencePersistAtom();
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

  // Only the first token this page shows can be implicit (restored, or the
  // default loader's pick); any later token came from a user action. The token
  // is held in the loading state until it is decided, so one about to move is
  // never shown. Decide only from a fetched list: a persisted cache can still
  // carry an issuer that has since been retired, and the decision is final.
  const [, setSettledVersion] = useState(0);
  const firstTokenKeyRef = useRef<string | undefined>(undefined);
  // Tokens an explicit entry brought in (Market's Buy/Sell) arrive settled.
  const isAutoVariantCandidate = Boolean(
    identity &&
    (firstTokenKeyRef.current ?? identity) === identity &&
    !isSwapStockTokenKeySettled(identity),
  );
  const isAutoVariantListReady =
    isTokenVariantsFresh && !isTokenVariantPending && !!selectedVariant;
  // Nothing more will arrive to decide with: keep the token as it is.
  const isAutoVariantListBlocked =
    isTokenVariantsError ||
    identityResolutionError ||
    (isTokenVariantsFresh && !selectedVariant);
  const autoVariantTarget = useMemo(
    () =>
      isAutoVariantCandidate && isAutoVariantListReady && selectedVariant
        ? resolveSwapStockAutoVariant({
            variants: tokenVariants,
            current: selectedVariant,
            defaultTokenId,
            preferredIssuer,
          })
        : undefined,
    [
      defaultTokenId,
      isAutoVariantCandidate,
      isAutoVariantListReady,
      preferredIssuer,
      selectedVariant,
      tokenVariants,
    ],
  );
  const isAutoVariantPending =
    isAutoVariantCandidate &&
    operation.phase === 'idle' &&
    (!!autoVariantTarget ||
      (!isAutoVariantListReady && !isAutoVariantListBlocked));
  const loadingScopes = useMemo(
    () =>
      resolveSwapStockLoadingScopes({
        operation,
        currentTokenKey: identity,
        isTokenVariantPending,
        isAutoVariantPending,
      }),
    [identity, isAutoVariantPending, isTokenVariantPending, operation],
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
      silent = false,
      onCommitted,
    }: {
      kind: ISwapStockSelectionKind;
      fetchToken: () => Promise<ISwapToken>;
      stockPreview?: IMarketStockDetailPreview;
      hasCachedToken?: boolean;
      // Automatic switches keep the current token on failure: no error
      // state and no risk prompt the user did not ask for.
      silent?: boolean;
      // Runs once the token is actually applied (after a risk confirm).
      onCommitted?: () => void;
    }) => {
      requestRef.current += 1;
      const request = requestRef.current;
      const initialIdentity = identityRef.current;
      // A user's own pick ends the implicit correction of the first token, so
      // a variant list landing during its risk prompt cannot replace it.
      if (!silent && initialIdentity) {
        settleSwapStockTokenKey(initialIdentity);
        setSettledVersion((version) => version + 1);
      }
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
            onCommitted?.();
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
          // An automatic switch never raises a prompt the user did not ask for.
          if (silent) return false;
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
          setOperation(silent ? { phase: 'idle' } : { phase: 'failed', kind });
        return false;
      }
    },
    [checkRiskToken, navigation, selectStockSwapToken, storeName],
  );
  const selectStock = useCallback(
    (stock: IMarketStockPublicItem, query?: string) => {
      const retry = () => {
        const cached = getCachedSwapStockSelection(
          stock,
          query,
          locale,
          preferredIssuer,
        );
        return select({
          kind: 'ticker',
          fetchToken: async () =>
            cached ??
            fetchSwapStockSelection(stock, query, locale, preferredIssuer),
          stockPreview: stock,
          hasCachedToken: Boolean(cached),
        });
      };
      retrySelectionRef.current = retry;
      return retry();
    },
    [locale, preferredIssuer, select],
  );
  const requestVariant = useCallback(
    (variant: IMarketStockTokenVariant, onCommitted?: () => void) => {
      if (!stockId) return Promise.resolve(false);
      const retry = () => {
        const cached = getCachedSwapStockVariantToken(variant, stockId, locale);
        return select({
          kind: 'variant',
          fetchToken: async () =>
            cached ?? fetchSwapStockVariantToken(variant, stockId, locale),
          hasCachedToken: Boolean(cached),
          onCommitted,
        });
      };
      retrySelectionRef.current = retry;
      return retry();
    },
    [locale, select, stockId],
  );
  const selectVariant = useCallback(
    (variant: IMarketStockTokenVariant) => requestVariant(variant),
    [requestVariant],
  );
  const pickVariant = useCallback(
    (variant: IMarketStockTokenVariant) => {
      const issuer = normalizeStockIssuer(variant.issuer);
      return requestVariant(variant, () =>
        setIssuerPreference((previous) =>
          previous.issuer === issuer ? previous : { issuer },
        ),
      );
    },
    [requestVariant, setIssuerPreference],
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

  const markSettled = useCallback((key: string) => {
    settleSwapStockTokenKey(key);
    setSettledVersion((version) => version + 1);
  }, []);
  useEffect(() => {
    if (!identity) return;
    firstTokenKeyRef.current ??= identity;
    if (identity !== firstTokenKeyRef.current) {
      settleSwapStockTokenKey(identity);
      return;
    }
    if (isSwapStockTokenKeySettled(identity) || operation.phase !== 'idle') {
      return;
    }
    if (autoVariantTarget && stockId) {
      markSettled(identity);
      const cached = getCachedSwapStockVariantToken(
        autoVariantTarget,
        stockId,
        locale,
      );
      // Silent: a timeout or failure keeps the current token without an
      // error state, and the token stays settled so it is not retried.
      void select({
        kind: 'variant',
        fetchToken: async () =>
          cached ??
          withAutoVariantTimeout(
            fetchSwapStockVariantToken(autoVariantTarget, stockId, locale),
          ),
        hasCachedToken: Boolean(cached),
        silent: true,
      });
    } else if (isAutoVariantListReady || isAutoVariantListBlocked) {
      markSettled(identity);
    }
  }, [
    autoVariantTarget,
    identity,
    isAutoVariantListBlocked,
    isAutoVariantListReady,
    locale,
    markSettled,
    operation.phase,
    select,
    stockId,
  ]);
  useEffect(() => {
    if (!isAutoVariantPending || autoVariantTarget || !identity) return;
    const timer = setTimeout(() => markSettled(identity), AUTO_VARIANT_WAIT_MS);
    return () => clearTimeout(timer);
  }, [autoVariantTarget, identity, isAutoVariantPending, markSettled]);

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
      pickVariant,
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
      pickVariant,
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
