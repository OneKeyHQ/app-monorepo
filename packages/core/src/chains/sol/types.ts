import type { Transaction, VersionedTransaction } from '@solana/web3.js';

export type IEncodedTxSol = string; // bs58 encoded string
export type INativeTxSol = Transaction | VersionedTransaction;
export type IDecodedTxExtraSol = {
  createTokenAccountFee?: {
    amount: string;
    amountValue: string;
    symbol: string;
  };
};

export enum EOffChainMessageType {
  STANDARD = 'STANDARD',
  LEGACY = 'LEGACY',
  V1 = 'V1',
  INVALID = 'INVALID',
}

export interface IOffChainMessageHeaderLegacy {
  version: number; // 1 byte
  format: number; // 1 byte
  length: number; // 2 bytes, little-endian
}

export interface IOffChainMessageHeaderStandard {
  signatureCount: number; // 1 byte
  signatures: Uint8Array[]; // signatureCount * 64 bytes
  version: number; // 1 byte
  applicationDomain: Uint8Array; // 32 bytes
  format: number; // 1 byte
  signersCount: number; // 1 byte
  signerPublicKeys: Uint8Array[]; // signersCount * 32 bytes
  messageLength: number; // 2 bytes, little-endian
}

export interface ICreateOffChainMessageOptions {
  message: string;
  applicationDomain?: Uint8Array | string;
  signerPublicKeys?: Uint8Array[];
  format?: 0 | 1 | 2;
  isLegacy?: boolean;
}

/**
 * Version 1 of the Solana offchain message specification.
 * https://github.com/solana-foundation/SRFCs/discussions/3
 *
 * Layout: signingDomain(16) | version(1) = 1 | signerCount(1) | signers(32 each, sorted+unique)
 *         | content (UTF-8, trailing, no length prefix)
 *
 * Compared with version 0 this drops the message format enum, the u16 content length prefix and
 * the easily forged 32 byte application domain, and constrains the signer list to be unique and
 * lexicographically ordered.
 */
export interface ICreateOffChainMessageV1Options {
  /** UTF-8 message body. Must not be empty. */
  message: string;
  /** 32-byte signer public keys. Must be non-empty; sorted and de-duplicated during encoding. */
  requiredSigners: Uint8Array[];
}

export interface IOffChainMessageHeaderV1 {
  version: 1; // 1 byte
  signersCount: number; // 1 byte
  requiredSigners: Uint8Array[]; // signersCount * 32 bytes
}

export interface IATADetails {
  owner: string;
  programId: string;
  mintAddress: string;
  associatedTokenAddress: string;
}
