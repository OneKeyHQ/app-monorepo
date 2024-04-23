import type {
  ESwapDirectionType,
  ISwapNetwork,
  ISwapToken,
  ISwapTxHistory,
} from '@onekeyhq/shared/types/swap/types';

export enum EModalSwapRoutes {
  SwapMainLand = 'SwapMainLand',
  SwapTokenSelect = 'SwapTokenSelect',
  SwapNetworkSelect = 'SwapNetworkSelect',
  SwapProviderSelect = 'SwapProviderSelect',
  SwapHistoryList = 'SwapHistoryList',
  SwapHistoryDetail = 'SwapHistoryDetail',
  SwapToAnotherAddress = 'SwapToAnotherAddress',
}

export type IModalSwapParamList = {
  [EModalSwapRoutes.SwapMainLand]: {
    fromToken?: ISwapToken;
    toToken?: ISwapToken;
  };
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
