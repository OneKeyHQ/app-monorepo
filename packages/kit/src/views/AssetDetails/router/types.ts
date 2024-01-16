import type { IEncodedTxBtc } from '@onekeyhq/core/src/chains/btc/types';
import type { IAccountHistoryTx } from '@onekeyhq/shared/types/history';

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
    tokenAddress: string;
    tokenSymbol?: string;
    tokenLogoURI?: string;
    isNative?: boolean;
  };
  [EModalAssetDetailRoutes.NFTDetails]: {
    networkId: string;
    accountAddress: string;
    collectionAddress: string;
    itemId: string;
  };
  [EModalAssetDetailRoutes.HistoryDetails]: {
    networkId: string;
    historyTx: IAccountHistoryTx;
  };
  [EModalAssetDetailRoutes.UTXODetails]: {
    inputs: IEncodedTxBtc['inputs'];
    outputs: IEncodedTxBtc['outputs'];
  };
};
