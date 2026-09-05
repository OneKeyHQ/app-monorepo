import bs58 from 'bs58';

import {
  EWcPayErrorCode,
  WcPayError,
} from '@onekeyhq/shared/src/walletConnect/payErrors';

// generous multiple of Solana's 1232-byte packet limit. Exported so the UI
// can refuse an oversize blob before it crosses the background proxy, using
// the very bound this module enforces.
export const WC_PAY_SOLANA_TX_MAX_BYTES = 4096;

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
  throw new WcPayError({
    code: EWcPayErrorCode.InvalidActionParams,
    message: 'Invalid solana_signTransaction params',
  });
}

/**
 * WalletConnect Pay carries Solana transactions as base64 while the sol
 * vault only parses bs58 encodedTx (`parseToNativeTx` default), so the
 * payload must be transcoded before entering the sign-only confirm flow.
 * Garbage input still fails later at native-tx parse; only emptiness and
 * a size cap are checked here to avoid dragging @solana/web3.js into the
 * UI bundle.
 */
export function wcPaySolanaTxToEncodedTx(txBase64: string): string {
  const bytes = Buffer.from(txBase64, 'base64');
  if (bytes.length === 0) {
    throw new WcPayError({
      code: EWcPayErrorCode.InvalidSolanaPayload,
      message: 'Invalid Solana transaction payload',
    });
  }
  // Solana wire transactions are capped at 1232 bytes (PACKET_DATA_SIZE);
  // bs58 encoding is O(n^2), so reject oversized payloads before encoding
  // to keep a hostile server from freezing the UI thread.
  if (bytes.length > WC_PAY_SOLANA_TX_MAX_BYTES) {
    throw new WcPayError({
      code: EWcPayErrorCode.InvalidSolanaPayload,
      message: 'Solana transaction payload too large',
    });
  }
  return bs58.encode(bytes);
}
