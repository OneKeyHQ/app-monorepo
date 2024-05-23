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

export type IPushTxParams = {
  rawTx: string;
};
export type ISignPsbtParams = {
  psbtHex: string;
  options: { autoFinalized: boolean; isBtcWalletProvider: boolean };
};

export type ISignPsbtsParams = {
  psbtHexs: string[];
  options: { autoFinalized: boolean; isBtcWalletProvider: boolean };
};

export type IPushPsbtParams = {
  psbtHex: string;
};

export type ITxInscription = {
  inscriptionId: string;
  inscriptionNumber: number;
  address: string;
  outputValue: number;
  preview: string;
  content: string;
  contentLength: number;
  contentType: string;
  contentBody: string;
  timestamp: number;
  genesisTransaction: string;
  location: string;
  output: string;
  offset: number;
};

export type IDecodedPsbt = {
  inputInfos: {
    txid: string;
    vout: number;
    address: string;
    value: number;
    sighashType?: number;
    inscriptions: ITxInscription[];
  }[];
  outputInfos: {
    address: string;
    value: number;
    inscriptions: ITxInscription[];
  }[];
  inscriptions: Record<string, ITxInscription>;
  feeRate: string;
  fee: string;
  hasScammerAddress: boolean;
  warning: string;
};
