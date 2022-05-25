import { transactions } from 'near-api-js';

export type IEncodedTxNear = string;
export type INativeTxNear = transactions.Transaction;
export type IDecodedTxExtraNear = any;

export type INearAccountStorageBalance = {
  total?: string;
  available?: string;
};
