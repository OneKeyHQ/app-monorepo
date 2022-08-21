import type { Transaction } from '@solana/web3.js';

export type IEncodedTxSol = string; // bs58 encoded string
export type INativeTxSol = Transaction;

export type ParsedAccountInfo = {
  data: { parsed: { info: { mint: string; owner: string } } };
};

export type AssociatedTokenInfo = {
  mint: string;
  owner: string;
};
