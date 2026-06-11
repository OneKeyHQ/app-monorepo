import type {
  ExecuteTransactionRequestType,
  SuiTransactionBlockResponse,
  SuiTransactionBlockResponseOptions,
} from '@mysten/sui/jsonRpc';
import type {
  SignedTransaction,
  SuiSignAndExecuteTransactionInput,
  SuiSignTransactionInput,
} from '@mysten/wallet-standard';

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
// TODO: ISignTransactionBlockOutput type
export type ISignTransactionBlockOutput = any;

export type ISignMessageInput = {
  messageSerialize: string;
  walletSerialize: string;
  account: IWalletAccount;
};

export type IPushTxParams = {
  rawTx: string;
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

export interface ISuiSignMessageOutput {
  messageBytes: string;
  signature: string;
}

export type IOneKeySuiSignTransactionInput = Omit<
  SuiSignTransactionInput,
  'transaction' | 'signal'
> & {
  transaction: string;
};

export type IOneKeySuiSignTransactionOutput = SignedTransaction;

export type IOneKeySuiSignAndExecuteTransactionInput = Omit<
  SuiSignAndExecuteTransactionInput,
  'transaction' | 'signal'
> & {
  transaction: string;
};

// wallet-standard's SuiSignAndExecuteTransactionBlockOutput is typed against
// its own nested sui sdk 1.x; alias to our 2.x response type (same runtime shape)
export type IOneKeySuiSignAndExecuteTransactionOutput =
  SuiTransactionBlockResponse;
