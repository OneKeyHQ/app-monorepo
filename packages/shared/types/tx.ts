import type { IEncodedTx } from '@onekeyhq/core/src/types';

import type { IToken } from './token';

export enum EDecodedTxDirection {
  IN = 'IN', // received
  OUT = 'OUT', // sent
  SELF = 'SELF', // sent to self
  OTHER = 'OTHER',
}
export enum EDecodedTxActionType {
  // Native currency transfer
  NATIVE_TRANSFER = 'NATIVE_TRANSFER',

  // Token
  TOKEN_TRANSFER = 'TOKEN_TRANSFER',
  TOKEN_APPROVE = 'TOKEN_APPROVE',
  TOKEN_ACTIVATE = 'TOKEN_ACTIVATE',

  // NFT
  NFT_TRANSFER = 'NFT_TRANSFER',
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

  totalFeeInNative?: string;

  interactInfo?: IDecodedTxInteractInfo;

  extraInfo: null;

  encodedTx?: IEncodedTx;
  // used for speed up double check if encodedTx modified by some bugs
  encodedTxEncrypted?: string;
  payload?: any;

  tokenIdOnNetwork?: string; // indicates this tx belongs to which token
};

export type IDecodedTxActionBase = {
  nativeAmount?: string;
  nativeAmountValue?: string;
};

export type IDecodedTxActionFunctionCall = IDecodedTxActionBase & {
  target: string; // contractAddress
  functionName: string; // approve
  functionHash?: string; // 0x095ea7b3
  functionSignature?: string; // approve(address, amount)
  args: any[];
};

export type IDecodedTxActionNativeTransfer = IDecodedTxActionBase & {
  tokenInfo: IToken;
  from: string;
  to: string;
  amount: string;
  amountValue: string;
  isInscribeTransfer?: boolean;
};
export type IDecodedTxActionTokenTransfer = IDecodedTxActionBase & {
  tokenInfo: IToken;
  from: string;
  to: string;
  amount: string;
  amountValue: string;
};
export type IDecodedTxActionTokenApprove = IDecodedTxActionBase & {
  tokenInfo: IToken;
  owner: string;
  spender: string;
  amount: string;
  amountValue: string;
  isMax: boolean;
};
export type IDecodedTxActionTokenActivate = IDecodedTxActionBase & {
  tokenAddress: string;
  logoURI: string;
  decimals: number;
  name: string;
  symbol: string;
  networkId: string;
};

export type IDecodedTxAction = {
  type: EDecodedTxActionType;
  hidden?: boolean;
  nativeTransfer?: IDecodedTxActionNativeTransfer;
  tokenTransfer?: IDecodedTxActionTokenTransfer;
  tokenApprove?: IDecodedTxActionTokenApprove;
  tokenActivate?: IDecodedTxActionTokenActivate;
  functionCall?: IDecodedTxActionFunctionCall;
};
