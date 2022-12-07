export enum ChainId {
  MAIN = '314',
  WALLABY = '31415',
}

export enum ProtocolIndicator {
  ID,
  SECP256K1,
  ACTOR,
  BLS,
}

export type CID =
  | string
  | {
      '/': string;
    };

export type IEncodedTxFil = {
  CID?: CID;
  Version?: number;
  From: string;
  GasFeeCap: string;
  GasLimit: number;
  GasPremium: string;
  Method: number;
  Nonce: number;
  Params: string;
  To: string;
  Value: string;
};

export type IOnChainHistoryTx = {
  all_gas_fee: string;
  cid: string;
  signed_cid: string;
  from: string;
  to: string;
  exit_code: number;
  gas_burned: string;
  gas_fee_cap: string;
  gas_limit: number;
  gas_premium: string;
  gas_used: string;
  last_modified: string;
  method_name: string;
  nonce: number;
  value: string;
};
