import type { EJotaiContextStoreNames } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
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
    importFromToken?: ISwapToken;
    importToToken?: ISwapToken;
    importNetworkId?: string;
  };
  [EModalSwapRoutes.SwapTokenSelect]: {
    type: ESwapDirectionType;
    storeName: EJotaiContextStoreNames;
  };
  [EModalSwapRoutes.SwapNetworkSelect]: {
    setCurrentSelectNetwork: (network: ISwapNetwork) => void;
    storeName: EJotaiContextStoreNames;
  };
  [EModalSwapRoutes.SwapProviderSelect]: { storeName: EJotaiContextStoreNames };
  [EModalSwapRoutes.SwapHistoryList]: { storeName: EJotaiContextStoreNames };
  [EModalSwapRoutes.SwapHistoryDetail]: {
    txHistory: ISwapTxHistory;
    storeName: EJotaiContextStoreNames;
  };
  [EModalSwapRoutes.SwapToAnotherAddress]: {
    address?: string;
    storeName: EJotaiContextStoreNames;
  };
};
