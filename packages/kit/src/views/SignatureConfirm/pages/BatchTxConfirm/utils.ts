import BigNumber from 'bignumber.js';

// U+2212 MINUS SIGN (not a hyphen) to match the outgoing-amount style used
// across the app's transaction rows. The container owns amount formatting,
// including the zero-amount exception for degenerate no-value psbts.
export const MINUS_SIGN = '−';

// Shared between TransactionRow and BatchSigningProgress's "current
// transaction" card so both surfaces describe multi-output items the same
// way. Pure self-transfer psbts carry their owned recipient in `recipient`
// (mirroring the single-psbt confirm page), so an empty recipient only
// remains for outputs whose scripts decode to no address (e.g. OP_RETURN).
export function formatRecipientLine({
  recipient,
  extraRecipientCount,
}: {
  recipient: string;
  extraRecipientCount: number;
}): string {
  if (!recipient) {
    return 'To multiple outputs';
  }
  return extraRecipientCount > 0
    ? `To ${recipient} +${extraRecipientCount}`
    : `To ${recipient}`;
}

// The wallet API delivers `price` as a number, a numeric string, or a
// no-price sentinel ('--' on signet, '0' on testnet3). A truthiness check
// lets the sentinels through and the fiat math then renders a bare 'NaN'
// (or a misleading '$0.00') under the amount, so only a finite positive
// price is usable for the fiat line; everything else means "no fiat line".
export function normalizeNativePrice(
  price: number | string | undefined,
): string | undefined {
  if (price === undefined) {
    return undefined;
  }
  const priceBn = new BigNumber(price);
  if (!priceBn.isFinite() || priceBn.lte(0)) {
    return undefined;
  }
  return priceBn.toFixed();
}
