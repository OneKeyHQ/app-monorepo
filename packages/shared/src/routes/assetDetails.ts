import type {
  IAccountDeriveInfo,
  IAccountDeriveTypes,
} from '@onekeyhq/kit-bg/src/vaults/types';
import type { IAccountHistoryTx } from '@onekeyhq/shared/types/history';
import type { IToken } from '@onekeyhq/shared/types/token';

import type { IUtxoAddressInfo } from '../../types/tx';

export enum EModalAssetDetailRoutes {
  TokenDetails = 'TokenDetails',
  NFTDetails = 'NFTDetails',
  HistoryDetails = 'HistoryDetails',
  UTXODetails = 'UTXODetails',
}

export type IModalAssetDetailsParamList = {
  [EModalAssetDetailRoutes.TokenDetails]: {
    accountId: string;
    networkId: string;
    walletId: string;
    deriveInfo: IAccountDeriveInfo;
    deriveType: IAccountDeriveTypes;
    tokenInfo: IToken;
    isBlocked?: boolean;
    riskyTokens?: string[];
    isAllNetworks?: boolean;
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
    historyTx: IAccountHistoryTx | undefined;
    isAllNetworks?: boolean;
    checkIsFocused?: boolean;
  };
  [EModalAssetDetailRoutes.UTXODetails]: {
    accountId: string;
    networkId: string;
    txId: string;
    inputs?: IUtxoAddressInfo[];
    outputs?: IUtxoAddressInfo[];
  };
};
