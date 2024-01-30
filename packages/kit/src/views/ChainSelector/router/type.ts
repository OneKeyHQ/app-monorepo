import type {
  IAccountSelectorAvailableNetworks,
  IAccountSelectorRouteParams,
} from '../../../states/jotai/contexts/accountSelector';

export enum EChainSelectorPages {
  ChainSelector = 'ChainSelector',
}
export type IChainSelectorRouteParams = IAccountSelectorRouteParams &
  IAccountSelectorAvailableNetworks;
export type IChainSelectorParamList = {
  [EChainSelectorPages.ChainSelector]: IChainSelectorRouteParams;
};
