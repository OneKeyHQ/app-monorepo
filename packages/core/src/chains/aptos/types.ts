import type {
  AptosSignInBoundFields,
  AptosSignInInput,
} from '@aptos-labs/siwa';

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
  type: 'entry_function_payload';
  function?: string;
  arguments: any[];
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
  forcePendingTx?: boolean;

  // payload is equal to bcsTxn
  payload?: ITxPayload;
  bcsTxn?: string;

  // From dApp, not edit tx
  disableEditTx?: boolean;

  // @deprecated
  type?: string;
  function?: string;
  arguments?: any[];
  type_arguments?: any[];
  code?: any[];
};

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

export type IAptosSignInOutput = {
  /**
   * Account information of the user.
   */
  account: {
    address: string;
    publicKey: string;
  };
  /**
   * Input fields to the `signIn` signing request to the wallet. The wallet will ensure that any bound fields not included in the `AptosSignInInput` are included in the output.
   */
  input: AptosSignInInput & AptosSignInBoundFields;
  /**
   * Signature of the SIWA Signing Message constructed from the `input` fields.
   */
  signature: string;
  /**
   * The type of signing scheme used to sign the message.
   *
   * @example 'ed25519' | 'multi_ed25519' | 'single_key' | 'multi_key'
   */
  type: string;
};
