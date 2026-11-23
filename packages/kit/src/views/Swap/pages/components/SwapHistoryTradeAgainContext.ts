import { createContext, useContext, useImperativeHandle } from 'react';
import type { RefObject } from 'react';

import platformEnv from '@onekeyhq/shared/src/platformEnv';
import type { ISwapHistoryTradeAgainHandler } from '@onekeyhq/shared/src/routes/swap';
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
  getCachedSwapStockDisplayVariants,
  getCachedSwapStockId,
} from '../../utils/swapStockMarketData';

import type { ScrollViewInstance } from 'react-native';

export const SwapHistoryTradeAgainContext = createContext<
  ISwapHistoryTradeAgainHandler | undefined
>(undefined);

export const useSwapHistoryTradeAgainHandler = () =>
  useContext(SwapHistoryTradeAgainContext);

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
  }: {
    marketStockTrade?: boolean;
    marketNonStockTrade?: boolean;
    swapInitParams?: ISwapInitParams;
    locale: string;
  },
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
