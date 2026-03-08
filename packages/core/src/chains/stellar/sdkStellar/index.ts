import * as StellarSdk from '@stellar/stellar-base';

export function encodeAddress(publicKey: Buffer): string {
  return StellarSdk.StrKey.encodeEd25519PublicKey(publicKey);
}

export function decodeAddress(address: string): Buffer {
  return Buffer.from(StellarSdk.StrKey.decodeEd25519PublicKey(address));
}

export function isValidAddress(address: string): boolean {
  try {
    return (
      StellarSdk.StrKey.isValidEd25519PublicKey(address) ||
      StellarSdk.StrKey.isValidMed25519PublicKey(address)
    );
  } catch (_error) {
    return false;
  }
}

export function encodeSecretKey(privateKey: Buffer): string {
  return StellarSdk.StrKey.encodeEd25519SecretSeed(privateKey);
}

export function decodeSecretKey(secretKey: string): Buffer {
  return Buffer.from(StellarSdk.StrKey.decodeEd25519SecretSeed(secretKey));
}

// Export key Stellar SDK classes and utilities
export const {
  Account,
  Asset,
  Memo,
  Operation,
  TransactionBuilder,
  Networks,
  Keypair,
  StrKey,
  xdr,
} = StellarSdk;

export { StellarSdk };

export default {
  encodeAddress,
  decodeAddress,
  isValidAddress,
  encodeSecretKey,
  decodeSecretKey,
  StellarSdk,
  Account,
  Asset,
  Memo,
  Operation,
  TransactionBuilder,
  Networks,
  Keypair,
  StrKey,
  xdr,
};
