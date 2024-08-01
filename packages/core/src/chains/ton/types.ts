import type BigNumber from 'bignumber.js';

export type ITonMessage = {
  toAddress: string;
  amount: BigNumber;
  payload?: string;
  sendMode?: number;
  stateInit?: string;
};

export type IEncodedTxTon = {
  fromAddress: string;
  messages: ITonMessage[];
  sequenceNo: number;
  expireAt?: number;
};
