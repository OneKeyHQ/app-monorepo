export enum EMarketHomeEntrySource {
  TabBar = 'tabBar',
  Discovery = 'discovery',
  WalletHome = 'walletHome',
  // Desktop keyboard shortcut for the Market tab.
  Shortcut = 'shortcut',
  // Desktop tray menu "Market" item.
  Tray = 'tray',
  // Deep link or widget link that opens the Market home itself.
  Deeplink = 'deeplink',
  // Web only: the first view of a page load that had no marker (Market is the
  // landing tab, direct URL, reload, redirects into Market).
  Landing = 'landing',
  // The first view happened because the user came back from a Market detail
  // opened before the home was ever shown.
  DetailBack = 'detailBack',
  // Explicitly unattributed callers, and the first view of a session that had
  // no marker (app start on Market).
  Other = 'other',
}

// A marker older than this belongs to a navigation that never landed.
export const MARKET_HOME_ENTRY_TTL_MS = 10_000;

// Only bridges a detail removal and the focus gain of the screen below it.
export const MARKET_DETAIL_LEFT_TTL_MS = 3000;

let pendingEntry: { source: EMarketHomeEntrySource; at: number } | undefined;
let marketDetailLeftAt: number | undefined;
// Per UI runtime, not per component: tablet split layouts remount the Market
// home on rotation, and a remount without a marker is not a new entry.
let hasViewedMarketHome = false;

export function hasViewedMarketHomeInSession() {
  return hasViewedMarketHome;
}

export function markMarketHomeViewed() {
  hasViewedMarketHome = true;
}

// Clears the pending marker, the detail flag and the viewed flag, for tests.
export function resetMarketHomeEntryState() {
  pendingEntry = undefined;
  marketDetailLeftAt = undefined;
  hasViewedMarketHome = false;
}

/**
 * Called when a Market detail route is about to be removed from its stack,
 * so the screen revealed below it can tell a back from a fresh entry.
 * UI runtime only, like the entry marker.
 */
export function markMarketDetailLeft(now: number = Date.now()) {
  marketDetailLeftAt = now;
}

export function takeMarketDetailLeft(now: number = Date.now()): boolean {
  const leftAt = marketDetailLeftAt;
  marketDetailLeftAt = undefined;
  return leftAt !== undefined && now - leftAt <= MARKET_DETAIL_LEFT_TTL_MS;
}

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
  isBackFromDetail = false,
  isLandingPlatform = false,
}: {
  entrySource: EMarketHomeEntrySource | undefined;
  hasViewed: boolean;
  isBackFromDetail?: boolean;
  // Web: a first view without a marker is the page load landing on Market.
  isLandingPlatform?: boolean;
}): EMarketHomeEntrySource | undefined {
  if (entrySource) {
    return entrySource;
  }
  if (hasViewed) {
    return undefined;
  }
  if (isBackFromDetail) {
    return EMarketHomeEntrySource.DetailBack;
  }
  return isLandingPlatform
    ? EMarketHomeEntrySource.Landing
    : EMarketHomeEntrySource.Other;
}
