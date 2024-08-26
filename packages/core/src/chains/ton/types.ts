import type { CHAIN } from '@tonconnect/protocol';

type IBase64String = string;

export type ITonMessage = {
  address: string;
  amount: string;
  payload?: IBase64String;
  sendMode?: number;
  stateInit?: IBase64String;
  jetton?: {
    amount: string;
    jettonMasterAddress: string;
    fwdFee: string;
  };
};

export type IEncodedTxTon = {
  from: string;
  messages: ITonMessage[];
  sequenceNo?: number;
  validUntil?: number;
  network?: CHAIN;
};
