import type { MoneroTransaction } from '@mymonero/mymonero-lws-client';

export type IOnChainHistoryTx = MoneroTransaction & { amount: string };

export interface MoneroKeys {
  publicViewKey: string;
  publicSpendKey: string;
  privateViewKey: string;
  privateSpendKey: string;
}
