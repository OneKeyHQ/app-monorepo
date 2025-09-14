import { atom } from 'jotai';

import {
  EAmountEnterType,
  ESlippageSetting,
} from '@onekeyhq/shared/src/logger/scopes/dex/types';

// Simplified analytics state - only store user input settings
export interface ISwapAnalyticsState {
  amountEnterType: EAmountEnterType;
  slippageSetting: ESlippageSetting;
}

// Initial state
const initialState: ISwapAnalyticsState = {
  amountEnterType: EAmountEnterType.Manual, // Default to manual input
  slippageSetting: ESlippageSetting.Auto, // Default to auto slippage
};

// SwapPanel analytics data atom
export const swapAnalyticsAtom = atom<ISwapAnalyticsState>(initialState);

// Reset analytics data atom
export const resetSwapAnalyticsAtom = atom(null, (_, set) => {
  set(swapAnalyticsAtom, initialState);
});

// Update analytics data atom
export const updateSwapAnalyticsAtom = atom(
  null,
  (get, set, updates: Partial<ISwapAnalyticsState>) => {
    const currentState = get(swapAnalyticsAtom);
    const newState = {
      ...currentState,
      ...updates,
    };
    set(swapAnalyticsAtom, newState);
  },
);
