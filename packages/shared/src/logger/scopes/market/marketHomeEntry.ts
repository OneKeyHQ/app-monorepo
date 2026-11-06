export enum EMarketHomeEntrySource {
  TabBar = 'tabBar',
  Discovery = 'discovery',
  WalletHome = 'walletHome',
  // Explicitly unattributed callers, and the first view of a session that had
  // no marker (app start on Market, keyboard shortcut, deep link).
  Other = 'other',
}

// A marker older than this belongs to a navigation that never landed.
export const MARKET_HOME_ENTRY_TTL_MS = 10_000;

let pendingEntry: { source: EMarketHomeEntrySource; at: number } | undefined;

/**
 * Called by whoever is about to switch to the Market tab, so the Market home
 * can report how it was entered once it gains focus. UI runtime only: the
 * marker and its consumer live in the same JS runtime.
 */
export function markMarketHomeEntry(
  source: EMarketHomeEntrySource,
  now: number = Date.now(),
) {
  pendingEntry = { source, at: now };
}

export function takeMarketHomeEntry(
  now: number = Date.now(),
): EMarketHomeEntrySource | undefined {
  const entry = pendingEntry;
  pendingEntry = undefined;
  if (!entry || now - entry.at > MARKET_HOME_ENTRY_TTL_MS) {
    return undefined;
  }
  return entry.source;
}

/**
 * Decides whether a focus gain of the Market home is a new entry.
 * A focus gain without a fresh marker after the first view is a return from a
 * page or modal above the home, which is not a new entry.
 */
export function resolveMarketHomeView({
  entrySource,
  hasViewed,
}: {
  entrySource: EMarketHomeEntrySource | undefined;
  hasViewed: boolean;
}): EMarketHomeEntrySource | undefined {
  if (entrySource) {
    return entrySource;
  }
  return hasViewed ? undefined : EMarketHomeEntrySource.Other;
}
