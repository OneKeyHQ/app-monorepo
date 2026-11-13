import { createContext, useContext } from 'react';

import { ESwapTabSwitchType } from '@onekeyhq/shared/types/swap/types';
import type {
  ISwapInitParams,
  ISwapToken,
} from '@onekeyhq/shared/types/swap/types';

import { getTokenIdentityKey } from '../../hooks/swapStockChannelUtils';
import { buildSwapInitParamsConsumptionKey } from '../../utils/swapColdStartTokenCacheUtils';

export type ISwapHistoryTradeAgainHandler = (
  params: ISwapInitParams,
) => boolean;

export const SwapHistoryTradeAgainContext = createContext<
  ISwapHistoryTradeAgainHandler | undefined
>(undefined);

export const useSwapHistoryTradeAgainHandler = () =>
  useContext(SwapHistoryTradeAgainContext);

export const SwapInitialSelectionTimeoutContext = createContext(true);

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
  const stocks = [params.importFromToken, params.importToToken].filter(
    (token) => token?.isStock,
  );
  const stock = stocks[0];
  return Boolean(
    stocks.length === 1 &&
    stock?.networkId &&
    controlledStockToken.networkId &&
    (stock.isNative || stock.contractAddress) &&
    (controlledStockToken.isNative || controlledStockToken.contractAddress) &&
    getTokenIdentityKey(stock) === getTokenIdentityKey(controlledStockToken),
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
