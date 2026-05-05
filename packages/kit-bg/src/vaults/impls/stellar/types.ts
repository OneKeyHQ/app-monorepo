import type { IEncodedTxStellar } from '@onekeyhq/core/src/chains/stellar/types';

/**
 * Stellar transaction types
 */
export enum EStellarTransactionType {
  PAYMENT = 'payment',
  CREATE_ACCOUNT = 'createAccount',
  CHANGE_TRUST = 'changeTrust',
}

export enum EStellarAssetType {
  Native = 'native',
  ContractToken = 'contract',
  StellarAsset = 'classic',
  StellarAssetContract = 'stellarAssetContract',
}

/**
 * Asset information for Stellar
 */
export interface IStellarAsset {
  code: string; // Asset code (e.g., 'USDC')
  issuer: string; // Issuer address (G...)
  isNative?: boolean; // True for XLM
}

/**
 * Transaction preconditions
 */
export interface IStellarPreconditions {
  timebounds?: {
    minTime?: number;
    maxTime?: number;
  };
  ledgerbounds?: {
    minLedger?: number;
    maxLedger?: number;
  };
  minAccountSequence?: string;
  minAccountSequenceAge?: number;
  minAccountSequenceLedgerGap?: number;
  extraSigners?: string[];
}

/**
 * Parameters for building Stellar transactions
 */
export interface IBuildStellarTxParams {
  from: string; // Source account address
  to: string; // Destination address
  amount: string; // Amount to transfer (in display format)
  asset?: IStellarAsset; // Asset info (undefined = native XLM)
  memo?: string; // Transaction memo
  fee?: string; // Transaction fee in stroops
  sequence?: string; // Account sequence (will be fetched if not provided)
  networkPassphrase?: string; // Network identifier
  preconditions?: IStellarPreconditions;
}

/**
 * Parameters for change trust operation
 */
export interface IChangeTrustParams {
  from: string;
  asset: IStellarAsset;
  limit?: string; // Trust limit (undefined = unlimited)
  memo?: string;
  fee?: string;
  sequence?: string;
  networkPassphrase?: string;
}

/**
 * Encoded transaction result
 */
export interface IEncodedTxResult {
  encodedTx: IEncodedTxStellar;
  txType: EStellarTransactionType;
}
