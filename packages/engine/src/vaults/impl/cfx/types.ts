export type IEncodedTxCfx = {
  from: string;
  to: string;
  value: string;
  data: string;
  nonce?: number;
  gas?: string;
  gasPrice?: string;
  gasLimit?: string;
  storageLimit?: number;
  chainId?: number;
  epochHeight?: number;
};

export type ITxDescCfx = {
  name: string;
  fullName: string;
  type: string;
  signature: string;
  array: any[];
  object: {
    [index: string]: any;
  };
};

export type OnChainHistoryItem = {
  method: string;
  type: string;
  status: number;
  input: string;
  gasFee: string;
  timestamp: number;
  amount: string;
  transactionHash: string;
} & IEncodedTxCfx;

export type OnChainHistoryResp = {
  code: number;
  message: string;
  data: {
    total: number;
    list: OnChainHistoryItem[];
  };
};
