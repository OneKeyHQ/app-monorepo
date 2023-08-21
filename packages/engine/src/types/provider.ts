import type BigNumber from 'bignumber.js';

export type ClientInfo = {
  bestBlockNumber: number;
  isReady: boolean;
};

export type AddressInfo = {
  balance: BigNumber;
  existing: boolean;
  nonce?: number;
};

export enum TransactionStatus {
  NOT_FOUND = 0,
  PENDING = 1,
  INVALID = 2,
  CONFIRM_AND_SUCCESS = 10,
  CONFIRM_BUT_FAILED = 11,
}

// enum BroadcastReceiptCode {
//   UNKNOWN = 0,
//   UNEXPECTED_FAILED = 1,
//
//   SUCCESS = 100,
//   ALREADY_KNOWN = 101,
//   NONCE_TOO_LOW = 102,
//
//   ETH_RBF_UNDERPRICE = 201,
//   ETH_GAS_PRICE_TOO_LOW = 202,
//   ETH_GAS_LIMIT_EXCEEDED = 203,
// }
//
// type BroadcastReceipt = {
//   isSuccess: boolean;
//   receiptCode: BroadcastReceiptCode;
// };

export type EstimatedPrice = {
  price: BigNumber;
  waitingBlock?: number;
  payload?: { [key: string]: any };
};

export type FeePricePerUnit = {
  normal: EstimatedPrice;
  others?: Array<EstimatedPrice>;
};

export type PartialTokenInfo = {
  decimals: number;
  name: string;
  symbol: string;
};

export type AddressValidation = {
  isValid: boolean;
  normalizedAddress?: string;
  displayAddress?: string;
  encoding?: string;
};

export type UTXO = {
  txid: string;
  vout: number;
  value: BigNumber;
};

export type TxInput = {
  address: string;
  value: BigNumber;
  tokenAddress?: string;
  utxo?: UTXO;
  publicKey?: string; // used in stc
};

export type TxOutput = {
  address: string;
  value: BigNumber;
  tokenAddress?: string;
  payload?: { [key: string]: any };
};

export type UnsignedTx = {
  inputs: TxInput[];
  outputs: TxOutput[];
  type?: string;
  nonce?: number;
  feeLimit?: BigNumber;
  feeLimitForDisplay?: BigNumber;
  feePricePerUnit?: BigNumber;
  payload: { [key: string]: any };
  tokensChangedTo?: { [key: string]: string };
};

export type SignedTx = {
  txid: string;
  rawTx: string;
  psbtHex?: string;
};

export type TypedMessage = {
  type?: number;
  message: string;
};
