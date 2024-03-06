import type { IEncodedTx, ISignedTxPro } from '@onekeyhq/core/src/types';

import type { IFeeInfoUnit } from './fee';

export enum EDecodedTxDirection {
  IN = 'IN', // received
  OUT = 'OUT', // sent
  SELF = 'SELF', // sent to self
  OTHER = 'OTHER',
}

export type IReplacedTxType = 'speedUp' | 'cancel';

export enum EDecodedTxActionType {
  ASSET_TRANSFER = 'ASSET_TRANSFER',

  // Token
  TOKEN_APPROVE = 'TOKEN_APPROVE',
  TOKEN_ACTIVATE = 'TOKEN_ACTIVATE',

  // NFT
  NFT_MINT = 'NFT_MINT',
  NFT_SALE = 'NFT_SALE',
  NFT_BURN = 'NFT_BURN',

  // Swap
  INTERNAL_SWAP = 'INTERNAL_SWAP',
  INTERNAL_STAKE = 'INTERNAL_STAKE',

  // Contract Interaction
  FUNCTION_CALL = 'FUNCTION_CALL',

  // other
  UNKNOWN = 'UNKNOWN',
}
export enum EDecodedTxStatus {
  Pending = 'Pending',
  Confirmed = 'Confirmed',
  Failed = 'Failed',
  Dropped = 'Dropped',
  Removed = 'Removed',
  // for btc list order psbt
  Offline = 'Offline',
}

export type ISendTxBaseParams = {
  networkId: string;
  accountId: string;
};

export type IDecodedTxInteractInfo = {
  // Dapp info
  name: string;
  url: string;
  description: string;
  icons: string[];
  provider?: string;
};

export type IDecodedTx = {
  txid: string; // blockHash

  owner: string; // tx belongs to both receiver and sender
  signer: string; // creator, sender, fromAddress
  // receiver: string; // receiver, toAddress

  nonce: number;
  actions: IDecodedTxAction[]; // inputActions
  outputActions?: IDecodedTxAction[];

  createdAt?: number;
  updatedAt?: number; // finishedAt, signedAt, blockSignedAt

  status: EDecodedTxStatus;
  // data wont change anymore
  isFinal?: boolean;

  networkId: string;
  accountId: string;

  feeInfo?: IFeeInfoUnit;
  totalFeeInNative?: string;
  totalFeeFiatValue?: string;

  interactInfo?: IDecodedTxInteractInfo;

  extraInfo: null;

  encodedTx?: IEncodedTx;
  // used for speed up double check if encodedTx modified by some bugs
  encodedTxEncrypted?: string;
  payload?: any;

  tokenIdOnNetwork?: string; // indicates this tx belongs to which token
  nativeAmount?: string;
  nativeAmountValue?: string;
};

export type IDecodedTxActionBase = {
  nativeAmount?: string;
  nativeAmountValue?: string;
  from: string;
  to: string;
  icon?: string;
};

export type IDecodedTxActionUnknown = IDecodedTxActionBase;

export type IDecodedTxTransferInfo = {
  from: string;
  to: string;
  amount: string;
  icon: string;
  symbol: string;
  tokenIdOnNetwork: string;
  isNative?: boolean;
  isNFT?: boolean;
  label?: string;
  price?: string;
};

export type IDecodedTxActionFunctionCall = IDecodedTxActionBase & {
  functionName: string; // approve
  functionHash?: string; // 0x095ea7b3
  functionSignature?: string; // approve(address, amount)
  args: any[];
};

export type IDecodedTxActionAssetTransfer = IDecodedTxActionBase & {
  sends: IDecodedTxTransferInfo[];
  receives: IDecodedTxTransferInfo[];
  label?: string;
};

export type IDecodedTxActionTokenApprove = IDecodedTxActionBase & {
  amount: string;
  symbol: string;
  name: string;
  isMax: boolean;
  tokenIdOnNetwork: string;
  label?: string;
};

export type IDecodedTxActionTokenActivate = IDecodedTxActionBase & {
  tokenAddress: string;
  decimals: number;
  name: string;
  symbol: string;
  tokenIdOnNetwork: string;
  networkId: string;
};

export type IDecodedTxAction = {
  type: EDecodedTxActionType;
  direction?: EDecodedTxDirection;
  hidden?: boolean;

  assetTransfer?: IDecodedTxActionAssetTransfer;
  tokenApprove?: IDecodedTxActionTokenApprove;
  tokenActivate?: IDecodedTxActionTokenActivate;

  functionCall?: IDecodedTxActionFunctionCall;

  unknownAction?: IDecodedTxActionUnknown;
};

export type ISendTxOnSuccessData = {
  signedTx: ISignedTxPro;
  decodedTx: IDecodedTx;
};
