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

import { TxnBuilderTypes } from 'aptos';

import type { BCS } from 'aptos';

// TODO: add more types
export type PayloadType = 'entry_function_payload';

export type TxPayload = {
  type: PayloadType;
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

  // bcs tnx
  bscTxn?: string;

  forcePendingTx?: boolean;
} & TxPayload;

export class ArgumentABI {
  public readonly name: string;

  public readonly type_tag: TxnBuilderTypes.TypeTag;

  constructor(name: string, type_tag: TxnBuilderTypes.TypeTag) {
    this.name = name;
    this.type_tag = type_tag;
  }

  serialize(serializer: BCS.Serializer): void {
    serializer.serializeStr(this.name);
    this.type_tag.serialize(serializer);
  }

  static deserialize(deserializer: BCS.Deserializer): ArgumentABI {
    const name = deserializer.deserializeStr();
    const typeTag = TxnBuilderTypes.TypeTag.deserialize(deserializer);
    return new ArgumentABI(name, typeTag);
  }
}

export interface SignMessagePayload {
  address?: boolean; // Should we include the address of the account in the message
  application?: boolean; // Should we include the domain of the dapp
  chainId?: boolean; // Should we include the current chain id the wallet is connected to
  message: string; // The message to be signed and displayed to the user
  nonce: number; // A nonce the dapp should generate
}

export interface SignMessageRequest {
  address?: string;
  application?: string;
  chainId?: number;
  message: string; // The message passed in by the user
  nonce: number;
  fullMessage: string; // The message that was generated to sign
}

export interface SignMessageResponse extends SignMessageRequest {
  prefix: string; // Should always be APTOS
  signature: string; // The signed full message
}
