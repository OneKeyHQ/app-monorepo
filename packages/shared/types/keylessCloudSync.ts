/**
 * Keyless Cloud Sync Types
 *
 * Keyless sync uses the unique Keyless wallet mnemonic to derive keys for encryption and signature authentication.
 * Coexists with OneKey ID encryption mode, implementing a dual-encryption scheme.
 */

/**
 * Keyless sync credentials (derived from the unique Keyless wallet mnemonic)
 */
export interface IKeylessCloudSyncCredential {
  /** Keyless wallet ID */
  keylessWalletId: string;
  /** Signing private key (hex) - derivation path m/44'/1919'/0'/0/0 */
  signingPrivateKey: string;
  /** Signing public key (hex) */
  signingPublicKey: string;
  /** Encryption key (hex) - derivation path m/44'/1919'/0'/0/1 */
  encryptionKey: string;
  /** Password hash (computed from encryptionKey for sync item validation) */
  pwdHash: string; // TODO save to Wallet DB
}

/**
 * Keyless signature Header content (Base64 encoded for Header)
 */
export interface IKeylessCloudSyncSignaturePayload {
  /** Signing public key */
  publicKey: string;
  /** Signature */
  signature: string;
  /** Timestamp */
  timestamp: number;
  /** Anti-replay nonce */
  nonce: string;
}

/**
 * Signature message body (raw data before signing)
 *
 * IMPORTANT: dataHash is REQUIRED to bind the signature to specific request data,
 * preventing request tampering and replay attacks with modified payloads.
 */
export interface IKeylessCloudSyncSignMessage {
  /** Timestamp */
  timestamp: number;
  /** Anti-replay nonce */
  nonce: string;
  /** SHA256 hash of request data (REQUIRED for security) */
  dataHash: string;
}

/**
 * Sync mode enum
 */
export enum ECloudSyncMode {
  /** OneKey ID encryption mode */
  OnekeyId = 'onekey-id',
  /** Keyless encryption mode */
  Keyless = 'keyless',
  /** No sync (local storage only) */
  None = 'none',
}
