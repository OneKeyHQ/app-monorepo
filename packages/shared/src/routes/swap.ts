import type { EJotaiContextStoreNames } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import type {
  ESwapDirectionType,
  ESwapTabSwitchType,
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
  TokenRiskReminder = 'TokenRiskReminder',
}

export type IModalSwapParamList = {
  [EModalSwapRoutes.SwapMainLand]: {
    importFromToken?: ISwapToken;
    importToToken?: ISwapToken;
    importNetworkId?: string;
    swapTabSwitchType?: ESwapTabSwitchType;
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
  [EModalSwapRoutes.SwapHistoryList]: undefined;
  [EModalSwapRoutes.SwapHistoryDetail]: {
    txHistory: ISwapTxHistory;
    // storeName: EJotaiContextStoreNames;
  };
  [EModalSwapRoutes.SwapToAnotherAddress]: {
    address?: string;
    storeName: EJotaiContextStoreNames;
  };
  [EModalSwapRoutes.TokenRiskReminder]: {
    storeName: EJotaiContextStoreNames;
    token: ISwapToken;
    onConfirm: () => void;
  };
};
