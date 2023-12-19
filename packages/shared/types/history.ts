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
};

export type IOnChainHistoryTxToken = {
  price: number;
  info: IToken;
};
export type IOnChainHistoryTxNFT = IAccountNFT;

export type IOnChainHistoryTxAsset =
  | IOnChainHistoryTxToken
  | IOnChainHistoryTxNFT;

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
  accountAddress: string;
  cursor?: string;
  limit?: number;
};

export type IFetchAccountHistoryResp = {
  data: IOnChainHistoryTx[];
  // <token address | NFT id, asset info>
  tokens: Record<string, IOnChainHistoryTxAsset>;
};
