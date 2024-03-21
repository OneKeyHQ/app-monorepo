import type { Transaction, VersionedTransaction } from '@solana/web3.js';

export type IEncodedTxSol = string; // bs58 encoded string
export type INativeTxSol = Transaction | VersionedTransaction;

export type ParsedAccountInfo = {
  data: { parsed: { info: { mint: string; owner: string } } };
};

export type AssociatedTokenInfo = {
  mint: string;
  owner: string;
};

export type ISolScanTokenMeta = {
  name: string;
  symbol: string;
  icon: string;
  price: number;
  decimals: number;
  supply: number;
  type: string;
  address: string;
};
