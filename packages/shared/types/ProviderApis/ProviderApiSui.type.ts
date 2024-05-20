import type {
  ExecuteTransactionRequestType,
  SignedTransaction,
  SuiTransactionBlockResponseOptions,
} from '@mysten/sui.js';

type IIdentifierString = `${string}:${string}`;
type IIdentifierArray = readonly IIdentifierString[];
type IWalletIcon = `data:image/${
  | 'svg+xml'
  | 'webp'
  | 'png'
  | 'gif'};base64,${string}`;

interface IWalletAccount {
  readonly address: string;
  readonly publicKey: Uint8Array;
  readonly chains: IIdentifierArray;
  readonly features: IIdentifierArray;
  readonly label?: string;
  readonly icon?: IWalletIcon;
}

export type ISignAndExecuteTransactionBlockInput = {
  blockSerialize: string;
  walletSerialize: string;
  account: IWalletAccount;
  chain: IIdentifierString;
  requestType?: ExecuteTransactionRequestType;
  options?: SuiTransactionBlockResponseOptions;
};

export type ISignTransactionBlockInput = {
  blockSerialize: string;
  walletSerialize: string;
  account: IWalletAccount;
  chain: IIdentifierString;
};

export type ISignTransactionBlockOutput = SignedTransaction;

export type ISignMessageInput = {
  messageSerialize: string;
  walletSerialize: string;
  account: IWalletAccount;
};
