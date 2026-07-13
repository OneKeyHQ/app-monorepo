import { BITREFILL_EMBED_ORIGIN } from './bitrefillUtils';

export interface IBitrefillPaymentIntent {
  event: 'payment_intent';
  paymentUri: string;
}

/**
 * Accept only the exact embed origin. Subdomain matching is intentionally
 * disabled — Bitrefill only uses embed.bitrefill.com for the iframe widget.
 */
export function isBitrefillOrigin(origin: string | undefined): boolean {
  return origin === BITREFILL_EMBED_ORIGIN;
}

/**
 * Parse a raw postMessage payload into a Bitrefill payment_intent event.
 * Returns null if the payload is not a valid payment_intent with a non-empty
 * paymentUri string. Other Bitrefill events (invoice_created/update/complete)
 * are intentionally ignored in the minimal integration.
 */
export function parseBitrefillPaymentIntent(
  raw: unknown,
): IBitrefillPaymentIntent | null {
  let data: unknown = raw;
  if (typeof raw === 'string') {
    try {
      data = JSON.parse(raw);
    } catch {
      return null;
    }
  }
  if (!data || typeof data !== 'object') {
    return null;
  }
  const obj = data as Record<string, unknown>;
  if (obj.event !== 'payment_intent') {
    return null;
  }
  if (typeof obj.paymentUri !== 'string' || obj.paymentUri.length === 0) {
    return null;
  }
  return { event: 'payment_intent', paymentUri: obj.paymentUri };
}
