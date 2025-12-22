import bufferUtils from '@onekeyhq/shared/src/utils/bufferUtils';

import sdkStellar from '../sdkStellar';

/**
 * Extract transaction hash from encoded transaction
 * This is what needs to be signed by hardware devices
 */
export function extractTransactionHash(
  encodedTx: string,
  networkPassphrase: string,
): Buffer {
  // Parse as Transaction to get hash
  const tx = new sdkStellar.StellarSdk.Transaction(
    encodedTx,
    networkPassphrase,
  );
  return tx.hash();
}

/**
 * Extract public key from encoded transaction
 */
export function extractSourcePublicKey(encodedTx: string): string {
  const tx = new sdkStellar.StellarSdk.Transaction(
    encodedTx,
    sdkStellar.Networks.PUBLIC,
  );
  return tx.source;
}

/**
 * Get network passphrase from transaction envelope
 * Note: XDR doesn't contain the network passphrase directly,
 * so this is a best-effort detection by trying to parse with known networks
 */
export function getNetworkPassphrase(encodedTx: string): string {
  // Try testnet first (as it's often used for development)
  try {
    // eslint-disable-next-line no-new
    new sdkStellar.StellarSdk.Transaction(
      encodedTx,
      sdkStellar.Networks.TESTNET,
    );
    return sdkStellar.Networks.TESTNET;
  } catch {
    // If testnet fails, assume public network
    return sdkStellar.Networks.PUBLIC;
  }
}

/**
 * Validate transaction XDR format
 */
export function validateTransactionXDR(encodedTx: string): boolean {
  try {
    // eslint-disable-next-line no-new
    new sdkStellar.StellarSdk.Transaction(
      encodedTx,
      sdkStellar.Networks.PUBLIC,
    );
    return true;
  } catch {
    return false;
  }
}

/**
 * Get transaction operations count
 */
export function getOperationsCount(encodedTx: string): number {
  const tx = new sdkStellar.StellarSdk.Transaction(
    encodedTx,
    sdkStellar.Networks.PUBLIC,
  );
  return tx.operations.length;
}

/**
 * Get transaction sequence number
 */
export function getTransactionSequence(encodedTx: string): string {
  const tx = new sdkStellar.StellarSdk.Transaction(
    encodedTx,
    sdkStellar.Networks.PUBLIC,
  );
  return tx.sequence;
}

/**
 * Get transaction fee
 */
export function getTransactionFee(encodedTx: string): string {
  const tx = new sdkStellar.StellarSdk.Transaction(
    encodedTx,
    sdkStellar.Networks.PUBLIC,
  );
  return tx.fee;
}
