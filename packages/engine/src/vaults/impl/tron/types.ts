import type { Transaction } from 'tronweb';

export type IEncodedTxTron = Transaction;

export type IOnChainHistoryTx = {
  ret: [{ contractRet: string; fee: number }];
  block_timestamp: number;
} & IEncodedTxTron;

export type IOnChainHistoryTokenTx = {
  transaction_id: string;
  token_info: {
    symbol: string;
    address: string;
    decimals: number;
    name: string;
    id: string;
  };
  block_timestamp: number;
  from: string;
  to: string;
  type: string;
  value: number;
};

export type IRPCCallResponse = {
  jsonrpc: string;
  id: number;
  result?: any;
  error?: {
    code: number;
    data: string;
    message: string;
  };
};
