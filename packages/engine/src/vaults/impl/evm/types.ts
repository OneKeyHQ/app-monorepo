import type { ethers } from './sdk/ethers';
import type { IEncodedTxEvm } from './Vault';

export type INativeTxEvm = ethers.Transaction;
export type IRpcTxEvm = IEncodedTxEvm & {
  input?: string;
  hash?: string;
};
