import type {
  EMessageTypesAda,
  EMessageTypesAlph,
  EMessageTypesAptos,
  EMessageTypesBtc,
  EMessageTypesCommon,
  EMessageTypesEth,
  EMessageTypesSolana,
  EMessageTypesStellar,
  EMessageTypesTon,
  EMessageTypesTron,
} from '@onekeyhq/shared/types/message';

import type { ISignMessageRequest } from '../chains/aptos/types';
import type { SignatureOptions } from 'bitcoinjs-message';

// dapp -> onekey -> external wallet
// dapp -> onekey -> hd, hw, privateKey
// onekey -> external wallet
// onekey -> hd, hw, privateKey
export type IUnsignedMessageEth = {
  type: EMessageTypesEth;
  message: string;
  payload?: any;
};

export type IUnsignedMessageAptos = {
  type: EMessageTypesAptos;
  message: string;
  payload?: ISignMessageRequest;
};

export type ISignDataPayloadText = {
  type: 'text';
  text: string;
};
export type ISignDataPayloadBinary = {
  type: 'binary';
  bytes: string;
};
export type ISignDataPayloadCell = {
  type: 'cell';
  schema: string;
  cell: string;
};

export type IUnsignedMessageTon = {
  type: EMessageTypesTon;
  message: string;
  payload: {
    isProof?: boolean;
    schemaCrc?: number;
    timestamp: number;
    appDomain?: string;
    address?: string;
    payload?:
      | ISignDataPayloadText
      | ISignDataPayloadBinary
      | ISignDataPayloadCell;
  };
};

export type IUnsignedMessageAda = {
  type: EMessageTypesAda;
  message: string;
  payload: {
    addr: string;
    payload: string;
  };
};

export type IUnsignedMessageCommon = {
  type: EMessageTypesCommon;
  message: string;
  secure?: boolean;
  payload?: any;
};

export type IUnsignedMessageBtc = {
  type: EMessageTypesBtc;
  message: string;
  sigOptions?: (SignatureOptions & { noScriptType?: boolean }) | null;
  payload?: {
    isFromDApp?: boolean;
  };
};

export type IUnsignedMessageCfx = IUnsignedMessageEth;

export type IUnsignedMessageAlph = {
  type: EMessageTypesAlph;
  message: string;
  payload?: any;
};

/**
 * Version 0 of the Solana offchain message spec. Legacy: kept because OneKey hardware firmware
 * only implements version 0 today.
 */
export type IOffchainMessagePayloadV0 = {
  version?: 0;
  /** Version 0 only. Removed by version 1 because it is unverifiable and easily forged. */
  applicationDomain?: string;
};

/**
 * Version 1 of the Solana offchain message spec.
 * https://github.com/solana-foundation/SRFCs/discussions/3
 */
export type IOffchainMessagePayloadV1 = {
  version: 1;
  /** Base58 encoded 32-byte signer public keys. Non-empty; the wallet sorts and de-duplicates. */
  requiredSigners: string[];
};

export type IOffchainMessagePayload =
  | IOffchainMessagePayloadV0
  | IOffchainMessagePayloadV1;

export type IUnsignedMessageSolana = {
  type: EMessageTypesSolana;
  message: string;
  payload?: IOffchainMessagePayload;
};

export type IUnsignedMessageTron = {
  type: EMessageTypesTron;
  message: string;
  payload?: any;
};

export type IUnsignedMessageStellar = {
  type: EMessageTypesStellar;
  message: string;
  payload?: {
    networkPassphrase?: string;
  };
};

export type IUnsignedMessage =
  | IUnsignedMessageCommon
  | IUnsignedMessageEth
  | IUnsignedMessageBtc
  | IUnsignedMessageAptos
  | IUnsignedMessageTon
  | IUnsignedMessageTron
  | IUnsignedMessageAda
  | IUnsignedMessageAlph
  | IUnsignedMessageSolana
  | IUnsignedMessageStellar;
