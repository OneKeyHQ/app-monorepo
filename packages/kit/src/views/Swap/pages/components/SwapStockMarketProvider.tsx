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
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import {
  StockDetailProvider,
  useStockDetail,
} from '@onekeyhq/kit/src/views/Market/MarketDetailV2/hooks/StockDetailContext';
import { resolveMarketStockId } from '@onekeyhq/kit/src/views/Market/MarketDetailV2/utils/resolveIsStockToken';
import type { EJotaiContextStoreNames } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import {
  EModalSwapRoutes,
  type IModalSwapParamList,
} from '@onekeyhq/shared/src/routes/swap';
import { equalTokenNoCaseSensitive } from '@onekeyhq/shared/src/utils/tokenUtils';
import type {
  IMarketStockPublicItem,
  IMarketStockTokenVariant,
} from '@onekeyhq/shared/types/marketV2';
import type { ISwapToken } from '@onekeyhq/shared/types/swap/types';

import { getTokenIdentityKey } from '../../hooks/swapStockChannelUtils';
import { ESwapStockChannelAsyncStatus } from '../../hooks/useSwapStockChannel';
import { useSwapTokenRiskCheck } from '../../hooks/useSwapTokenRiskCheck';
import {
  type ISwapStockAvailability,
  fetchSwapStockSelection,
  fetchSwapStockVariantToken,
  resolveSwapStockAvailability,
} from '../../utils/swapStockMarketData';

import { useSwapStockTradeContext } from './SwapStockTradeProvider';

type ISwapStockSelection = {
  cancelSelection: () => void;
  selecting: boolean;
  availability: ISwapStockAvailability;
  selectionError: boolean;
  identityResolutionError: boolean;
  retryIdentityResolution: () => void;
  selectStock: (
    stock: IMarketStockPublicItem,
    query?: string,
  ) => Promise<boolean>;
  selectVariant: (variant: IMarketStockTokenVariant) => Promise<boolean>;
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
  const [selecting, setSelecting] = useState(false);
  const [selectionError, setSelectionError] = useState(false);
  const requestRef = useRef(0);
  const identity = getTokenIdentityKey(currentStockToken);
  const selectedVariant = tokenVariants.find(
    (variant) =>
      currentStockToken &&
      equalTokenNoCaseSensitive({ token1: variant, token2: currentStockToken }),
  );
  const availability = resolveSwapStockAvailability({
    pending:
      selecting ||
      isTokenVariantPending ||
      stockTokenStatus === ESwapStockChannelAsyncStatus.Initializing ||
      Boolean(currentStockToken && !stockId && !identityResolutionError),
    failed: isTokenVariantsError || identityResolutionError,
    selectedVariant,
  });
  const identityRef = useRef(identity);
  identityRef.current = identity;
  const cancelSelection = useCallback(() => {
    requestRef.current += 1;
    setSelecting(false);
    setSelectionError(false);
  }, []);
  useEffect(() => {
    cancelSelection();
  }, [cancelSelection, identity]);
  useEffect(
    () => () => {
      requestRef.current += 1;
    },
    [],
  );

  const select = useCallback(
    async (fetchToken: () => Promise<ISwapToken>) => {
      requestRef.current += 1;
      const request = requestRef.current;
      const initialIdentity = identityRef.current;
      setSelecting(true);
      setSelectionError(false);
      try {
        const token = await fetchToken();
        if (
          request !== requestRef.current ||
          initialIdentity !== identityRef.current
        )
          return false;
        const commitSelection = () => {
          if (initialIdentity === identityRef.current) {
            selectStockSwapToken(token, { resetReceiveAmount: true });
          }
        };
        if (await checkRiskToken(token)) {
          navigation.push(EModalSwapRoutes.TokenRiskReminder, {
            storeName,
            token,
            onConfirm: commitSelection,
          });
        } else {
          commitSelection();
        }
        return true;
      } catch (_error) {
        if (request === requestRef.current) setSelectionError(true);
        return false;
      } finally {
        if (request === requestRef.current) setSelecting(false);
      }
    },
    [checkRiskToken, navigation, selectStockSwapToken, storeName],
  );
  const selectStock = useCallback(
    (stock: IMarketStockPublicItem, query?: string) =>
      select(() => fetchSwapStockSelection(stock, query)),
    [select],
  );
  const selectVariant = useCallback(
    (variant: IMarketStockTokenVariant) =>
      stockId
        ? select(() => fetchSwapStockVariantToken(variant, stockId))
        : Promise.resolve(false),
    [select, stockId],
  );

  const value = useMemo(
    () => ({
      cancelSelection,
      selecting,
      availability,
      selectionError,
      identityResolutionError,
      retryIdentityResolution,
      selectStock,
      selectVariant,
    }),
    [
      cancelSelection,
      selecting,
      availability,
      selectionError,
      identityResolutionError,
      retryIdentityResolution,
      selectStock,
      selectVariant,
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
  const explicitStockId =
    resolveMarketStockId(displayStockTokenDetail ?? {}) ??
    resolveMarketStockId(currentStockToken ?? {});
  const tokenIdentity = getTokenIdentityKey(currentStockToken);
  const networkId = currentStockToken?.networkId;
  const contractAddress = currentStockToken?.contractAddress;
  const { result: resolvedStock, run: retryResolution } = usePromiseResult(
    async () => {
      if (explicitStockId || !contractAddress || !networkId) return undefined;
      try {
        // Old persisted selections predate stockId. Resolve by the exact contract,
        // rather than guessing the company from issuer-specific token symbols.
        const response =
          await backgroundApiProxy.serviceMarketV2.searchMarketStocks({
            query: contractAddress,
          });
        const candidate =
          response.items.length === 1 ? response.items[0] : undefined;
        if (!candidate)
          return { tokenIdentity, stock: undefined, failed: true };
        const variants =
          await backgroundApiProxy.serviceMarketV2.fetchMarketStockTokenVariants(
            {
              stockId: candidate.stockId,
            },
          );
        const matches = variants.items.some((variant) =>
          equalTokenNoCaseSensitive({
            token1: variant,
            token2: { networkId, contractAddress },
          }),
        );
        return {
          tokenIdentity,
          stock: matches ? candidate : undefined,
          failed: !matches,
        };
      } catch (_error) {
        return { tokenIdentity, stock: undefined, failed: true };
      }
    },
    [contractAddress, networkId, explicitStockId, tokenIdentity],
    { checkIsFocused: false },
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
