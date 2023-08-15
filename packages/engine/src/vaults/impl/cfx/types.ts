export type {
  Contract as ISdkCfxContract,
  Transaction as ISdkCfxTransaction,
  Conflux as ISdkConflux,
} from 'js-conflux-sdk/dist/types/index';

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
  contract?: string;
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

export type ITxOnChainDetailResp = {
  code: number;
  message: string;
  data: {
    gasFee: string;
  };
};

export enum IOnChainTransferType {
  Transaction = 'transaction',
  Call = 'call',
  Transfer20 = 'transfer_20',
}
