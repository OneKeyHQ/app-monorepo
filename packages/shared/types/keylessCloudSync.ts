/**
 * Keyless Cloud Sync Types
 *
 * Keyless sync uses the unique Keyless wallet mnemonic to derive keys for encryption and signature authentication.
 * Coexists with OneKey ID encryption mode, implementing a dual-encryption scheme.
 */

import type { IDeviceType } from '@onekeyfe/hd-core';

/**
 * Standard hardware wallet that supplies the Cloud sync key. It is read from the
 * device when sync is turned on; no wallet record is created in the App.
 */
export type IHardwareCloudSyncKeySource = {
  type: 'hardware';
  // Ends with the SHA-256 of the standard wallet identity, so signing again
  // can check the recovery phrase without keeping its xpub.
  credentialId: string;
  derivationVersion: 1;
  // Display only. Another device restored from the same recovery phrase can
  // sign again.
  deviceName: string;
  deviceType: IDeviceType;
};

/**
 * Keyless sync credentials (derived from the unique Keyless wallet mnemonic)
 */
export interface IKeylessCloudSyncCredential {
  /** Keyless wallet ID */
  keylessWalletId: string;
  // Absent on existing Keyless credentials. This metadata never leaves the App.
  source?: IHardwareCloudSyncKeySource;
  /** Signing private key (hex) - derivation path m/44'/1919'/0'/0/0 */
  signingPrivateKey: string;
  /** Signing public key (hex) */
  signingPublicKey: string;
  /** Encryption key (hex) - derivation path m/44'/1919'/0'/0/1 */
  encryptionKey: string;
  /** Password hash (computed from encryptionKey for sync item validation) */
  pwdHash: string; // TODO save to Wallet DB
  // Hardware keys only: encryptionKey is then the data key (DEK) unwrapped
  // from the server, and requests use these DPoP-bound tokens.
  hardwareSession?: IHardwareCloudSyncSession;
  // Set while a key reset is between saving the new key and the server
  // switching to it; finished or dropped on the next sync.
  pendingDataKey?: {
    dek: string;
    dekId: string;
    pwdHash: string;
    // Envelope generation of the new key; absent in older saved credentials.
    generation?: number;
  };
}

export type IHardwareCloudSyncSession = {
  // P-256 private JWK that binds the tokens to this App install.
  deviceKeyJwk: IHardwareCloudSyncDeviceKeyJwk;
  accessToken: string;
  accessTokenExpiresAt: number;
  refreshToken: string;
  sessionId: string;
  dekId: string;
};

export type IHardwareCloudSyncDeviceKeyJwk = {
  kty: 'EC';
  crv: 'P-256';
  x: string;
  y: string;
  d: string;
};

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
