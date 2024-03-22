export interface Response<T> {
  code: number;
  data: T;
  message: string;
  generated_at: number;
}

export interface Transaction {
  account_id: string;
  block_num: number;
  block_timestamp: number;
  call_module: string;
  call_module_function: string;
  extrinsic_hash: string;
  extrinsic_index: string;
  fee: string;
  fee_used: string;
  nonce: number;
  params: string;
  signature: string;
  from_hex: string;
  finalized: boolean;
  success: boolean;
}

export interface ExtrinsicParam {
  name: string;
  type: string;
  type_name: string;
  value: string;
}

export interface Extrinsic {
  account_id: string;
  block_num: number;
  block_timestamp: number;
  call_module: string;
  call_module_function: string;
  extrinsic_hash: string;
  extrinsic_index: string;
  fee: string;
  fee_used: string;
  nonce: number;
  params: ExtrinsicParam[];
  signature: string;
  from_hex: string;
  finalized: boolean;
  success: boolean;
  pending: boolean;
}

export interface TransactionV2 {
  from: string;
  to: string;
  extrinsic_index: string;
  event_idx: number;
  success: boolean;
  hash: string;
  block_num: number;
  block_timestamp: number;
  module: string;
  amount: string;
  amount_v2: string;
  fee: string;
  nonce: number;
  asset_symbol: string;
  asset_type: string;
  asset_unique_id: string;
  from_account_display: AccountDisplay;
  to_account_display: AccountDisplay;
}

export interface AccountDisplay {
  address: string;
  display?: string;
  account_index?: string;
  identity?: boolean;
  judgements?: Judgement[];
  parent?: Parent;
}

export interface Judgement {
  index: number;
  judgement: string;
}

export interface Parent {
  address: string;
  display: string;
  sub_symbol: string;
  identity: boolean;
}
