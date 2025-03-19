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
