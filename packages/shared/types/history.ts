import type { ETranslations } from '@onekeyhq/shared/src/locale';

import type { IAccountNFT } from './nft';
import type { IStakingInfo } from './staking';
import type { IToken } from './token';
import type { IDecodedTx, IReplacedTxType } from './tx';

export enum EHistoryTxDetailsBlock {
  Flow = 'Flow',
  Attributes = 'Attributes',
}

export enum EOnChainHistoryTransferType {
  Transfer,
  Approve,
}

export enum EOnChainHistoryTxStatus {
  Failed = '0',
  Success = '1',
}

export enum EOnChainHistoryTxType {
  Send = 'Send',
  Receive = 'Receive',
  Approve = 'Approve',
}

export type IOnChainHistoryTxApprove = {
  amount: string;
  spender: string;
  token: string;
  isInfiniteAmount: boolean;
};

export type IOnChainHistoryTxTransfer = {
  type: EOnChainHistoryTransferType;
  from: string;
  to: string;
  token: string;
  amount: string;
  label: string;
  isNative?: boolean;
  isOwn?: boolean; // for UTXO
};

export type IOnChainHistoryTxUTXOInput = {
  txid: string;
  vout: number;
  sequence: number;
  n: number;
  addresses: string[];
  isAddress: boolean;
  value: string;
  hex: string;
};

export type IOnChainHistoryTxUTXOOutput = {
  value: string;
  n: number;
  spent: boolean;
  spentTxId: string;
  spentIndex: number;
  spentHeight: number;
  hex: string;
  addresses: string[];
  isAddress: boolean;
};

export type IOnChainHistoryTx = {
  tx: string;
  riskLevel: number;
  type: EOnChainHistoryTxType;
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
  label: string;
  confirmations?: number;
  inputs?: IOnChainHistoryTxUTXOInput[];
  outputs?: IOnChainHistoryTxUTXOOutput[];

  tokenApprove?: IOnChainHistoryTxApprove;
  // TODO: on chain swap info
  swapInfo?: any;

  // Lightning network attributes
  description?: string;
  preimage?: string;
};

export type IAccountHistoryTx = {
  id: string; // historyId

  isLocalCreated?: boolean;

  replacedPrevId?: string; // cancel speedUp replacedId
  replacedNextId?: string;
  replacedType?: IReplacedTxType; // cancel speedUp

  decodedTx: IDecodedTx;
  stakingInfo?: IStakingInfo;
};

export type IHistoryListSectionGroup = {
  title?: string;
  titleKey?: ETranslations;
  data: IAccountHistoryTx[];
};

export type IFetchAccountHistoryParams = {
  accountId: string;
  networkId: string;
  accountAddress: string;
  xpub?: string;
  tokenIdOnNetwork?: string;
  onChainHistoryDisabled?: boolean;
  saveConfirmedTxsEnabled?: boolean;
};

export type IOnChainHistoryTxToken = {
  info: IToken;
  price: string;
};

export type IOnChainHistoryTxNFT = IAccountNFT;

export type IFetchAccountHistoryResp = {
  data: IOnChainHistoryTx[];
  tokens: Record<string, IOnChainHistoryTxToken>; // <tokenAddress, token>
  nfts: Record<string, IOnChainHistoryTxNFT>; // <nftAddress, nft>
};

export type IFetchHistoryTxDetailsParams = {
  networkId: string;
  txid: string;
  accountAddress?: string;
  xpub?: string;
};

export type IFetchTxDetailsParams = {
  networkId: string;
  txid: string;
  accountId: string;
};

export type IFetchHistoryTxDetailsResp = {
  data: IOnChainHistoryTx;
  tokens: Record<string, IOnChainHistoryTxToken>; // <tokenAddress, token>
  nfts: Record<string, IOnChainHistoryTxNFT>; // <nftAddress, nft>
};

export type IHistoryTxMetaProps = {
  decodedTx: IDecodedTx;
};

export type IHistoryTxMetaComponents = {
  [EHistoryTxDetailsBlock.Flow]?: (
    props: IHistoryTxMetaProps,
  ) => JSX.Element | null;
  [EHistoryTxDetailsBlock.Attributes]?: (
    props: IHistoryTxMetaProps,
  ) => JSX.Element | null;
};
