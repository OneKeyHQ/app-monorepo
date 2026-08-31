import BigNumber from 'bignumber.js';

import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';

import type { IWcPayInlineSigningSummary } from '../hooks/wcPayInlineUtils';

// The two lines the sheet shows while a headless signature is being produced:
// what the user is committing to, and what it costs beyond the amount already
// on screen. Both are built here — one i18n site, one testable unit — and both
// are pure so they need no render harness.
//
// Copy is hardcoded English like the rest of this scene.
// copy pending product i18n keys

const LAMPORTS_PER_SOL_DECIMALS = 9;
const SECONDS_PER_MINUTE = 60;
const SECONDS_PER_HOUR = 60 * 60;

/**
 * The headline is split on `kind` rather than shared, because the two
 * signatures commit to different things: a Permit2 payload authorizes a
 * spender to pull the amount later, while the Solana leg signs the transfer
 * itself — irreversible once submitted, and not an allowance.
 */
export function describeWcPaySigningHeadline(
  summary: IWcPayInlineSigningSummary,
  amountText: string,
): string {
  return summary.kind === 'typedData'
    ? `Authorize ${amountText} for this payment`
    : `Sign this ${amountText} payment`;
}

/**
 * How much longer the permit stays valid, always relative: the validator
 * refuses a deadline further out than WC_PAY_PERMIT_MAX_DEADLINE_S (24h), so
 * an absolute timestamp would only add a timezone the reader has to convert.
 *
 * Both units are FLOORED — the text may never claim more validity than the
 * signature actually has. The non-finite branch is totality, not a defense:
 * `deadlineSec` is produced in-process from a regex-validated uint, so it
 * cannot arrive as NaN today; the branch keeps the function total if that
 * ever changes, rather than rendering "Expires in NaN min".
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
    const parts = [
      `Spender ${accountUtils.shortenAddress({
        address: summary.summary.spender,
        minLength: 12,
        leadingLength: 6,
        trailingLength: 4,
      })}`,
    ];
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
  // isFinite() is load-bearing beyond the NaN case: it is what stops an
  // 'Infinity' fee from rendering as "up to Infinity SOL".
  if (fee.isFinite() && fee.isGreaterThan(0)) {
    parts.push(
      `Network priority fee up to ${fee
        .shiftedBy(-LAMPORTS_PER_SOL_DECIMALS)
        .toFixed()} SOL`,
    );
  }
  if (summary.summary.fundsRecipientAta) {
    // No figure on purpose: the standard ATA rent is ~0.002 SOL, but a
    // Token-2022 mint with extensions needs a larger account and costs
    // more, and the validator cannot bound it offline — a hardcoded number
    // would understate the real charge.
    parts.push('Creates the recipient token account (rent varies by token)');
  }
  return parts.length > 0 ? parts.join(' · ') : 'Signs the payment transaction';
}
