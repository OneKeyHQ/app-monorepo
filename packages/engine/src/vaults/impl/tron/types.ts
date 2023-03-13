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

export type IContractDetail = {
  'address': string;
  'balance': number;
  'verify_status': number;
  'is_proxy': boolean;
  'proxy_implementation': string;
  'old_proxy_implementation': string;
  'name': string;
  'description': string;
  'vip': boolean;
  'tokenInfo': {
    'tokenId': string;
    'tokenAbbr': string;
    'tokenName': string;
    'tokenDecimal': number;
    'tokenCanShow': number;
    'tokenType': string;
    'tokenLogo': string;
    'tokenLevel': string;
    'issuerAddr': string;
    'vip': boolean;
  };
};

export type ITokenDetail = {
  'tokenId': string;
  'balance': string;
  'tokenName': string;
  'tokenAbbr': string;
  'tokenDecimal': number;
  'tokenCanShow': number;
  'tokenType': string;
  'tokenLogo': string;
  'vip': boolean;
  'tokenPriceInTrx': number;
  'amount': number;
  'nrOfTokenHolders': number;
  'transferCount': number;
};
