import BigNumber from 'bignumber.js';

import type { IWcPayInlineSigningSummary } from '../hooks/wcPayInlineUtils';

// The secondary line the sheet shows while a headless signature is being
// produced: what the proven payload commits the user to beyond the amount
// already on screen. Pure so it can be tested without a render harness.
//
// Copy is hardcoded English like the rest of this scene.
// copy pending product i18n keys

const LAMPORTS_PER_SOL_DECIMALS = 9;
const SECONDS_PER_MINUTE = 60;
const SECONDS_PER_HOUR = 60 * 60;

export function shortenWcPayAddress(address: string): string {
  if (!address) {
    return '';
  }
  return address.length > 12
    ? `${address.slice(0, 6)}…${address.slice(-4)}`
    : address;
}

/**
 * How much longer the permit stays valid, always relative: the validator
 * refuses a deadline further out than WC_PAY_PERMIT_MAX_DEADLINE_S (24h), so
 * an absolute timestamp would only add a timezone the reader has to convert.
 *
 * Both units are FLOORED — the text may never claim more validity than the
 * signature actually has — and a deadline this side cannot read (the summary
 * crosses a serialization boundary) yields no text at all rather than a
 * fabricated one.
 */
function describeWcPayPermitExpiry({
  deadlineSec,
  nowMs,
}: {
  deadlineSec: number;
  nowMs: number;
}): string | undefined {
  if (!Number.isFinite(deadlineSec)) {
    return undefined;
  }
  const remainingSec = deadlineSec - nowMs / 1000;
  if (remainingSec <= 0) {
    return 'Expired';
  }
  if (remainingSec < SECONDS_PER_MINUTE) {
    return 'Expires in under a minute';
  }
  if (remainingSec < SECONDS_PER_HOUR) {
    return `Expires in ${Math.floor(remainingSec / SECONDS_PER_MINUTE)} min`;
  }
  return `Expires in ${Math.floor(remainingSec / SECONDS_PER_HOUR)} h`;
}

export function describeWcPaySigningSummary(
  summary: IWcPayInlineSigningSummary,
  nowMs: number = Date.now(),
): string {
  if (summary.kind === 'typedData') {
    // A permit hands a named spender a standing pull of the amount, so the
    // spender and how long it lasts are the two facts the amount alone does
    // not carry.
    const parts = [`Spender ${shortenWcPayAddress(summary.summary.spender)}`];
    const expiry = describeWcPayPermitExpiry({
      deadlineSec: summary.summary.deadlineSec,
      nowMs,
    });
    if (expiry) {
      parts.push(expiry);
    }
    return parts.join(' · ');
  }
  // Solana: the validator bounds the priority fee (<= 0.01 SOL) and at most
  // one recipient token-account rent; both are costs beyond the amount, so
  // name them.
  const parts: string[] = [];
  const fee = new BigNumber(summary.summary.priorityFeeLamports);
  if (fee.isFinite() && fee.isGreaterThan(0)) {
    parts.push(
      `Network priority fee up to ${fee
        .shiftedBy(-LAMPORTS_PER_SOL_DECIMALS)
        .toFixed()} SOL`,
    );
  }
  if (summary.summary.fundsRecipientAta) {
    parts.push('Creates the recipient token account (small SOL rent)');
  }
  return parts.length > 0 ? parts.join(' · ') : 'Signs the payment transaction';
}
