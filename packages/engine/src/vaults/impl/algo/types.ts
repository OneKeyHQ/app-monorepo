import type * as sdk from 'algosdk';

export type IEncodedTxAlgo = string; // Base64 encoded string

export type IAccountInformation = {
  address: string;
  amount: number;
  assets: Array<{ amount: number; 'asset-id': number }>;
  'min-balance': number;
};

export type IPendingTransactionInformation = {
  'confirmed-round': number;
  'pool-error': string;
};

export type IClientError = { status: number };

type AccountTransaction = {
  id: string;
  sender: string;
  'tx-type': sdk.TransactionType;
  'round-time': number;
  fee: number;
  'payment-transaction'?: {
    receiver: string;
    amount: number;
  };
  'asset-transfer-transaction'?: {
    receiver: string;
    'asset-id': number;
    amount: number;
    'close-amount': number;
    'close-to': string;
  };
};

export type IAccountTransactionsResp = {
  // Other properties are not used.
  transactions: Array<AccountTransaction>;
};
