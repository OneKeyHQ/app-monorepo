import type { MoneroTransaction } from '@mymonero/mymonero-lws-client';

export type IOnChainHistoryTx = MoneroTransaction & { amount: string };

export interface MoneroKeys {
  publicViewKey: string;
  publicSpendKey: string;
  privateViewKey: string;
  privateSpendKey: string;
}

export type IEncodedTxXmr = {
  destinations: [
    {
      'to_address': string;
      'send_amount': string;
    },
  ];
  priority: number;
  address: string;
  privateViewKey: string;
  publicSpendKey: string;
  privateSpendKey: string;
  shouldSweep: false;
  paymentId: '';
  nettype: 'MAINNET';
  unspentOuts: any[];
  randomOutsCb: () => any;
};
