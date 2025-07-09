import BigNumber from 'bignumber.js';
import { atom } from 'jotai';

import type { ISwapTokenBase } from '@onekeyhq/shared/types/swap/types';

import type { IToken } from '../types';

// Core state atoms
export const paymentAmountAtom = atom<BigNumber>(new BigNumber(0));
export const antiMEVAtom = atom<boolean>(false);
export const paymentTokenAtom = atom<IToken | undefined>(undefined);
export const networkIdAtom = atom<string | undefined>(undefined);
export const slippageAtom = atom<number>(0.5);

// Balance and tokens atoms
export const balanceAtom = atom<BigNumber>(new BigNumber(0));
export const balanceTokenAtom = atom<ISwapTokenBase | undefined>(undefined);
export const fetchBalanceLoadingAtom = atom<boolean>(false);
export const baseTokenAtom = atom<ISwapTokenBase | undefined>(undefined);
export const defaultTokensAtom = atom<IToken[]>([]);

// Price and rate atoms
export const priceRateAtom = atom<
  | {
      rate: number;
      fromTokenSymbol: string;
      toTokenSymbol: string;
    }
  | undefined
>(undefined);

// Loading states atoms
export const speedSwapBuildTxLoadingAtom = atom<boolean>(false);
export const checkTokenAllowanceLoadingAtom = atom<boolean>(false);
export const speedSwapInitLoadingAtom = atom<boolean>(false);

// Approval states atoms
export const shouldApproveAtom = atom<boolean>(false);
export const shouldResetApproveAtom = atom<boolean>(false);

// Config atoms
export const supportSpeedSwapAtom = atom<boolean>(false);
export const providerAtom = atom<string>('');
export const spenderAddressAtom = atom<string>('');
export const swapMevNetConfigAtom = atom<string[]>([]);

// Derived state atoms
export const isLoadingAtom = atom<boolean>((get) => {
  return (
    get(fetchBalanceLoadingAtom) ||
    get(speedSwapBuildTxLoadingAtom) ||
    get(checkTokenAllowanceLoadingAtom) ||
    get(speedSwapInitLoadingAtom)
  );
});

export const isApprovedAtom = atom<boolean>((get) => {
  return !get(shouldApproveAtom);
});
