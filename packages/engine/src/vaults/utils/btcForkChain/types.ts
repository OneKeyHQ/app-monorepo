import BigNumber from 'bignumber.js';
import {
  NonWitnessUtxo,
  RedeemScript,
  WitnessUtxo,
} from 'bip174/src/lib/interfaces';

import type { ITransferInfo } from '../../types';

export enum AddressEncodings {
  P2PKH = 'P2PKH', // Legacy BIP-44
  P2SH_P2WPKH = 'P2SH_P2WPKH', // BIP-49 P2WPKH nested in P2SH
  P2WPKH = 'P2WPKH', // BIP-84 P2WPKH
  // P2TR = "P2TR",  // BIP-86 P2TR
}

export enum TransactionStatus {
  NOT_FOUND = 0,
  PENDING = 1,
  INVALID = 2,
  CONFIRM_AND_SUCCESS = 10,
  CONFIRM_BUT_FAILED = 11,
}

export type ChainInfo = {
  code: string;
  feeCode: string;
  impl: string;
  curve: 'secp256k1' | 'ed25519';
  implOptions: { [key: string]: any };
  clients: Array<{ name: string; args: Array<any> }>;
};

export type AddressValidation = {
  isValid: boolean;
  normalizedAddress?: string;
  displayAddress?: string;
  encoding?: string;
};

export type IBtcUTXO = {
  txid: string;
  vout: number;
  value: string;
  address: string;
  path: string;
};

export type IUTXOInput = Omit<IBtcUTXO, 'txid'> & { txId: string };
export type IUTXOOutput = { address: string; value: number };

export type IEncodedTxBtc = {
  inputs: IBtcUTXO[];
  outputs: { address: string; value: string }[];
  totalFee: string;
  totalFeeInNative: string;
  transferInfo: ITransferInfo;
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
  publicKey?: string;
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
  feePricePerUnit?: BigNumber;
  payload: { [key: string]: any };
  tokensChangedTo?: { [key: string]: string };
};

export type TransactionMixin = {
  nonWitnessUtxo?: NonWitnessUtxo;
  witnessUtxo?: WitnessUtxo;
  redeemScript?: RedeemScript;
};

export interface Verifier {
  getPubkey: (compressed?: boolean) => Promise<Buffer>;
  verify: (digest: Buffer, signature: Buffer) => Promise<Buffer>;
}

export interface Signer extends Verifier {
  sign: (digest: Buffer) => Promise<[Buffer, number]>;
  getPrvkey: () => Promise<Buffer>;
}

export type SignedTx = {
  txid: string;
  rawTx: string;
};

export type IBlockBookTransaction = {
  txid: string;
  vin: Array<{
    isAddress?: boolean;
    addresses: Array<string>;
    value: string;
    isOwn?: boolean;
  }>;
  vout: Array<{
    isAddress?: boolean;
    addresses: Array<string>;
    value: string;
    isOwn?: boolean;
  }>;
  confirmations: number;
  fees: string;
  blockTime?: number;
};

export type PartialTokenInfo = {
  decimals: number;
  name: string;
  symbol: string;
};
