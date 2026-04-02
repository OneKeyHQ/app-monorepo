import type { ISwapTokenBase } from '@onekeyhq/shared/types/swap/types';

export type IToken = ISwapTokenBase & {
  speedSwapDefaultAmount: number[];
};
