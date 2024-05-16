export type IUnspentOutput = {
  prevIndex: number;
  globalIndex: number;
  txPubkey: string;
  prevOutPubkey: string;
  amount: number;
};

export type IEncodedTxDnx = {
  from: string;
  to: string;
  amount: string;
  fee: string;
  paymentId?: string;
  inputs: IUnspentOutput[];
};

export type ISignTxParams = {
  path: string;
  inputs: IUnspentOutput[];
  toAddress: string;
  amount: string;
  fee: string;
  paymentIdHex?: string;
};
