import type { IAccountSelectorContextData } from '../../../states/jotai/contexts/accountSelector';

export enum EChainSelectorPages {
  ChainSelector = 'ChainSelector',
}

export type IChainSelectorParamList = {
  [EChainSelectorPages.ChainSelector]: IAccountSelectorContextData & {
    num: number;
  };
};
