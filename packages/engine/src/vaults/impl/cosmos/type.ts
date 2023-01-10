import type { Message } from './sdk/message';
import type { Publickey } from './sdk/publickey';
import type { TransactionWrapper } from './sdk/wrapper/index';

export type IEncodedTxCosmos = TransactionWrapper;

export interface CosmosImplOptions {
  mainCoinDenom: string;
  addressPrefix: string;
  curve: string;
  gasPriceStep?: {
    min?: string;
    low?: string;
    normal?: string;
    high?: string;
  };
}

export interface SignDocHex {
  bodyBytes: string;
  authInfoBytes: string;
  chainId: string;
  accountNumber: string;
}

export interface Coin {
  denom: string;
  amount: string;
}

export interface StdFee {
  amount: Coin[];
  gas_limit: string;
  payer: string;
  granter: string;

  feePayer?: string;
}

export interface BlockHeader {
  version: any;
  chain_id: string;
  height: string;
  time: Date;
  last_block_id: any;
  last_commit_hash: string;
  data_hash: string;
  validators_hash: string;
  next_validators_hash: string;
  consensus_hash: string;
  app_hash: string;
  last_results_hash: string;
  evidence_hash: string;
  proposer_address: string;
}

export interface CosmosNodeInfo {
  protocol_version: {
    p2p: string;
    block: string;
    app: string;
  };
  id: string;
  listen_addr: string;
  network: string;
  version: string;
  channels: string;
  moniker: string;
  other: {
    tx_index: string;
    rpc_address: string;
  };
}

export interface AccountInfo {
  '@type': string;
  address: string;
  pub_key: Publickey;
  account_number: string;
  sequence: string;
}

export interface TransactionInfo {
  body: {
    messages: Message[];
    memo: string;
    timeout_height: string;
    extension_options: any[];
    non_critical_extension_options: any[];
  };
  auth_info: {
    signer_infos: SignerInfo[];
    fee: StdFee;
  };
  signatures: string[];
}

export interface SignerInfo {
  public_key: {
    '@type': string;
    key: string;
  };
  mode_info: {
    single: {
      mode: string;
    };
  };
  sequence: string;
}

export interface TransactionResponseInfo {
  height: string;
  txhash: string;
  codespace: string;
  code: number;
  data: string;
  raw_log: string;
  info: string;
  gas_wanted: string;
  gas_used: string;
  tx: {
    '@type': string;
  } & TransactionInfo;
  timestamp: Date;
}

export interface BroadcastTransactionResponse {
  height: string;
  txhash: string;
  codespace: string;
  code: number;
  data: string;
  raw_log: string;
  info: string;
  gas_wanted: string;
  gas_used: string;
  tx: {
    type_url: string;
    value: string;
  };
  timestamp: string;
}

export interface GasInfo {
  gas_wanted: string;
  gas_used: string;
}
