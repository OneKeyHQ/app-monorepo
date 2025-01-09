import type { CHAIN } from '@tonconnect/protocol';

type IBase64String = string;

// dApp message schema
export type ITonMessage = {
  address: string; // string
  amount: string; // decimal string
  payload?: IBase64String; // base64 string
  sendMode?: number; // number default 3 (PAY_GAS_SEPARATELY + IGNORE_ERRORS)
  stateInit?: IBase64String; // base64 string
  jetton?: {
    amount: string;
    jettonMasterAddress: string;
    jettonWalletAddress: string;
    fwdFee: string;
    fwdPayload?: IBase64String;
    toAddress: string;
  };
};

export type IEncodedTxTon = {
  from: string; // optional
  messages: ITonMessage[];
  sequenceNo?: number;
  validUntil?: number;
  network?: CHAIN;
};
