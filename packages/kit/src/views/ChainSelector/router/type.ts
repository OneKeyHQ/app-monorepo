import type { IAccountSelectorRouteParams } from '../../../states/jotai/contexts/accountSelector';

export enum EChainSelectorPages {
  ChainSelector = 'ChainSelector',
}

export type IChainSelectorParamList = {
  [EChainSelectorPages.ChainSelector]: IAccountSelectorRouteParams;
};
