import type { PROTO } from '@onekeyfe/hd-core';

export const enum ENetworkIdAda {
  MAINNET = 1,
  TESTNET_OR_PREPROD = 0,
}

export type IBIP32PathAda = number[];

export type IAddressAda = string & { __typeAddress: any };

export type IAmountAda = {
  unit: string;
  quantity: string;
};

export type IUTXOAda = {
  path: string;
  address: string;
  tx_hash: string;
  tx_index: number;
  output_index: number;
  amount: IAmountAda[];
};

export type IEncodeInputAda = {
  address: string;
  amount: IAmountAda[];
  block: string;
  data_hash: string;
  outputIndex: number;
  txHash: string;
  tx_index: number;
};

export type IEncodeOutputAda = {
  address: string;
  amount: string;
  assets: IAmountAda[];
  isChange?: boolean;
};

export type ITxInfoAda = {
  body: string;
  hash: string;
  size: number;
  rawTxHex?: string;
};

export type IChangeAddressAda = {
  address: string;
  addressParameters: {
    path: string;
    addressType: PROTO.CardanoAddressType;
    stakingPath: string;
  };
};

export type IEncodedTxAda = {
  inputs: IEncodeInputAda[];
  outputs: IEncodeOutputAda[];
  fee: string;
  totalSpent: string;
  totalFeeInNative: string;
  // transferInfo: ITransferInfo; // TODO
  tx: ITxInfoAda;
  changeAddress: IChangeAddressAda;
  signOnly?: boolean;
};

// export type IAdaHistory = {
//   tx_hash: string;
//   epoch_no: number;
//   block_height: number;
//   block_time: number;
//   tx: {
//     tx_hash: string;
//     block_hash: string;
//     block_height: number;
//     tx_timestamp: number;
//     tx_block_index: number;
//     tx_size: number;
//     total_output: string;
//     fee: string;
//     actions: IAdaNativeTranfer[] | IAdaTokenTranfer[];
//   };
// };

// type IAdaNativeTranfer = {
//   type: 'NATIVE_TRANSFER';
//   direction: IDecodedTxDirection;
//   utxoFrom: IUtxoForm[];
//   utxoTo: IUtxoForm[];
//   from: string;
//   to: string;
//   amount: string;
//   amountValue: string;
// };

// type IUtxoForm = {
//   address: string;
//   balance: string;
//   balanceValue: string;
//   symbol: string;
//   isMine: boolean;
// };

// type IAdaTokenTranfer = {
//   type: 'TOKEN_TRANSFER';
//   direction: IDecodedTxDirection;
//   from: string;
//   to: string;
//   amount: string;
//   token: {
//     id: string;
//     tokenIdOnNetwork: string;
//     decimals: number;
//     name: string;
//   };
// };

// export type IAsset = Asset & {
//   asset: string;
//   metadata?: {
//     name?: string;
//     ticker?: string;
//     decimals?: number;
//   };
// };

// type Asset = {
//   policy_id: string;
//   asset_name: string;
//   fingerprint: string;
//   quantity: string;
// };
// export type IAdaAccount = {
//   'stake_address': string;
//   'active': boolean;
//   'active_epoch': number;
//   'controlled_amount': string;
//   'rewards_sum': string;
//   'withdrawals_sum': string;
//   'reserves_sum': string;
//   'treasury_sum': string;
//   'withdrawable_amount': string;
//   'pool_id': string;
// };
// export type IAdaOutputs = {
//   address: string;
//   amount: string;
//   assets: [];
// };

// export type IAdaTransaction = {
//   'hash': string;
//   'block': string;
//   'block_height': number;
//   'block_time': number;
//   'slot': number;
//   'index': number;
//   'output_amount': IAdaAmount[];
//   'fees': string;
//   'deposit': string;
//   'size': number;
//   'invalid_before': string | null;
//   'invalid_hereafter': string | null;
//   'utxo_count': number;
//   'withdrawal_count': number;
//   'mir_cert_count': number;
//   'delegation_count': number;
//   'stake_cert_count': number;
//   'pool_update_count': number;
//   'pool_retire_count': number;
//   'asset_mint_or_burn_count': number;
//   'redeemer_count': number;
//   'valid_contract': boolean;
// };
// export type IAdaAddress = {
//   'address': string;
//   'amount': IAdaAmount[];
//   'stake_address': string;
//   'type': 'shelley';
//   'script': false;
// };

// export type IAdaAddressDetail = {
//   address: string;
//   received_sum?: IAdaAmount[];
//   sent_sum?: IAdaAmount[];
//   tx_count: number;
// };
