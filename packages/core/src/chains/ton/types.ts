import type BigNumber from 'bignumber.js';

export type ITonMessage = {
  toAddress: string;
  amount: number | BigNumber;
  payload?: string;
  sendMode?: number;
  stateInit?: string;
};

export type IEncodedTxTon = {
  messages: ITonMessage[];
  sequenceNo: number;
  expireAt?: number;
};
