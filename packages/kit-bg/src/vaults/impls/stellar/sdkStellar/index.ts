import sdkStellar from '@onekeyhq/core/src/chains/stellar/sdkStellar';

// Re-export all utilities and classes from core
export const {
  encodeAddress,
  decodeAddress,
  isValidAddress,
  encodeSecretKey,
  decodeSecretKey,
  Account,
  Asset,
  Memo,
  Operation,
  TransactionBuilder,
  Networks,
  Keypair,
  StrKey,
  StellarSdk,
  xdr,
} = sdkStellar;

export default sdkStellar;
