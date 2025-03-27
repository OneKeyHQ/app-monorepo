import type { EJotaiContextStoreNames } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import type { IAccountDeriveTypes } from '@onekeyhq/kit-bg/src/vaults/types';
import type {
  EProtocolOfExchange,
  ESwapDirectionType,
  ESwapSource,
  ESwapTabSwitchType,
  IFetchLimitOrderRes,
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
  SwapLazyMarketModal = 'SwapLazyMarketModal',
  LimitOrderDetail = 'LimitOrderDetail',
}

export type IModalSwapParamList = {
  [EModalSwapRoutes.SwapMainLand]: {
    importFromToken?: ISwapToken;
    importToToken?: ISwapToken;
    importNetworkId?: string;
    swapTabSwitchType?: ESwapTabSwitchType;
    importDeriveType?: IAccountDeriveTypes;
    swapSource?: ESwapSource;
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
  [EModalSwapRoutes.SwapHistoryList]: {
    type?: EProtocolOfExchange;
    storeName: EJotaiContextStoreNames;
  };
  [EModalSwapRoutes.SwapHistoryDetail]: {
    txHistoryOrderId?: string;
    txHistoryList?: ISwapTxHistory[];
    // storeName: EJotaiContextStoreNames;
  };
  [EModalSwapRoutes.LimitOrderDetail]: {
    orderId?: string;
    orderItem?: IFetchLimitOrderRes;
    storeName: EJotaiContextStoreNames;
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
  [EModalSwapRoutes.SwapLazyMarketModal]: {
    coinGeckoId: string;
  };
};
