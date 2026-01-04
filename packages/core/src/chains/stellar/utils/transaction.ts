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
