import type {
  ESwapDirectionType,
  ISwapNetwork,
  ISwapTxHistory,
} from '@onekeyhq/shared/types/swap/types';

export enum EModalSwapRoutes {
  SwapTokenSelect = 'SwapTokenSelect',
  SwapNetworkSelect = 'SwapNetworkSelect',
  SwapProviderSelect = 'SwapProviderSelect',
  SwapSlippageSelect = 'SwapSlippageSelect',
  SwapHistoryList = 'SwapHistoryList',
  SwapHistoryDetail = 'SwapHistoryDetail',
  SwapToAnotherAddress = 'SwapToAnotherAddress',
}

export type IModalSwapParamList = {
  [EModalSwapRoutes.SwapTokenSelect]: { type: ESwapDirectionType };
  [EModalSwapRoutes.SwapNetworkSelect]: {
    setCurrentSelectNetwork: (network: ISwapNetwork) => void;
  };
  [EModalSwapRoutes.SwapProviderSelect]: undefined;
  [EModalSwapRoutes.SwapSlippageSelect]: undefined;
  [EModalSwapRoutes.SwapHistoryList]: undefined;
  [EModalSwapRoutes.SwapHistoryDetail]: {
    txHistory: ISwapTxHistory;
  };
  [EModalSwapRoutes.SwapToAnotherAddress]: { type: ESwapDirectionType };
};
