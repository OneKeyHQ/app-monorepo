import type { ILocaleIds } from '@onekeyhq/components';

import type { IAccountNFT } from './nft';
import type { IToken } from './token';
import type { IDecodedTx, IReplacedTxType } from './tx';

export enum EOnChainHistoryTransferType {
  Transfer,
  Approve,
}

export enum EOnChainHistoryTxStatus {
  Failed = '0',
  Success = '1',
}

export type IOnChainHistoryTxTransfer = {
  type: EOnChainHistoryTransferType;
  from: string;
  to: string;
  token: string;
  amount: string;
  label: IOnChainHistoryTxLabel;
  info: IToken | IAccountNFT;
};

export type IOnChainHistoryTxLabel = {
  label: string;
  riskLevel: number;
};

export type IOnChainHistoryTx = {
  tx: string;
  riskLevel: number;
  type: string;
  sends: IOnChainHistoryTxTransfer[];
  receives: IOnChainHistoryTxTransfer[];
  status: EOnChainHistoryTxStatus;
  from: string;
  to: string;
  timestamp: number;
  nonce: number;
  gasFee: string;
  gasFeeFiatValue: string;
  functionCode: string;
  params: string[];
  value: string;
  label: IOnChainHistoryTxLabel;
};

export type IAccountHistoryTx = {
  id: string; // historyId

  isLocalCreated?: boolean;

  replacedPrevId?: string; // cancel speedUp replacedId
  replacedNextId?: string;
  replacedType?: IReplacedTxType; // cancel speedUp

  decodedTx: IDecodedTx;
};

export type IHistoryListSectionGroup = {
  title?: string;
  titleKey?: ILocaleIds;
  data: IAccountHistoryTx[];
};

export type IFetchAccountHistoryParams = {
  accountId: string;
  networkId: string;
  tokenAddress?: string;
};

export type IFetchAccountHistoryResp = {
  data: {
    date: string;
    items: IOnChainHistoryTx[];
  }[];
};
