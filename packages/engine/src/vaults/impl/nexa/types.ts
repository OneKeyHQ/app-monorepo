import type { ITransferInfo } from '../../types';

export type IEncodedTxNexa = {
  inputs: Array<{
    address: string;
    txId: string;
    satoshis: number;
    outputIndex: number;
  }>;
  outputs: Array<{
    address: string;
    fee: string;
    outType: number;
  }>;
  totalFee: string;
  totalFeeInNative?: string;
  transferInfo?: ITransferInfo;
};

export type IListUXTO = {
  height: number;
  outpoint_hash: string;
  tx_hash: string;
  tx_pos: number;
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
