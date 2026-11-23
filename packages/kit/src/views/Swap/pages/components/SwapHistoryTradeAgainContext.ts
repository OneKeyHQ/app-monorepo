import {
  createContext,
  useContext,
  useEffect,
  useImperativeHandle,
  useState,
} from 'react';
import type { RefObject } from 'react';

import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import type { ISwapHistoryTradeAgainHandler } from '@onekeyhq/shared/src/routes/swap';
import {
  swrCacheUtils,
  swrKeys,
} from '@onekeyhq/shared/src/utils/swrCacheUtils';
import { equalTokenNoCaseSensitive } from '@onekeyhq/shared/src/utils/tokenUtils';
import { ESwapTabSwitchType } from '@onekeyhq/shared/types/swap/types';
import type {
  ISwapInitParams,
  ISwapToken,
} from '@onekeyhq/shared/types/swap/types';

import { resolveMarketStockId } from '../../../Market/MarketDetailV2/utils/resolveIsStockToken';
import { getTokenIdentityKey } from '../../hooks/swapStockChannelUtils';
import { buildSwapInitParamsConsumptionKey } from '../../utils/swapColdStartTokenCacheUtils';
import {
  type ISwapStockTokenIdentityResult,
  fetchSwapStockTokenIdentity,
  getCachedSwapStockDisplayVariants,
  getCachedSwapStockId,
} from '../../utils/swapStockMarketData';

import type { ScrollViewInstance } from 'react-native';

export const SwapHistoryTradeAgainContext = createContext<
  ISwapHistoryTradeAgainHandler | undefined
>(undefined);

export const useSwapHistoryTradeAgainHandler = () =>
  useContext(SwapHistoryTradeAgainContext);

export function useSwapHistoryTradeAgainAllowed(
  params: ISwapInitParams | undefined,
  source: ISwapHistoryTradeAgainHandler | undefined,
) {
  const [, setEligibilityRevision] = useState(0);
  const allowed = Boolean(params && source?.isAllowed(params) !== false);
  const refreshEligibility = source?.refreshEligibility;

  useEffect(() => {
    if (!params || allowed || !refreshEligibility) return;
    let active = true;
    const onSettled = () => {
      if (active) setEligibilityRevision((revision) => revision + 1);
    };
    void refreshEligibility(params).then(onSettled, onSettled);
    return () => {
      active = false;
    };
  }, [allowed, params, refreshEligibility]);

  return allowed;
}

export type ISwapHistoryScrollHandle = {
  scrollToTop: () => void;
};

export const SwapHistoryScrollRefContext = createContext<
  RefObject<ISwapHistoryScrollHandle | null> | undefined
>(undefined);

export function useSwapHistoryScrollToTop(
  scrollViewRef: RefObject<ScrollViewInstance | null>,
) {
  const historyScrollRef = useContext(SwapHistoryScrollRefContext);
  useImperativeHandle(
    historyScrollRef,
    () => ({
      scrollToTop: () => {
        scrollViewRef.current?.scrollTo({ y: 0, animated: true });
      },
    }),
    [scrollViewRef],
  );
}

export const SwapInitialSelectionTimeoutContext = createContext(true);

function getHistoryStockToken(params?: ISwapInitParams) {
  const stocks = [params?.importFromToken, params?.importToToken].filter(
    (token) => token?.isStock,
  );
  return stocks.length === 1 ? stocks[0] : undefined;
}

type IMarketHistoryTradeAgainSource = {
  marketStockTrade?: boolean;
  marketNonStockTrade?: boolean;
  swapInitParams?: ISwapInitParams;
  locale: string;
};

export function canHandleTradeAgainInSource(
  params: ISwapInitParams,
  controlledStockToken?: ISwapToken,
) {
  if (
    !controlledStockToken ||
    params.swapTabSwitchType !== ESwapTabSwitchType.STOCK
  ) {
    return true;
  }
  const stock = getHistoryStockToken(params);
  return Boolean(
    stock?.networkId &&
    controlledStockToken.networkId &&
    (stock.isNative || stock.contractAddress) &&
    (controlledStockToken.isNative || controlledStockToken.contractAddress) &&
    getTokenIdentityKey(stock) === getTokenIdentityKey(controlledStockToken),
  );
}

