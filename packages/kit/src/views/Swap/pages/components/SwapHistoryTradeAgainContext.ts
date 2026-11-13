import { createContext, useContext } from 'react';

import type { ISwapInitParams } from '@onekeyhq/shared/types/swap/types';

import { buildSwapInitParamsConsumptionKey } from '../../utils/swapColdStartTokenCacheUtils';

export type ISwapHistoryTradeAgainHandler = (
  params: ISwapInitParams,
) => boolean;

export const SwapHistoryTradeAgainContext = createContext<
  ISwapHistoryTradeAgainHandler | undefined
>(undefined);

export const useSwapHistoryTradeAgainHandler = () =>
  useContext(SwapHistoryTradeAgainContext);

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
