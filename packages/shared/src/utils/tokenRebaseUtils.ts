import BigNumber from 'bignumber.js';

import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';

/**
 * Utilities for "rebase" / scaled-UI tokens (e.g. xStocks on Solana
 * Token-2022 Scaled UI Amount and TON TEP-0526).
 *
 * Contract (OK-58046 "Plan A"):
 * - `balance` / `balanceParsed` from the wallet server stay RAW everywhere
 *   (state, cache, ITransferInfo.amount).
 * - Display leaves show `balanceParsed × balanceMultiplier`.
 * - Transaction building converts user-entered display amounts back to raw
 *   (`÷ balanceMultiplier`, floored at token decimals); max-send uses the raw
 *   balance directly and must never go through the division.
 * - `fiatValue` / `netWorth` arrive already multiplied by the server; never
 *   multiply fiat values client-side.
 * - The multiplier used when building a transaction MUST come from the same
 *   token snapshot that rendered the displayed amount — never re-fetch the
 *   multiplier between showing an amount and submitting it, or the
 *   display -> raw conversion will not match what the user saw.
 * - `removeBalanceMultiplier` deliberately passes the amount through
 *   unchanged when the multiplier is missing/invalid/1; only the multiply
 *   path (a real division) normalizes the output string format.
 */

// Divisions must never round upward: clone with generous precision and
// truncation so the global BigNumber config cannot affect this module.
const BigNumberFloor = BigNumber.clone({
  DECIMAL_PLACES: 60,
  ROUNDING_MODE: BigNumber.ROUND_DOWN,
});

function parseBalanceMultiplier(
  balanceMultiplier: string | undefined,
): BigNumber | undefined {
  if (!balanceMultiplier) {
    return undefined;
  }
  const bn = new BigNumber(balanceMultiplier);
  if (!bn.isFinite() || bn.lte(0)) {
    return undefined;
  }
  return bn;
}

function isValidBalanceMultiplier(
  balanceMultiplier: string | undefined,
): balanceMultiplier is string {
  return parseBalanceMultiplier(balanceMultiplier) !== undefined;
}

// raw parsed amount -> display amount
function applyBalanceMultiplier(params: {
  amount: string;
  balanceMultiplier: string | undefined;
}): string;
function applyBalanceMultiplier(params: {
  amount: string | undefined;
  balanceMultiplier: string | undefined;
}): string | undefined;
function applyBalanceMultiplier({
  amount,
  balanceMultiplier,
}: {
  amount: string | undefined;
  balanceMultiplier: string | undefined;
}): string | undefined {
  if (amount === undefined) {
    return undefined;
  }
  const multiplierBN = parseBalanceMultiplier(balanceMultiplier);
  if (!multiplierBN || multiplierBN.eq(1)) {
    return amount;
  }
  const amountBN = new BigNumber(amount);
  if (!amountBN.isFinite()) {
    return amount;
  }
  return amountBN.times(multiplierBN).toFixed();
}

// display amount -> raw parsed amount, floored at token decimals so the
// subsequent shiftedBy(decimals) yields an integer that never exceeds the
// raw balance.
function removeBalanceMultiplier({
  amount,
  balanceMultiplier,
  decimals,
}: {
  amount: string;
  balanceMultiplier: string | undefined;
  decimals: number;
}): string {
  const multiplierBN = parseBalanceMultiplier(balanceMultiplier);
  if (!multiplierBN || multiplierBN.eq(1)) {
    return amount;
  }
  const amountBN = new BigNumber(amount);
  if (!amountBN.isFinite()) {
    return amount;
  }
  if (!Number.isInteger(decimals) || decimals < 0) {
    throw new OneKeyLocalError(
      `removeBalanceMultiplier ERROR: invalid decimals: ${String(decimals)}`,
    );
  }
  return new BigNumberFloor(amount)
    .div(multiplierBN.toFixed())
    .toFixed(decimals, BigNumber.ROUND_DOWN);
}

export default {
  isValidBalanceMultiplier,
  applyBalanceMultiplier,
  removeBalanceMultiplier,
};
