import type { SendConfirmActionType } from '@onekeyhq/kit/src/views/Send/types';
import { SwapQuote } from '@onekeyhq/kit/src/views/Swap/typings';

import type { Engine } from '../index';
import type { EIP1559Fee } from '../types/network';
import type { Token } from '../types/token';
import type {
  IDecodedTxExtraBtc,
  IEncodedTxBtc,
  INativeTxBtc,
} from './impl/btc/types';
import type { EVMDecodedItem } from './impl/evm/decoder/types';
import type { INativeTxEvm } from './impl/evm/types';
import type { IEncodedTxEvm } from './impl/evm/Vault';
import type {
  IDecodedTxExtraNear,
  IEncodedTxNear,
  INativeTxNear,
} from './impl/near/types';
import type { IEncodedTxSTC } from './impl/stc/types';
import type { UnsignedTx } from '@onekeyfe/blockchain-libs/dist/types/provider';

// Options ----------------------------------------------
export type IVaultSettings = {
  feeInfoEditable: boolean;
  privateKeyExportEnabled: boolean;
  tokenEnabled: boolean;
  txCanBeReplaced: boolean;

  importedAccountEnabled: boolean;
  watchingAccountEnabled: boolean;
  hardwareAccountEnabled: boolean;

  minTransferAmount?: string;

  isUTXOModel: boolean;
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
  token?: string; // tokenIdOnNetwork
};
export type IApproveInfo = {
  from: string; // token owner
  token: string; // token address
  amount: string; // amount
  spender: string; // spender to authorize
};
export type ISwapInfoSide = {
  networkId: string;
  // token?: string; // tokenIdOnNetwork
  tokenInfo: Token;
  amount: string;
  amountValue: string;
};
export type ISwapInfo = {
  send: ISwapInfoSide;
  receive: ISwapInfoSide;

  accountAddress: string;
  slippagePercentage: string;
  independentField: 'INPUT' | 'OUTPUT';
  swapQuote: SwapQuote;
};

// EncodedTx\RawTx\SignedTx ----------------------------------------------
export type IEncodedTx =
  | IEncodedTxEvm
  | IEncodedTxNear
  | IEncodedTxBtc
  | IEncodedTxSTC;
export type INativeTx = INativeTxEvm | INativeTxNear | INativeTxBtc;
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
export type IFeeInfoPrice = string | EIP1559Fee; // in GWEI
// TODO rename to IFeeInfoValue, IFeeInfoData, IFeeInfoDetail
export type IFeeInfoUnit = {
  eip1559?: boolean;
  priceValue?: string;
  price?: IFeeInfoPrice; // in GWEI
  limit?: string;
  limitUsed?: string;
};
// TODO rename to IFeeInfoMeta
export type IFeeInfo = {
  // TODO merge (limit, prices, EIP1559Fee) to single field
  limit?: string; // calculated gasLimit of encodedTx
  prices: Array<IFeeInfoPrice>; // preset gasPrices: normal, fast, rapid
  defaultPresetIndex: string; // '0' | '1' | '2';

  feeSymbol?: string; // feeSymbol: GWEI
  feeDecimals?: number; // feeDecimals: 9
  nativeSymbol?: string; // ETH
  nativeDecimals?: number; // 18

  // TODO rename to feeInTx
  tx?: IFeeInfoUnit | null;
  eip1559?: boolean;
  customDisabled?: boolean;
  baseFeeValue?: string; // A base fee: e.g. L1 fee for Layer 2 networks
  extraInfo?: any | null;
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
  extraInfo?: any | null;
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

// GetAddress ----------------------------------------------
export type IHardwareGetAddressParams = {
  path: string;
  showOnOneKey: boolean;
};

export type IGetAddressParams = IHardwareGetAddressParams;

// DecodedTx ----------------------------------------------
export type IDecodedTxLegacy = EVMDecodedItem;

export enum IDecodedTxDirection {
  IN = 'IN', // received
  OUT = 'OUT', // sent
  SELF = 'SELF', // sent to self
  OTHER = 'OTHER',
}
export enum IDecodedTxStatus {
  Pending = 'Pending',
  Confirmed = 'Confirmed',
  Failed = 'Failed',
  Dropped = 'Dropped',
  Removed = 'Removed',
}
export type IDecodedTxInteractInfo = {
  // Dapp info
  name: string;
  url: string;
  description: string;
  icons: string[];
  provider?: string;
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
  // NFT_TRANSFER = 'NFT_TRANSFER',

  // Swap
  INTERNAL_SWAP = 'INTERNAL_SWAP',
  // SWAP = 'SWAP',

  // Contract Interaction
  FUNCTION_CALL = 'FUNCTION_CALL',

  // other
  TRANSACTION = 'TRANSACTION',
}

export type IDecodedTxActionBase = {
  nativeAmount?: string;
  nativeAmountValue?: string;
  // TODO rename to extraInfo
  extraInfo: any | null; // extra should be different in each network (eg. serialized from nativeTx actions)
};

export type IDecodedTxActionFunctionCall = IDecodedTxActionBase & {
  target: string; // contractAddress
  functionName: string; // approve
  functionHash?: string; // 0x095ea7b3
  functionSignature?: string; //
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
  from: string;
  to: string;
  // recipient: string; // TODO rename to from/to
  amount: string;
  amountValue: string;
  // amountFiat: string;
};
export type IDecodedTxActionTokenApprove = IDecodedTxActionBase & {
  tokenInfo: Token; // TODO tokenContract / tokenIdOnNetwork
  // from: string;
  // to: string;
  owner: string;
  spender: string;
  amount: string; // TODO amount: "Infinite"
  amountValue: string;
  isMax: boolean;
};
export type IDecodedTxActionEvmInfo = {
  from: string;
  to: string;
  value: string;
  data?: string;
};
export type IDecodedTxActionInternalSwap = IDecodedTxActionBase & ISwapInfo;
// other Unknown Action
export type IDecodedTxActionUnknown = IDecodedTxActionBase;
export type IDecodedTxAction = {
  type: IDecodedTxActionType;
  direction?: IDecodedTxDirection; // TODO move direction to UI side generate
  hidden?: boolean;
  nativeTransfer?: IDecodedTxActionNativeTransfer;
  tokenTransfer?: IDecodedTxActionTokenTransfer;
  tokenApprove?: IDecodedTxActionTokenApprove;
  internalSwap?: IDecodedTxActionInternalSwap;
  functionCall?: IDecodedTxActionFunctionCall;
  // other Unknown Action
  unknownAction?: IDecodedTxActionUnknown;
  evmInfo?: IDecodedTxActionEvmInfo;
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

  status: IDecodedTxStatus;
  // isFinalData  data wont change anymore
  isFinal?: boolean; // tx info is full completed, like covalentTx has parsed outputActions

  networkId: string;
  accountId: string;

  feeInfo?: IFeeInfoUnit;
  totalFeeInNative?: string;

  interactInfo?: IDecodedTxInteractInfo;

  // TODO use nativeTx & decodedTx in frontend UI render
  extraInfo: IDecodedTxExtraNear | IDecodedTxExtraBtc | null;

  encodedTx?: IEncodedTx;
  payload?: any;

  tokenIdOnNetwork?: string; // indicates this tx belongs to which token
};

// History ----------------------------------------------
export type IHistoryTx = {
  id: string; // historyId

  isLocalCreated?: boolean;

  replacedPrevId?: string; // cancel speedUp replacedId
  replacedNextId?: string;
  replacedType?: SendConfirmActionType; // cancel speedUp

  decodedTx: IDecodedTx;
};
