import type {
  ESwapDirectionType,
  ISwapNetwork,
  ISwapTxHistory,
} from '@onekeyhq/shared/types/swap/types';

export enum EModalSwapRoutes {
  SwapTokenSelect = 'SwapTokenSelect',
  SwapNetworkSelect = 'SwapNetworkSelect',
  SwapProviderSelect = 'SwapProviderSelect',
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
  [EModalSwapRoutes.SwapHistoryList]: undefined;
  [EModalSwapRoutes.SwapHistoryDetail]: {
    txHistory: ISwapTxHistory;
  };
  [EModalSwapRoutes.SwapToAnotherAddress]: { address?: string };
};
