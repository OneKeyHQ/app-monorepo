/* eslint-disable camelcase */

// TODO: no token or dapp support yet
export type IEncodedTxSTC = {
  from: string;
  to: string;
  value: string;
  gasPrice?: string;
  gasLimit?: string;
  nonce?: number;
  data?: string;
};

// For decode history powered by stc explorer
export type ISTCExplorerTransaction = {
  transaction_hash: string;
  gas_used: string;
  status: string;
  timestamp: number;
  user_transaction: {
    raw_txn: {
      sender: string;
      gas_unit_price: string;
      payload: string;
    };
  };
};
