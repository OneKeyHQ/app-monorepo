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

import type { EEnterWay } from '../logger/scopes/dex';

export enum EModalSwapRoutes {
  SwapMainLand = 'SwapMainLand',
  SwapTokenSelect = 'SwapTokenSelect',
  SwapProSelectToken = 'SwapProSelectToken',
  SwapNetworkSelect = 'SwapNetworkSelect',
  SwapProviderSelect = 'SwapProviderSelect',
  SwapHistoryList = 'SwapHistoryList',
  SwapHistoryDetail = 'SwapHistoryDetail',
  SwapToAnotherAddress = 'SwapToAnotherAddress',
  TokenRiskReminder = 'TokenRiskReminder',
  SwapLazyMarketModal = 'SwapLazyMarketModal',
  LimitOrderDetail = 'LimitOrderDetail',
  SwapProMarketDetail = 'SwapProMarketDetail',
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
    autoSearch?: boolean;
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
  [EModalSwapRoutes.SwapProSelectToken]: {
    storeName: EJotaiContextStoreNames;
    autoSearch?: boolean;
  };
  [EModalSwapRoutes.SwapProMarketDetail]: {
    tokenAddress: string;
    network: string;
    isNative?: boolean;
    from?: EEnterWay;
    disableTrade?: boolean;
  };
};
