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

// True only when the multiplier would actually rescale amounts: parses to a
// finite positive number other than 1. `isValidBalanceMultiplier` answers
// "is this field usable?", while this answers "does this token really scale?"
// — apply/remove treat exactly 1 as a no-op, and Scaled UI Amount /
// TEP-0526 mints start at multiplier 1, so entry gates that disable
// scaled-UI-unaware flows (e.g. Swap) must use this predicate or they would
// silently block tokens whose math is identical to a plain token.
function isScalingBalanceMultiplier(
  balanceMultiplier: string | undefined,
): balanceMultiplier is string {
  const bn = parseBalanceMultiplier(balanceMultiplier);
  return bn !== undefined && !bn.eq(1);
}

// Picks the effective multiplier from a token-detail-shaped object
// ({ info } & ITokenFiat). First VALID of [item-level, info-level] — `??`
// would let an invalid item-level value ('0', '--') shadow a valid
// info-level one and silently yield the raw balance. Call sites holding a
// bare ITokenFiat (no `info` level to consult) read the field directly
// instead; validation happens inside apply/remove either way.
function pickBalanceMultiplier(
  detail:
    | { balanceMultiplier?: string; info?: { balanceMultiplier?: string } }
    | undefined,
): string | undefined {
  if (!detail) {
    return undefined;
  }
  return [detail.balanceMultiplier, detail.info?.balanceMultiplier].find(
    isValidBalanceMultiplier,
  );
}

