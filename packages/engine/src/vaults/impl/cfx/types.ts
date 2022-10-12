export type IEncodedTxCfx = {
  from: string;
  to: string;
  value: string;
  data: string;
  hash?: string;
  nonce?: number;
  gas?: string;
  gasFee?: string;
  gasPrice?: string;
  gasLimit?: string;
  storageLimit?: string;
  chainId?: number;
  epochHeight?: number;
};

export type ITxAbiDecodeResult = {
  name: string;
  fullName: string;
  type: string;
  signature: string;
  array: any[];
  object: {
    [index: string]: any;
  };
};

export type ITxOnChainHistoryItem = {
  method: string;
  type: string;
  status: number;
  input: string;
  gasFee: string;
  timestamp: number;
  amount: string;
  transactionHash: string;
  contract?: string;
} & IEncodedTxCfx;

export type ITxOnChainHistoryResp = {
  code: number;
  message: string;
  data: {
    total: number;
    list: ITxOnChainHistoryItem[];
  };
};

export enum IOnChainTransferType {
  Transaction = 'transaction',
  Call = 'call',
  Transfer20 = 'transfer_20',
}
