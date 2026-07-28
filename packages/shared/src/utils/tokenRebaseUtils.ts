import BigNumber from 'bignumber.js';

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
 */

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
  return amountBN.div(multiplierBN).toFixed(decimals, BigNumber.ROUND_FLOOR);
}

export default {
  isValidBalanceMultiplier,
  applyBalanceMultiplier,
  removeBalanceMultiplier,
};
