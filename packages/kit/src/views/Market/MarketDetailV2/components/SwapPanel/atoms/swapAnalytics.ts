import { atom } from 'jotai';

import type { IDBWalletType } from '@onekeyhq/kit-bg/src/dbs/local/types';
import {
  EAmountEnterType,
  ERouter,
  ESlippageSetting,
  ESwapType,
} from '@onekeyhq/shared/src/logger/scopes/dex/types';

// Analytics data type definition
export interface ISwapAnalyticsData {
  walletType: IDBWalletType;
  amountEnterType: EAmountEnterType;
  slippageSetting: ESlippageSetting;
  sourceTokenSymbol: string;
  receivedTokenSymbol: string;
  network: string;
  swapType: ESwapType;
  router: ERouter;
}

// Analytics state type definition
export interface ISwapAnalyticsState {
  // Current analytics data
  currentData: Partial<ISwapAnalyticsData>;
  // Whether initialized
  isInitialized: boolean;
}

// Initial state
const initialState: ISwapAnalyticsState = {
  currentData: {
    amountEnterType: EAmountEnterType.Manual, // Default to manual input
    slippageSetting: ESlippageSetting.Auto, // Default to auto slippage
    sourceTokenSymbol: '',
    receivedTokenSymbol: '',
    network: '',
    swapType: ESwapType.Buy,
    router: ERouter.OKX,
  },
  isInitialized: false,
};

// SwapPanel analytics data atom
export const swapAnalyticsAtom = atom<ISwapAnalyticsState>(initialState);

// Reset analytics data atom
export const resetSwapAnalyticsAtom = atom(null, (get, set) => {
  set(swapAnalyticsAtom, initialState);
});

// Update analytics data atom
export const updateSwapAnalyticsAtom = atom(
  null,
  (get, set, updates: Partial<ISwapAnalyticsData>) => {
    const currentState = get(swapAnalyticsAtom);
    const newState = {
      ...currentState,
      currentData: {
        ...currentState.currentData,
        ...updates,
      },
      isInitialized: true,
    };
    set(swapAnalyticsAtom, newState);
  },
);

// Get complete analytics data atom (only returns when all required fields have values)
export const getCompleteSwapAnalyticsAtom = atom((get) => {
  const state = get(swapAnalyticsAtom);
  const { currentData } = state;

  // Check if all required fields are filled
  const isComplete =
    currentData.sourceTokenSymbol &&
    currentData.receivedTokenSymbol &&
    currentData.network &&
    currentData.walletType;

  return isComplete ? (currentData as ISwapAnalyticsData) : null;
});
