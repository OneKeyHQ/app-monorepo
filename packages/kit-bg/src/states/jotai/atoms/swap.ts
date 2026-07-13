import { ESwapTabSwitchType } from '@onekeyhq/shared/types/swap/types';
import type {
  IMarketPresetTokenContext,
  ISwapToken,
} from '@onekeyhq/shared/types/swap/types';

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
    marketPresetToken?: IMarketPresetTokenContext;
  }>({
    name: EAtomNames.swapProJumpTokenAtom,
    initialValue: {
      token: undefined,
      direction: ESwapProJumpTokenDirection.BUY,
      marketPresetToken: undefined,
    },
  });

export const {
  target: swapFromMarketJumpTokenAtom,
  use: useSwapFromMarketJumpTokenAtom,
} = globalAtom<{
  token: ISwapToken | undefined;
  otherToken?: ISwapToken | undefined;
  amount?: string;
  type: ESwapTabSwitchType;
  direction: 'from' | 'to';
}>({
  name: EAtomNames.swapFromMarketJumpTokenAtom,
  initialValue: {
    token: undefined,
    otherToken: undefined,
    type: ESwapTabSwitchType.SWAP,
    direction: 'from',
  },
});
