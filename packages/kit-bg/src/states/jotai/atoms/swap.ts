import type { ISwapToken } from '@onekeyhq/shared/types/swap/types';

import { EAtomNames } from '../atomNames';
import { globalAtom } from '../utils';

export enum ESwapProJumpTokenDirection {
  BUY = 'buy',
  SELL = 'sell',
}

export const { target: swapProJumpTokenAtom, use: useSwapProJumpTokenAtom } =
  globalAtom<{
    token: ISwapToken | undefined;
    direction: ESwapProJumpTokenDirection;
  }>({
    name: EAtomNames.swapProJumpTokenAtom,
    initialValue: {
      token: undefined,
      direction: ESwapProJumpTokenDirection.BUY,
    },
  });
