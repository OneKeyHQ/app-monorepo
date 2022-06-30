import { ethers } from '@onekeyfe/blockchain-libs';

import type { IEncodedTxEvm } from './Vault';

export type INativeTxEvm = ethers.Transaction;
export type IRpcTxEvm = IEncodedTxEvm & {
  input: string;
  hash: string;
};
