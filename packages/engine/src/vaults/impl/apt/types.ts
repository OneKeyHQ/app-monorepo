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
export type PayloadType = 'entry_function_payload';

export type TxPayload = {
  type: PayloadType;
  function?: string;
  arguments?: string[];
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

  //  payload
} & TxPayload;
