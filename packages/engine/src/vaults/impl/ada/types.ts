import { ITransferInfo } from '../../types';

export type BIP32Path = number[];

export const enum NetworkId {
  MAINNET = 1,
  TESTNET_OR_PREPROD = 0,
}

export type Address = string & { __typeAddress: any };

export type IAdaAccount = {
  'stake_address': string;
  'active': boolean;
  'active_epoch': number;
  'controlled_amount': string;
  'rewards_sum': string;
  'withdrawals_sum': string;
  'reserves_sum': string;
  'treasury_sum': string;
  'withdrawable_amount': string;
  'pool_id': string;
};

export type IAdaAmount = {
  unit: string;
  quantity: string;
};

export type IAdaAddress = {
  'address': string;
  'amount': IAdaAmount[];
  'stake_address': string;
  'type': 'shelley';
  'script': false;
};

export type IAdaUTXO = {
  tx_hash: string;
  tx_index: number;
  output_index: string;
  amount: IAdaAmount[];
};

export type IAdaOutputs = {
  address: string;
  amount: string;
  assets: [];
};

export type IAdaTransaction = {
  'hash': string;
  'block': string;
  'block_height': number;
  'block_time': number;
  'slot': number;
  'index': number;
  'output_amount': IAdaAmount[];
  'fees': string;
  'deposit': string;
  'size': number;
  'invalid_before': string | null;
  'invalid_hereafter': string | null;
  'utxo_count': number;
  'withdrawal_count': number;
  'mir_cert_count': number;
  'delegation_count': number;
  'stake_cert_count': number;
  'pool_update_count': number;
  'pool_retire_count': number;
  'asset_mint_or_burn_count': number;
  'redeemer_count': number;
  'valid_contract': boolean;
};

export type ITransactionListItem = {
  'tx_hash': string;
  'tx_index': number;
  'block_height': number;
  'block_time': number;
};

type IEncodeInput = {
  address: string;
  amount: IAdaAmount[];
  block: string;
  data_hash: string;
  outputIndex: number;
  txHash: string;
  tx_index: number;
};

type IEncodeOutput = {
  address: string;
  amount: string;
  assets: IAdaAmount[];
  isChange?: boolean;
};

type ITxInfo = {
  body: string;
  hash: string;
  size: number;
};

export type IEncodedTxADA = {
  inputs: IEncodeInput[];
  outputs: IEncodeOutput[];
  fee: string;
  totalSpent: string;
  totalFeeInNative: string;
  transferInfo: ITransferInfo;
  tx: ITxInfo;
};
