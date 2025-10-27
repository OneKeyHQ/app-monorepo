import type { IAccountHistoryTx } from '@onekeyhq/shared/types/history';
import type { IAccountToken, ITokenFiat } from '@onekeyhq/shared/types/token';

import type { IUtxoAddressInfo } from '../../types/tx';

export enum EModalAssetDetailRoutes {
  TokenDetails = 'AssetDetail_TokenDetails',
  NFTDetails = 'AssetDetail_NFTDetails',
  HistoryDetails = 'AssetDetail_HistoryDetails',
  UTXODetails = 'AssetDetail_UTXODetails',
  MarketDetail = 'AssetDetail_MarketDetail',
}

export type IModalAssetDetailsParamList = {
  [EModalAssetDetailRoutes.TokenDetails]: {
    accountId: string;
    networkId: string;
    walletId: string;
    isBlocked?: boolean;
    riskyTokens?: string[];
    isAllNetworks?: boolean;
    indexedAccountId: string;
    tokenInfo: IAccountToken;
    aggregateTokens?: IAccountToken[];
    tokenMap?: Record<string, ITokenFiat>;
    accountAddress?: string;
  };
  [EModalAssetDetailRoutes.MarketDetail]: {
    token: string;
  };
  [EModalAssetDetailRoutes.NFTDetails]: {
    networkId: string;
    accountId: string;
    walletId: string;
    collectionAddress: string;
    itemId: string;
  };
  [EModalAssetDetailRoutes.HistoryDetails]: {
    accountId: string;
    networkId: string;
    transactionHash?: string;
    accountAddress?: string;
    notificationId?: string;
    notificationAccountId?: string;
    historyTx: IAccountHistoryTx | undefined;
    isAllNetworks?: boolean;
    checkIsFocused?: boolean;
    allowClickAccountNameSwitch?: boolean;
  };
  [EModalAssetDetailRoutes.UTXODetails]: {
    accountId: string;
    networkId: string;
    txId: string;
    inputs?: IUtxoAddressInfo[];
    outputs?: IUtxoAddressInfo[];
  };
};
