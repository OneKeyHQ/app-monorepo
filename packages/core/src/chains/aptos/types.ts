/* eslint-disable camelcase */
/**
 * payload : EntryFunction、Script、Module
 *
 * EntryFunction:{ module_name: string; function_name: string; args: bytes[]; arguments: TypeTag[]; }
 *
 * Script:{ script_function }
 *
 * Module:{ code: Bytes }
 */

// TODO: add more types
export type IPayloadType = 'entry_function_payload';

export type ITxPayload = {
  type: IPayloadType;
  function?: string;
  arguments?: any[];
  type_arguments?: any[];
  code?: any[];
};

export type IEncodedTxAptos = {
  sender?: string;
  sequence_number?: string;
  max_gas_amount?: string;
  gas_unit_price?: string;
  expiration_timestamp_secs?: string;
  chain_id?: number;
  bcsTxn?: string;
  forcePendingTx?: boolean;
  payload?: ITxPayload;

  // From dApp, not edit tx
  disableEditTx?: boolean;
} & ITxPayload;

export interface ISignMessagePayload {
  address?: boolean; // Should we include the address of the account in the message
  application?: boolean; // Should we include the domain of the dapp
  chainId?: boolean; // Should we include the current chain id the wallet is connected to
  message: string; // The message to be signed and displayed to the user
  nonce: string; // A nonce the dapp should generate
}

export interface ISignMessageRequest {
  address?: string;
  application?: string;
  chainId?: number;
  message: string; // The message passed in by the user
  nonce: string;
  fullMessage: string; // The message that was generated to sign
}

export interface ISignMessageResponse extends ISignMessageRequest {
  prefix: string; // Should always be APTOS
  signature: string; // The signed full message
}