export function isTradeAgainAllowedInMarketModal(
  params: ISwapInitParams,
  {
    marketStockTrade,
    marketNonStockTrade,
    swapInitParams,
    locale,
  }: IMarketHistoryTradeAgainSource,
) {
  if (marketNonStockTrade) {
    return (
      params.swapTabSwitchType !== ESwapTabSwitchType.STOCK &&
      !(
        platformEnv.isNative &&
        params.swapTabSwitchType === ESwapTabSwitchType.LIMIT
      )
    );
  }
  if (!marketStockTrade) return true;
  if (params.swapTabSwitchType !== ESwapTabSwitchType.STOCK) return false;

  const sourceStock = getHistoryStockToken(swapInitParams);
  const replayStock = getHistoryStockToken(params);
  if (!sourceStock || !replayStock) return false;
  if (canHandleTradeAgainInSource(params, sourceStock)) return true;

  const sourceStockId = getCachedSwapStockId(sourceStock, locale);
  if (!sourceStockId) return false;
  const replayStockId = resolveMarketStockId(replayStock);
  if (replayStockId) return sourceStockId === replayStockId;

  // Legacy tickers can differ from canonical listing IDs or be shared.
  return Boolean(
    getCachedSwapStockDisplayVariants(sourceStockId, locale)?.some((variant) =>
      equalTokenNoCaseSensitive({ token1: variant, token2: replayStock }),
    ),
  );
}

export async function refreshMarketStockTradeAgainEligibility(
  params: ISwapInitParams,
  {
    marketStockTrade,
    marketNonStockTrade,
    swapInitParams,
    locale,
  }: IMarketHistoryTradeAgainSource,
) {
  if (
    !marketStockTrade ||
    marketNonStockTrade ||
    params.swapTabSwitchType !== ESwapTabSwitchType.STOCK
  )
    return;
  const sourceStock = getHistoryStockToken(swapInitParams);
  const replayStock = getHistoryStockToken(params);
  if (!sourceStock?.contractAddress || !replayStock) return;

  let stockId = getCachedSwapStockId(sourceStock, locale);
  if (!stockId) {
    const stock = await fetchSwapStockTokenIdentity(sourceStock);
    stockId = resolveMarketStockId(stock);
    if (!stockId) return;
    const tokenIdentity = getTokenIdentityKey(sourceStock);
    swrCacheUtils.set<ISwapStockTokenIdentityResult>(
      swrKeys.swapStockTokenIdentity({ tokenScope: tokenIdentity }),
      { tokenIdentity, stock, failed: false },
    );
  }
  if (resolveMarketStockId(replayStock)) return;

  const cachedVariants = getCachedSwapStockDisplayVariants(stockId, locale);
  if (
    cachedVariants?.some((variant) =>
      equalTokenNoCaseSensitive({ token1: variant, token2: replayStock }),
    )
  )
    return;
  const variants =
    await backgroundApiProxy.serviceMarketV2.fetchMarketStockTokenVariants({
      stockId,
    });
  const latestVariants = getCachedSwapStockDisplayVariants(stockId, locale);
  if (
    !variants ||
    resolveMarketStockId(variants) !== stockId ||
    (latestVariants && latestVariants !== cachedVariants)
  )
    return;
  swrCacheUtils.set(swrKeys.marketStockTokenVariants({ stockId, locale }), {
    ...variants,
    stockId,
  });
}

export const SwapHistoryChannelIntentContext = createContext<
  | {
      key: string;
      params: ISwapInitParams;
      claim: (key: string) => boolean;
    }
  | undefined
>(undefined);

export const useSwapHistoryChannelIntent = () =>
  useContext(SwapHistoryChannelIntentContext);

export function getSwapHistorySourceIntentKey(params?: ISwapInitParams) {
  return JSON.stringify([
    buildSwapInitParamsConsumptionKey(params),
    params?.swapTabSwitchType,
    params?.swapSource,
    params?.importAccountKey,
    params?.marketPresetToken?.networkId,
    params?.marketPresetToken?.contractAddress,
    params?.marketPresetToken?.isNative,
  ]);
}
