export interface UTXOResponse {
  address: string;
  outpoint: Outpoint;
  utxoEntry: UTXO;
}

export interface Outpoint {
  transactionId: string;
  index: number;
}

export interface UTXO {
  amount: string[];
  scriptPublicKey: ScriptPublicKey;
  blockDaaScore: string;
}

export interface ScriptPublicKey {
  version: number;
  scriptPublicKey: string;
}

export interface Transaction {
  version: number;
  inputs: TransactionInput[];
  outputs: TransactionOutput[];
  lockTime: number | bigint;
  subnetworkId: string;
  gas?: number;
  payloadHash?: string;
  payload?: string;
  fee: number;
}

export interface TransactionInput {
  previousOutpoint: Outpoint;
  signatureScript: string;
  sequence: number | bigint;
}

export interface TransactionOutput {
  amount: number | bigint;
  scriptPublicKey: ScriptPublicKey;
}

export interface SubmitTransactionRequest {
  transaction: Transaction;
}

export interface GetTransactionResponse {
  subnetwork_id: string;
  transaction_id: string;
  hash: string;
  mass: string;
  block_hash: string[];
  block_time: number;
  is_accepted: boolean;
  accepting_block_hash: string;
  accepting_block_blue_score: number;
  inputs: GetTransactionInput[];
  outputs: GetTransactionOutput[];
}

export interface GetTransactionInput {
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

export interface GetTransactionOutput {
  id: number;
  transaction_id: string;
  index: number;
  amount: bigint;
  script_public_key: string;
  script_public_key_address: string;
  script_public_key_type: string;
  accepting_block_hash: null;
}
