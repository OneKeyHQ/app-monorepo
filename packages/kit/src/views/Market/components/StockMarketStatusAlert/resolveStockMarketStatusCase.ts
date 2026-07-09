import type { IMarketStockInfo } from '@onekeyhq/shared/types/marketV2';

/**
 * Whether a stock's market is explicitly closed. `isOpen === false` means closed;
 * `undefined` means status unknown/unavailable (NOT closed). Shared so every
 * surface uses the same `=== false` rule instead of re-inlining it.
 */
export function isStockMarketClosed(stock?: IMarketStockInfo): boolean {
  return stock?.isOpen === false;
}

/**
 * Standard classifier for a tokenized stock's market-status alert.
 *
 * A stock token can be in several non-tradable states, and the prompt we show
 * depends on TWO independent signals:
 *   - whether we know the next market-open time, and
 *   - whether the same underlying has a Perps (contract) equivalent the user can
 *     trade right now (i.e. `perpsInfo.hlTicker` exists on the token detail).
 *
 * This pure helper maps those signals to one of the standard cases below so the
 * presentation (see `StockMarketStatusAlert`) stays consistent and reusable
 * across modules (Swap stock panel, Market detail, etc.). Keep the logic here —
 * do not re-derive cases ad hoc at each call site.
 *
 * NOTE: case 5 (Halted/Suspended) is intentionally NOT produced yet — the
 * backend does not return a halted signal today. The enum value is reserved and
 * commented so adding it later is a localized change.
 */
export enum EStockMarketStatusCase {
  /** Market is open (or status unknown/unavailable) — no closed-status alert. */
  Open = 'open',
  /** 1. Closed, next-open time known, has a Perps equivalent → show time + guide to Perps. */
  ClosedKnownTimeWithPerps = 'closedKnownTimeWithPerps',
  /** 2. Closed, next-open time known, no Perps → tell the user when it reopens. */
  ClosedKnownTimeNoPerps = 'closedKnownTimeNoPerps',
  /** 3. Closed, next-open time unknown, no Perps → ask the user to wait. */
  ClosedUnknownTimeNoPerps = 'closedUnknownTimeNoPerps',
  /** 4. Closed, next-open time unknown, has a Perps equivalent → wait, but can trade Perps. */
  ClosedUnknownTimeWithPerps = 'closedUnknownTimeWithPerps',
  // 5. Halted = 'halted' — reserved. Backend halted/suspended signal pending.
}

export function resolveStockMarketStatusCase({
  isOpen,
  hasOpenTime,
  hasPerps,
}: {
  /**
   * `tokenDetail.stock.isOpen`. `true` = open; `false` = closed; `undefined` =
   * unavailable. Only an explicit `false` yields a closed-status case here —
   * "unavailable" is a separate concern the caller handles before calling this.
   */
  isOpen?: boolean;
  /** Do we know the next market-open time? (e.g. backend gave a countdown.) */
  hasOpenTime: boolean;
  /** Does the same underlying have a Perps equivalent (`perpsInfo.hlTicker`)? */
  hasPerps: boolean;
}): EStockMarketStatusCase {
  if (isOpen !== false) {
    return EStockMarketStatusCase.Open;
  }
  if (hasOpenTime) {
    return hasPerps
      ? EStockMarketStatusCase.ClosedKnownTimeWithPerps
      : EStockMarketStatusCase.ClosedKnownTimeNoPerps;
  }
  return hasPerps
    ? EStockMarketStatusCase.ClosedUnknownTimeWithPerps
    : EStockMarketStatusCase.ClosedUnknownTimeNoPerps;
}
