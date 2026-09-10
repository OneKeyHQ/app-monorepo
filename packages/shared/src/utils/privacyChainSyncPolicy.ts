import networkUtils from './networkUtils';

// EVERY gate and threshold for client-side chain scanning lives here.
//
// Call sites report what they observed; they do not decide what it means.
// That split is the whole point: a threshold written at the place it is used
// gets copied to the second place that needs it, and then the two drift. This
// module exists because that had already happened -- "far enough behind to
// mention" was the number 48 in one file and a named constant in another, and
// three surfaces polled the same state at two different intervals for no
// reason anyone could state.
//
// Pure functions, no scheduler, no wallet, no device: every rule below is
// testable on its own, which is what keeps changing one of them cheap.
//
// Chain-SPECIFIC gates do not belong here. A rule that only makes sense for
// one chain (Zcash's 2022 spam region, its block interval) lives with that
// chain's config; this module is the set of questions every client-scanning
// chain has to answer.

// What the call site OBSERVED, never what it concluded.
//
// `auto-backfill` is the scheduler noticing, at the end of a pass, that this
// chain still has real history to rebuild -- it is what makes the foreground
// pace a property of the WALLET rather than of whichever page happens to be
// open. `manual-sync` is a button press. The other two are the user arriving
// somewhere the wait matters, and only make a boost start sooner than the
// next pass would have; nothing depends on them for it to keep running.
export type IPrivacyChainBoostTrigger =
  | 'manual-sync'
  | 'auto-backfill'
  | 'chain-selected'
  | 'compose-send';

export function shouldStartBoost({
  trigger,
  networkId,
  remainingBlocks,
  pausedByUser,
  minRemainingBlocks,
}: {
  trigger: IPrivacyChainBoostTrigger;
  networkId: string | undefined;
  // Blocks left in the backfill, or null/undefined when no scan pass has
  // published a position yet. Only consulted for automatic triggers.
  remainingBlocks?: number | null;
  // The user pressed pause on the always-on light. Without this, pausing
  // would not survive a second: the surfaces that auto-trigger a boost watch
  // for "not boosting" and would immediately ask for it again, so the button
  // would appear broken. An explicit stop outranks every automatic trigger --
  // and only an explicit start (the Sync button) may clear it.
  pausedByUser?: boolean;
  // Supplied by the chain capability because block time and scan throughput
  // are properties of that runtime, not of this shared decision helper.
  minRemainingBlocks: number;
}): boolean {
  if (!networkId) {
    return false;
  }
  // The aggregate view shows this chain incidentally; landing there is not a
  // request to catch it up. Revisit here if that turns out to be wrong.
  if (networkUtils.isAllNetwork({ networkId })) {
    return false;
  }
  // An explicit press runs whatever the arrears are, and resumes from a pause:
  // a short catch-up is precisely when pressing Sync should feel like it did
  // something, and the button the user just pressed is the resume.
  if (trigger === 'manual-sync') {
    return true;
  }
  if (pausedByUser) {
    return false;
  }
  // Automatic triggers must clear the same bar the banner does, so a boost is
  // never running without the banner that explains it -- the user can only
  // stop what they can see, and an unexplained full-speed scan is the
  // battery/data complaint this whole policy exists to prevent.
  //
  // Unknown arrears never start one: the caller re-asks when the next pass
  // publishes a position, which is cheap and cannot guess wrong meanwhile.
  return (
    typeof remainingBlocks === 'number' && remainingBlocks >= minRemainingBlocks
  );
}

// There is deliberately no getBoostBannerState() here any more.
//
// It answered "should a surface show the boost, and in which state?" back when
// an in-page banner made that decision for itself. Both halves have moved:
// whether a boost is warranted at all is now decided once, by shouldStartBoost
// above, and the always-on light simply renders what the scheduler published
// (boosting / blocked-by-data). A second copy of the visibility rule could
// only ever drift from the first.

// ---------------------------------------------------------------------------
// Tip lag
// ---------------------------------------------------------------------------

// A wallet that is a few blocks behind the tip is a wallet that is keeping up
// -- that is simply what following a chain looks like. Saying "behind" there
// trains the user to ignore the word, so it has to be reserved for a lag they
// could actually act on. One hour of chain is the bar.
// A type guard, so a caller that formats the lag afterwards does not need a
// cast to convince the compiler the number is there.
export function isTipLagWorthMentioning(
  lagBlocks: number | null | undefined,
  warningThresholdBlocks: number,
): lagBlocks is number {
  return typeof lagBlocks === 'number' && lagBlocks > warningThresholdBlocks;
}

// ---------------------------------------------------------------------------
// Cadence
// ---------------------------------------------------------------------------

// How often a sync surface re-reads published scan state. One number for
// every surface: they show the same facts, so a surface polling faster than
// its neighbour only ever produced two different answers on one screen.
//
// This is a CEILING on staleness, not a fetch cost -- the scheduler publishes
// progress into a jotai atom at the end of each pass, and reads never enter
// the wallet's lane.
export const PRIVACY_CHAIN_SYNC_POLL_MS = 8000;

// How often the background scheduler asks each chain for its head.
//
// This buys a HEAD REQUEST, not a scan. A tick whose tip has not moved does
// no wallet work at all -- it never takes the wallet lease. So the only thing
// this rate decides is how soon an incoming payment is noticed while nobody
// is asking; when someone IS waiting, the foreground boost preempts this
// timer entirely and runs at its own pace.
//
// This cadence only wakes the scheduler. Runtime-specific pass duration and
// backfill pacing are supplied by each local-wallet capability.
export const PRIVACY_CHAIN_TIP_POLL_MS = 300_000;
