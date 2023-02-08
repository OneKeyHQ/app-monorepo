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
}
