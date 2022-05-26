import type { Engine } from '../index';
import type { EIP1559Fee, Network } from '../types/network';
import type { Token } from '../types/token';
import type {
  IDecodedTxExtraBtc,
  IEncodedTxBtc,
  INativeTxBtc,
} from './impl/btc/types';
import type { EVMDecodedItem } from './impl/evm/decoder/decoder';
import type {
  IDecodedTxExtraNear,
  IEncodedTxNear,
  INativeTxNear,
} from './impl/near/types';
import type { UnsignedTx } from '@onekeyfe/blockchain-libs/dist/types/provider';

// Options ----------------------------------------------
export type IVaultSettings = {
  feeInfoEditable: boolean;
  privateKeyExportEnabled: boolean;

  importedAccountEnabled: boolean;
  watchingAccountEnabled: boolean;
  hardwareAccountEnabled: boolean;
};
export type IVaultFactoryOptions = {
  networkId: string;
  accountId: string;
  walletId?: string;
};
export type IVaultOptions = IVaultFactoryOptions & {
  engine: Engine;
};
export type ISignCredentialOptions = {
  password?: string;
};

// Internal txInfo ----------------------------------------------
export type ITransferInfo = {
  from: string;
  to: string;
  amount: string;
  token?: string;
  max?: boolean;
};
export type IApproveInfo = {
  from: string; // token owner
  token: string; // token address
  amount: string; // amount
  spender: string; // spender to authorize
};

// EncodedTx\RawTx\SignedTx ----------------------------------------------
export type IEncodedTx = any | IEncodedTxNear | IEncodedTxBtc;
export type INativeTx = any | INativeTxNear | INativeTxBtc;
export type IRawTx = string;
export type IUnsignedTx = UnsignedTx;
export type ISignedTx = {
  txid: string;
  rawTx: string;
};

// EncodedTx Update ----------------------------------------------
export enum IEncodedTxUpdateType {
  transfer = 'transfer',
  tokenApprove = 'tokenApprove',
  speedUp = 'speedUp',
  cancel = 'cancel',
}
export type IEncodedTxUpdateOptions = {
  type?: IEncodedTxUpdateType;
};
export type IEncodedTxUpdatePayloadTokenApprove = {
  amount: string;
};
export type IEncodedTxUpdatePayloadTransfer = {
  amount: string;
};

// FeeInfo ----------------------------------------------
export type IFeeInfoPrice = string | EIP1559Fee;
// TODO rename to IFeeInfoValue, IFeeInfoData, IFeeInfoDetail
export type IFeeInfoUnit = {
  eip1559?: boolean;
  price?: IFeeInfoPrice;
  limit?: string;
};
// TODO rename to IFeeInfoMeta
export type IFeeInfo = {
  // TODO merge (limit, prices, EIP1559Fee) to single field
  limit?: string; // calculated gasLimit of encodedTx
  prices: Array<IFeeInfoPrice>; // preset gasPrices: normal, fast, rapid
  symbol?: string; // feeSymbol: GWEI
  decimals?: number; // feeDecimals: 9
  nativeSymbol?: string; // ETH
  nativeDecimals?: number; // 18
  // TODO rename to feeInTx
  tx?: IFeeInfoUnit | null;
  eip1559?: boolean;
};
export type IFeeInfoSelectedType = 'preset' | 'custom';
export type IFeeInfoSelected = {
  type: IFeeInfoSelectedType;
  preset: string; // '0' | '1' | '2';
  custom?: IFeeInfoUnit;
};
export type IFeeInfoPayload = {
  selected: IFeeInfoSelected;
  info: IFeeInfo;
  current: {
    total: string; // total fee in Gwei
    totalNative: string; // total fee in ETH
    value: IFeeInfoUnit;
  };
};

// PrepareAccounts ----------------------------------------------
export type IPrepareWatchingAccountsParams = {
  target: string;
  name: string;
};
export type IPrepareImportedAccountsParams = {
  privateKey: Buffer;
  name: string;
};
export type IPrepareSoftwareAccountsParams = {
  password: string;
  indexes: Array<number>;
  purpose?: number;
  names?: Array<string>;
};
export type IPrepareHardwareAccountsParams = {
  type: 'SEARCH_ACCOUNTS' | 'ADD_ACCOUNTS';
  indexes: Array<number>;
  purpose?: number;
  names?: Array<string>;
};
export type IPrepareAccountsParams =
  | IPrepareWatchingAccountsParams
  | IPrepareImportedAccountsParams
  | IPrepareSoftwareAccountsParams
  | IPrepareHardwareAccountsParams;

