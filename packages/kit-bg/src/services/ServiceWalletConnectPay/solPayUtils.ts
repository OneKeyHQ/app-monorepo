import bs58 from 'bs58';

import { OneKeyError } from '@onekeyhq/shared/src/errors';

/**
 * Extract the base64-encoded transaction from `solana_signTransaction`
 * action params. The Pay server sends `[{ transaction }]`; the unwrapped
 * object and a bare string are accepted as defensive variants.
 */
export function extractWcPaySolanaTransaction(parsed: unknown): string {
  const candidates = Array.isArray(parsed) ? parsed : [parsed];
  for (const item of candidates) {
    if (typeof item === 'string' && item) {
      return item;
    }
    if (typeof item === 'object' && item !== null) {
      const { transaction } = item as { transaction?: unknown };
      if (typeof transaction === 'string' && transaction) {
        return transaction;
      }
    }
  }
  throw new OneKeyError('Invalid solana_signTransaction params');
}

/**
 * WalletConnect Pay carries Solana transactions as base64 while the sol
 * vault only parses bs58 encodedTx (`parseToNativeTx` default), so the
 * payload must be transcoded before entering the sign-only confirm flow.
 * Garbage input still fails later at native-tx parse; only emptiness is
 * checked here to avoid dragging @solana/web3.js into the UI bundle.
 */
export function wcPaySolanaTxToEncodedTx(txBase64: string): string {
  const bytes = Buffer.from(txBase64, 'base64');
  if (bytes.length === 0) {
    throw new OneKeyError('Invalid Solana transaction payload');
  }
  return bs58.encode(bytes);
}
