import type { transactions } from 'near-api-js';

export type IEncodedTxNear = string;
export type INativeTxNear = transactions.Transaction;
export type IDecodedTxExtraNear = any;

export type INearAccountStorageBalance = {
  total?: string;
  available?: string;
};

export type NearAccessKey = {
  type: 'FullAccess' | 'FunctionCall';
  pubkey: string;
  pubkeyHex: string;
  nonce: number;
  functionCall?: {
    allowance: string;
    receiverId: string;
    methodNames: string[];
  };
};

export type GasCostConfig = {
  send_sir: number;
  send_not_sir: number;
  execution: number;
};