// DecodedTx ----------------------------------------------
export type IDecodedTxLegacy = EVMDecodedItem;

export enum IDecodedTxDirection {
  IN = 'IN', // received
  OUT = 'OUT', // sent
  SELF = 'SELF', // sent to self
}
export enum IDecodedTxStatus {
  Pending = 'Pending',
  Confirmed = 'Confirmed',
  Failed = 'Failed',
  Dropped = 'Dropped',
}
export type IDecodedTxInteractWith = {
  // Dapp info
  name: string;
  url: string;
  description: string;
  icons: string[];
};
export type IUtxoAddressInfo = {
  address: string;
  balance: string;
  balanceValue: string;
  symbol: string;
  isMine: boolean;
};
export enum IDecodedTxActionType {
  // Native currency transfer
  NATIVE_TRANSFER = 'NATIVE_TRANSFER',

  // TOKEN
  TOKEN_TRANSFER = 'TOKEN_TRANSFER',
  TOKEN_APPROVE = 'TOKEN_APPROVE',

  // NFT
  NFT_TRANSFER = 'NFT_TRANSFER',

  // Swap
  SWAP = 'SWAP',
  INTERNAL_SWAP = 'INTERNAL_SWAP',

  // Contract Interaction
  FUNCTION_CALL = 'FUNCTION_CALL',

  // other
  TRANSACTION = 'TRANSACTION',
}

export type IDecodedTxActionBase = {
  extra: any | null; // extra should be different in each network (eg. serialized from nativeTx actions)
};

export type IDecodedTxActionFunctionCall = IDecodedTxActionBase & {
  target: string; // contractAddress
  functionName: string;
  functionHash: string; // functionSignature
  args: any[];
};

export type IDecodedTxActionNativeTransfer = IDecodedTxActionBase & {
  tokenInfo: Token;
  utxoFrom?: IUtxoAddressInfo[];
  utxoTo?: IUtxoAddressInfo[];
  from: string;
  to: string;
  amount: string;
  amountValue: string;
};
export type IDecodedTxActionTokenTransfer = IDecodedTxActionBase & {
  tokenInfo: Token;
  // from: string;
  // to: string;
  recipient: string;
  amount: string;
  amountValue: string;
  // amountFiat: string;
};
export type IDecodedTxActionTokenApprove = IDecodedTxActionBase & {
  tokenInfo: Token;
  // from: string;
  // to: string;
  spender: string;
  amount: string;
  amountValue: string;
  isMax: boolean;
};
export type IDecodedTxActionInternalSwapInfo = {
  tokenInfo: Token;
  // token: string;
  // symbol: string;
  amount: string;
  amountValue: string;
};
export type IDecodedTxActionInternalSwap = IDecodedTxActionBase & {
  buy: IDecodedTxActionInternalSwapInfo;
  sell: IDecodedTxActionInternalSwapInfo;
};
// other Unknown TRANSACTION
export type IDecodedTxActionTransaction = IDecodedTxActionBase;
export type IDecodedTxAction = {
  type: IDecodedTxActionType;
  nativeTransfer?: IDecodedTxActionNativeTransfer;
  tokenTransfer?: IDecodedTxActionTokenTransfer;
  tokenApprove?: IDecodedTxActionTokenApprove;
  internalSwap?: IDecodedTxActionInternalSwap;
  functionCall?: IDecodedTxActionFunctionCall;
  transaction?: IDecodedTxActionTransaction;
};
export type IDecodedTx = {
  txid: string; // blockHash
  signer: string; // fromAddress
  // receiver: string; // toAddress
  nonce: number;
  actions: IDecodedTxAction[];

  createdAt?: number;
  finishedAt?: number;

  status: IDecodedTxStatus;
  direction: IDecodedTxDirection;
  network: Network;
  feeInfo?: IFeeInfoUnit;
  interactWith?: IDecodedTxInteractWith;

  // TODO use nativeTx & decodedTx in frontend UI render
  extra: IDecodedTxExtraNear | IDecodedTxExtraBtc | null;

  // protocol?: 'erc20' | 'erc721';
  // txSource: 'raw' | 'ethersTx' | 'covalent';
  // rawTx?: string;
  // nativeTx: ethers.Transaction;
  // nativeTxDesc?: ethers.utils.TransactionDescription;
};
