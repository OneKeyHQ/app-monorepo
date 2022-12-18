import type { IEncodedTxEvm } from './Vault';
import type { ethers } from '@onekeyfe/blockchain-libs';

export type INativeTxEvm = ethers.Transaction;
export type IRpcTxEvm = IEncodedTxEvm & {
  input?: string;
  hash?: string;
};
