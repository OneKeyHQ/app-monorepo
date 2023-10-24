import type { Transaction, VersionedTransaction } from '@solana/web3.js';

export type IEncodedTxSol = string; // bs58 encoded string
export type INativeTxSol = Transaction | VersionedTransaction;
