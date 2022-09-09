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

import BigNumber from 'bignumber.js';

// TODO: add more types
export type PayloadType = 'entry_function_payload';

export type IEncodedTxAptos = {
  sender?: string;
  sequence_number?: number;
  max_gas_amount?: string;
  gas_unit_price?: string;
  expiration_timestamp_secs?: BigNumber | string;
  chain_id?: number;

  //  payload
  type: PayloadType;
  function?: string;
  arguments?: string[];
  type_arguments?: any[];
  code?: any[];
};
