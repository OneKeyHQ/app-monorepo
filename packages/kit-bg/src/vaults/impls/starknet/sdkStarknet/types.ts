import type {
  IStarknetSignedDeployAccount,
  IStarknetSignedInvoke,
} from '@onekeyhq/core/src/chains/starknet/types';

/** What ClientStarknet talks through: direct JSON-RPC or the backend proxy. */
export interface IStarknetTransport {
  /** the endpoint being called, or '' when requests go through the proxy */
  readonly rpcUrl: string;
  request<T>(method: string, params: unknown[]): Promise<T>;
}

/** A block tag or a block number, as starknet_* methods accept it. */
export type IStarknetBlockId = string | { block_number: number };

/** Read-only contract call, RPC casing. */
export type IStarknetCallRequest = {
  contract_address: string;
  entry_point_selector: string;
  calldata: string[];
};

/**
 * starknet_estimateFee result element. Every value is hex; `unit` is FRI for a
 * v3 transaction. Field names are the RPC 0.8+ six-value form and are identical
 * on spec 0.9.0 and 0.10.2 (verified against both live endpoints).
 */
export type IStarknetFeeEstimate = {
  l1_gas_consumed: string;
  l1_gas_price: string;
  l2_gas_consumed: string;
  l2_gas_price: string;
  l1_data_gas_consumed: string;
  l1_data_gas_price: string;
  overall_fee: string;
  unit: string;
};

export type IStarknetExecutionStatus = 'SUCCEEDED' | 'REVERTED';

export type IStarknetFinalityStatus =
  | 'RECEIVED'
  | 'CANDIDATE'
  | 'PRE_CONFIRMED'
  | 'ACCEPTED_ON_L2'
  | 'ACCEPTED_ON_L1'
  | 'REJECTED';

export type IStarknetReceipt = {
  transaction_hash: string;
  type: string;
  execution_status: IStarknetExecutionStatus;
  finality_status: IStarknetFinalityStatus;
  actual_fee?: { amount: string; unit: string };
  block_number?: number;
  block_hash?: string;
  revert_reason?: string;
};

/**
 * BROADCASTED_INVOKE_TXN: INVOKE_TXN_V3 plus the STRK20 `proof`, which is not
 * part of the transaction and therefore not hashed.
 */
export type IStarknetBroadcastInvokeTx = IStarknetSignedInvoke & {
  proof?: string;
};

/** Either leg of a Starknet send, in the order they must be broadcast. */
export type IStarknetBroadcastTx =
  | IStarknetSignedDeployAccount
  | IStarknetBroadcastInvokeTx;

export type IStarknetAddInvokeResult = {
  transaction_hash: string;
};

export type IStarknetAddDeployAccountResult = {
  transaction_hash: string;
  contract_address: string;
};
