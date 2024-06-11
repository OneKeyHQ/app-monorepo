import type { Transaction } from '@ckb-lumos/base';

export type IEncodedTxCkb = {
  tx: Transaction;
  feeInfo: {
    price: string;
    limit: string;
  };
};
