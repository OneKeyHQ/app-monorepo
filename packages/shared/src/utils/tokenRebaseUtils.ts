import BigNumber from 'bignumber.js';

import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';

import type {
  IFetchAccountTokensResp,
  IFetchTokenDetailItem,
} from '../../types/token';

/**
 * Utilities for "rebase" / scaled-UI tokens (e.g. xStocks on Solana
 * Token-2022 Scaled UI Amount and TON TEP-0526).
 *
 * Contract (OK-58046 "Plan A"):
 * - `balance` / `balanceParsed` from the wallet server stay RAW everywhere
 *   (state, cache, ITransferInfo.amount).
 * - Display leaves show `balanceParsed × balanceMultiplier`.
 * - Transaction building converts user-entered display amounts back to raw
 *   (`÷ balanceMultiplier`, truncated (ROUND_DOWN) at token decimals);
 *   max-send uses the raw balance directly and must never go through the
 *   division.
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

// display amount -> raw parsed amount, truncated (ROUND_DOWN) at token
// decimals so the subsequent shiftedBy(decimals) yields an integer that
// never exceeds the raw balance.
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

// Server payload placement is not guaranteed (item-level next to `balance`
// vs. inside `info`); accept either and mirror onto both levels so
// downstream code can read it from IToken (tx building, getToken /
// localTokens) or ITokenFiat (display leaves subscribing to the fiat map)
// alike. When both levels are present, the balance-adjacent level wins.
function normalizeTokenDetailItemsBalanceMultiplier<
  T extends IFetchTokenDetailItem | undefined,
>(items: T[] | undefined): T[] | undefined {
  items?.forEach((item) => {
    if (!item) return;
    const multiplier = item.balanceMultiplier ?? item.info.balanceMultiplier;
    if (isValidBalanceMultiplier(multiplier)) {
      item.balanceMultiplier = multiplier;
      item.info.balanceMultiplier = multiplier;
    }
  });
  return items;
}

// Same item-level vs. info-level ambiguity as above, but for the account
// token list response: each group (tokens / riskTokens / smallBalanceTokens
// / allTokens) carries a `data[]` array (IAccountToken, i.e. IToken) and a
// parallel `map` keyed by `$key` (ITokenFiat). Mirror the multiplier onto
// both so display (reads map) and tx building (reads data/IToken) agree.
// When both are present, the map (fiat, balance-adjacent) level wins.
function normalizeAccountTokensRespBalanceMultiplier(
  resp: IFetchAccountTokensResp | undefined,
): IFetchAccountTokensResp | undefined {
  if (!resp) return resp;
  [
    resp.allTokens,
    resp.tokens,
    resp.riskTokens,
    resp.smallBalanceTokens,
  ].forEach((group) => {
    if (!group) return;
    group.data?.forEach((token) => {
      const fiat = group.map?.[token.$key];
      const multiplier = fiat?.balanceMultiplier ?? token.balanceMultiplier;
      if (isValidBalanceMultiplier(multiplier)) {
        token.balanceMultiplier = multiplier;
        if (fiat) {
          fiat.balanceMultiplier = multiplier;
        }
      }
    });
  });
  return resp;
}

export default {
  isValidBalanceMultiplier,
  applyBalanceMultiplier,
  removeBalanceMultiplier,
  normalizeTokenDetailItemsBalanceMultiplier,
  normalizeAccountTokensRespBalanceMultiplier,
};
