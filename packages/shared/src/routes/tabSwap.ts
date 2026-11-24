import type { ISwapTabPrefill } from '../../types/swap/types';

export enum ETabSwapRoutes {
  TabSwap = 'TabSwap',
}

export type ITabSwapParamList = {
  [ETabSwapRoutes.TabSwap]:
    | { tab?: string; swapPrefill?: ISwapTabPrefill }
    | undefined;
};
