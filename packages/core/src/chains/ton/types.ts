export type ITonMessage = {
  toAddress: string;
  amount: string;
  payload?: string;
  sendMode?: number;
  stateInit?: string;
  jetton?: {
    amount: string;
    jettonMasterAddress: string;
    fwdFee: string;
  };
};

export type IEncodedTxTon = {
  fromAddress: string;
  messages: ITonMessage[];
  sequenceNo: number;
  expireAt?: number;
};
