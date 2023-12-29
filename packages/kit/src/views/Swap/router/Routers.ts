import type { ISwapNetwork, ISwapTxHistory } from '../types';

export enum EModalSwapRoutes {
  SwapTokenSelect = 'SwapTokenSelect',
  SwapNetworkSelect = 'SwapNetworkSelect',
  SwapProviderSelect = 'SwapProviderSelect',
  SwapSlippageSelect = 'SwapSlippageSelect',
  SwapHistoryList = 'SwapHistoryList',
  SwapHistoryDetail = 'SwapHistoryDetail',
  SwapBuildTxDemo = 'SwapBuildTxDemo',
}

export type IModalSwapParamList = {
  [EModalSwapRoutes.SwapTokenSelect]: { type: 'from' | 'to' };
  [EModalSwapRoutes.SwapNetworkSelect]: {
    setCurrentSelectNetwork: (network: ISwapNetwork) => void;
  };
  [EModalSwapRoutes.SwapProviderSelect]: undefined;
  [EModalSwapRoutes.SwapSlippageSelect]: undefined;
  [EModalSwapRoutes.SwapBuildTxDemo]: undefined;
  [EModalSwapRoutes.SwapHistoryList]: undefined;
  [EModalSwapRoutes.SwapHistoryDetail]: {
    txHistory: ISwapTxHistory;
  };
};