// Decode-side multiplier resolution: prefer the send-page snapshot
// (transferPayload.tokenInfo) when it refers to the decoded token — it is
// the exact snapshot that rendered the amount the user confirmed, per the
// same-snapshot contract above. The snapshot wins WHOLESALE on an address
// match, even when its multiplier is undefined ("what the user saw" may
// legitimately have had no multiplier). Fall back to the freshly fetched
// token (getToken) for dApp/external txs that never populated the payload.
// The snapshot deliberately wins WITHOUT validity filtering (unlike
// pickBalanceMultiplier): apply/convert pass invalid values through
// unchanged, so an invalid snapshot value keeps decode and send in
// agreement, while falling back to a VALID fetched multiplier would
// manufacture a decode/send divergence.
// Case sensitivity is per-chain: EVM hex and TON addresses (raw `0:<hex>`
// vs friendly casing, see ton/Vault.ts) compare case-insensitively via the
// flag; only Solana base58 mints are case-sensitive and must NOT set it.
// Empty-string addresses (EVM native sentinel) are never a match key.
function pickDecodeBalanceMultiplier({
  snapshotToken,
  fetchedToken,
  tokenAddress,
  addressCaseInsensitive,
}: {
  snapshotToken: { address?: string; balanceMultiplier?: string } | undefined;
  fetchedToken: { balanceMultiplier?: string } | undefined;
  tokenAddress: string;
  addressCaseInsensitive?: boolean;
}): string | undefined {
  const snapshotAddress = snapshotToken?.address;
  if (snapshotAddress) {
    const matches = addressCaseInsensitive
      ? snapshotAddress.toLowerCase() === tokenAddress.toLowerCase()
      : snapshotAddress === tokenAddress;
    if (matches) {
      return snapshotToken?.balanceMultiplier;
    }
  }
  return fetchedToken?.balanceMultiplier;
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
  // Fast path: no multiplier (or the literal '1') is the overwhelming common
  // case — every non-rebase token hits this on every render. Skip
  // `parseBalanceMultiplier`'s BigNumber construction entirely for it. This
  // is purely an optimization: the slow path below still handles '1.0',
  // whitespace, and invalid strings identically via `parseBalanceMultiplier`.
  if (balanceMultiplier === undefined || balanceMultiplier === '1') {
    return amount;
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
  // Fast path: same rationale as `applyBalanceMultiplier` above — skip
  // `parseBalanceMultiplier`'s BigNumber construction for the common no-op
  // case. Passthrough must not touch `decimals` (see the invalid-decimals
  // passthrough test), and this early return runs before `decimals` is used.
  if (balanceMultiplier === undefined || balanceMultiplier === '1') {
    return amount;
  }
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

// display amount -> transfer payload: full-send detection + truncating
// division. Sending the full balance takes the raw balance directly (no
// division => no rounding failure); partial amounts divide via
// `removeBalanceMultiplier` so the raw amount never exceeds the balance.
// The >= display-balance check (rather than an isMaxSend flag) also covers
// a hand-typed full balance and the fiat-overflow branch, and cannot go
// stale if the user edits after tapping MAX.
//
// Threshold: the MAX button sets the untruncated display balance, but the
// keyboard percent-100 shortcut and the fiat<->token mode clamp truncate to
// `decimals` places first, so any input >= the display balance truncated to
// the token's input precision counts as a full send — the raw balance
// differs from a literal conversion of such an input by less than one
// display precision unit. When the display balance itself is below one
// input-precision unit that truncation collapses the threshold to 0, and a
// zero threshold would classify EVERY non-negative input — zero-valued
// strings like '0.0' as well as ordinary partial amounts — as a full send
// of the entire raw balance. Guard both ways: fall back to the untruncated
// display balance so partial inputs keep dividing, and require a positive
// input so zero can never be promoted to a full send.
//
// `dp(undefined)` would return the decimal-place count instead of
// truncating (and a negative / fractional argument throws), so only
// truncate when `decimals` is a usable non-negative integer; the division
// arm fails closed (`removeBalanceMultiplier` throws) on the same invalid
// decimals.
function convertDisplayAmountToRawAmount({
  displayAmount,
  balanceParsed,
  balanceMultiplier,
  decimals,
}: {
  displayAmount: string;
  balanceParsed: string;
  balanceMultiplier: string | undefined;
  decimals: number;
}): { rawAmount: string; isFullSend: boolean } {
  if (!isValidBalanceMultiplier(balanceMultiplier)) {
    return { rawAmount: displayAmount, isFullSend: false };
  }
  const displayBalanceBN = new BigNumber(
    applyBalanceMultiplier({ amount: balanceParsed, balanceMultiplier }),
  );
  const truncatedDisplayBalance =
    Number.isInteger(decimals) && decimals >= 0
      ? displayBalanceBN.dp(decimals, BigNumber.ROUND_DOWN)
      : displayBalanceBN;
  const fullSendThreshold = truncatedDisplayBalance.gt(0)
    ? truncatedDisplayBalance
    : displayBalanceBN;
  const displayAmountBN = new BigNumber(displayAmount);
  if (displayAmountBN.gt(0) && displayAmountBN.gte(fullSendThreshold)) {
    return { rawAmount: balanceParsed, isFullSend: true };
  }
  return {
    rawAmount: removeBalanceMultiplier({
      amount: displayAmount,
      balanceMultiplier,
      decimals,
    }),
    isFullSend: false,
  };
}

// Server payload placement is not guaranteed (item-level next to `balance`
// vs. inside `info`); accept either and mirror onto both levels so
// downstream code can read it from IToken (tx building, getToken /
// localTokens) or ITokenFiat (display leaves subscribing to the fiat map)
// alike. When both levels are present, the balance-adjacent level wins —
// but only if it is actually valid; an invalid/garbage value on the winning
// level must not shadow a valid one on the other level.
// `item.info` is typed non-optional (IFetchTokenDetailItem), but the payload
// is untrusted server JSON — read/write it defensively at runtime anyway.
function normalizeTokenDetailItemsBalanceMultiplier(
  items: IFetchTokenDetailItem[] | undefined,
): void {
  items?.forEach((item) => {
    if (!item) return;
    const multiplier = [
      item.balanceMultiplier,
      item.info?.balanceMultiplier,
    ].find(isValidBalanceMultiplier);
    if (multiplier !== undefined) {
      item.balanceMultiplier = multiplier;
      if (item.info) {
        item.info.balanceMultiplier = multiplier;
      }
    }
  });
}

// Same item-level vs. info-level ambiguity as above, but for the account
// token list response: each group (tokens / riskTokens / smallBalanceTokens
// / allTokens) carries a `data[]` array (IAccountToken, i.e. IToken) and a
// parallel `map` keyed by `$key` (ITokenFiat). Mirror the multiplier onto
// both so display (reads map) and tx building (reads data/IToken) agree.
// When both are present, the map (fiat, balance-adjacent) level wins — but
// only if it is actually valid, same rationale as above.
//
// Deliberately NOT normalized here: `resp.aggregateTokenMap` /
// `resp.aggregateTokenListMap`. Entries in these maps are still per-network
// member fiats (client-built per network round), so a scalar multiplier IS
// well-defined for any single entry — the ill-defined case is the FLATTENED
// aggregate row (one aggregate token spanning members whose per-network
// multipliers can differ), which has no single scalar multiplier of its own.
// Aggregation of that flattened row is handled on the already-multiplied
// DISPLAY basis client-side (Task 8), summing each member by its own
// multiplier first. The server-provided aggregate maps above are skipped
// here pending backend confirmation of their multiplier semantics — this is
// an intentional deferral, not an oversight.
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
      const multiplier = [
        fiat?.balanceMultiplier,
        token.balanceMultiplier,
      ].find(isValidBalanceMultiplier);
      if (multiplier !== undefined) {
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
  isScalingBalanceMultiplier,
  applyBalanceMultiplier,
  removeBalanceMultiplier,
  convertDisplayAmountToRawAmount,
  pickBalanceMultiplier,
  pickDecodeBalanceMultiplier,
  normalizeTokenDetailItemsBalanceMultiplier,
  normalizeAccountTokensRespBalanceMultiplier,
};
