export interface IKaspaUTXOResponse {
  address: string;
  outpoint: IKaspaOutpoint;
  utxoEntry: IKaspaUTXOEntry;
}

export type IKaspaUTXO = IKaspaUTXOResponse;

export interface IKaspaOutpoint {
  transactionId: string;
  index: number;
}

export interface IKaspaUTXOEntry {
  amount: string[];
  scriptPublicKey: IKaspaScriptPublicKey;
  blockDaaScore: string;
}

export interface IKaspaScriptPublicKey {
  version: number;
  scriptPublicKey: string;
}

export interface IKaspaTransaction {
  version: number;
  inputs: IKaspaTransactionInput[];
  outputs: IKaspaTransactionOutput[];
  lockTime: number | bigint;
  subnetworkId: string;
  gas?: number;
  payloadHash?: string;
  payload?: string;
  fee: number;
}

export interface IKaspaTransactionInput {
  previousOutpoint: IKaspaOutpoint;
  signatureScript: string;
  sequence: number | bigint;
}

export interface IKaspaTransactionOutput {
  amount: number | bigint;
  scriptPublicKey: IKaspaScriptPublicKey;
}

export interface IKaspaSubmitTransactionRequest {
  transaction: IKaspaTransaction;
}

export interface IKaspaGetTransactionResponse {
  subnetwork_id: string;
  transaction_id: string;
  hash: string;
  mass: string;
  block_hash: string[];
  block_time: number;
  is_accepted: boolean;
  accepting_block_hash: string;
  accepting_block_blue_score: number;
  inputs: IKaspaGetTransactionInput[];
  outputs: IKaspaGetTransactionOutput[];
}

export interface IKaspaGetTransactionInput {
  id: number;
  transaction_id: string;
  index: number;
  previous_outpoint_hash: string;
  previous_outpoint_index: string;
  signature_script: string;
  sig_op_count: string;
  previous_outpoint_address: string;
  previous_outpoint_amount: bigint;
}

export interface IKaspaGetTransactionOutput {
  id: number;
  transaction_id: string;
  index: number;
  amount: bigint;
  script_public_key: string;
  script_public_key_address: string;
  script_public_key_type: string;
  accepting_block_hash: null;
}
