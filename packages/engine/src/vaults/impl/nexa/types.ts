import type { ITransferInfo } from '../../types';
import type BN from 'bn.js';

export type IEncodedTxNexa = {
  inputs: Array<{
    address: string;
    txId: string;
    satoshis: string;
    outputIndex: number;
    sequenceNumber?: number;
  }>;
  outputs: Array<{
    address: string;
    satoshis: string;
    outType: number;
  }>;
  gas?: string;
  totalFeeInNative?: string;
  transferInfo?: ITransferInfo;
};

export type IListUTXO = {
  height: number;
  outpoint_hash: string;
  tx_hash: string;
  tx_pos: number;
  has_token: boolean;
  value: number;
};

export type INexaHistoryItem = {
  height: number;
  tx_hash: string;
};

export interface INexaTransaction {
  blockhash: string;
  blocktime: number;
  confirmations: number;
  fee: number;
  fee_satoshi: number;
  hash: string;
  height: number;
  hex: string;
  locktime: number;
  size: number;
  time: number;
  txid: string;
  txidem: string;
  version: number;
  vin: INexaTransactionVin[];
  vout: INexaTransactionVout[];
}

export interface INexaTransactionVin {
  coinbase: any;
  outpoint: string;
  scriptSig: {
    asm: string;
    hex: string;
  };
  sequence: number;
  value: number;
  value_coin: number;
  value_satoshi: number;
}

export interface INexaTransactionVout {
  n: number;
  scriptPubKey: INexaTransactionScriptPubKey;
  type: number;
  value: number;
  value_coin: number;
  value_satoshi: number;
}

export interface INexaTransactionScriptPubKey {
  addresses: any[];
  argsHash: string;
  asm: string;
  group: any;
  groupAuthority: number;
  groupQuantity: any;
  hex: string;
  scriptHash: string;
  token_id_hex: any;
  type: string;
}

export enum NexaSignature {
  SIGHASH_NEXA_ALL = 0x00,
  SIGHASH_ALL = 0x01,
  SIGHASH_NONE = 0x02,
  SIGHASH_SINGLE = 0x03,
  SIGHASH_FORKID = 0x40,
  SIGHASH_ANYONECANPAY = 0x80,
}

export interface INexaInputSignature {
  publicKey: Buffer;
  prevTxId: string;
  outputIndex: number;
  inputIndex: number;
  signature: Buffer;
  sigtype: NexaSignature;
  sequenceNumber: number;
  scriptBuffer: Buffer;
  amount: BN;
}

export interface INexaOutputSignature {
  address: string;
  satoshi: BN;
  outType: number;
  scriptBuffer: Buffer;
}
