import type { IEncodedTxBtc } from '@onekeyhq/core/src/chains/btc/types';
import type { IAccountDeriveTypes } from '@onekeyhq/kit-bg/src/vaults/types';
import type { IAccountHistoryTx } from '@onekeyhq/shared/types/history';
import type { IToken } from '@onekeyhq/shared/types/token';

export enum EModalAssetDetailRoutes {
  TokenDetails = 'TokenDetails',
  NFTDetails = 'NFTDetails',
  HistoryDetails = 'HistoryDetail',
  UTXODetails = 'UTXODetails',
}

export type IModalAssetDetailsParamList = {
  [EModalAssetDetailRoutes.TokenDetails]: {
    accountId: string;
    networkId: string;
    walletId: string;
    addressType: string;
    deriveType: IAccountDeriveTypes;
    tokenInfo: IToken;
    isBlocked?: boolean;
    riskyTokens?: string[];
  };
  [EModalAssetDetailRoutes.NFTDetails]: {
    networkId: string;
    accountId: string;
    accountAddress: string;
    collectionAddress: string;
    itemId: string;
  };
  [EModalAssetDetailRoutes.HistoryDetails]: {
    networkId: string;
    accountAddress: string;
    historyTx: IAccountHistoryTx;
  };
  [EModalAssetDetailRoutes.UTXODetails]: {
    inputs: IEncodedTxBtc['inputs'];
    outputs: IEncodedTxBtc['outputs'];
  };
};
