import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import type { EInviteCodeAttributionSource } from '@onekeyhq/shared/src/referralCode/installReferrerUtils';

// Once per cold start per runtime: iOS re-runs the capture from the analytics
// bootstrap and from every App Clip universal link, and each run would
// otherwise fetch the rebate config again.
let hasWarmedPostConfig = false;

export type IInstallInviteCodeReadResult = {
  code: string | undefined;
  /** ms epoch the auto-fill TTL is measured from. */
  attributedAt: number;
  /**
   * Whether the store answered with a non-empty payload. `false` may be a
   * transient miss, so the capture stays pending until the store's serving
   * window closes.
   */
  hasReferrer: boolean;
  /**
   * Nothing to attribute for this installation: on Android it predates this
   * capture (reached this version through an update); on iOS no App Clip
   * handed anything off. Settles the capture without a code and without
   * counting it as a capture.
   */
  isExistingInstall?: boolean;
};

/**
 * Stores the invite code a store/App Clip install carried so the onboarding
 * bind dialog can pre-fill it later.
 *
 * FIRST-LAUNCH CONTRACT — product rule, keep it intact when editing any piece
 * of this capture:
 *
 * 1. Only a fresh install is attributed, and the capture belongs to the first
 *    launch after that install. A user who reaches this version through an app
 *    update must never get a code, even if they originally installed from an
 *    invite link. Android enforces this in
 *    `readGooglePlayInviteCodeAttribution` (first-install time vs last-update
 *    time); iOS relies on only the App Clip ever writing the handoff file,
 *    before the full app exists (see `AppClipInviteCodeStore`). A new
 *    platform or source must bring its own fresh-install check.
 * 2. It starts at app start (`prefetchInstallInviteCode` in
 *    `LastActivityTracker`), not when a dialog opens and not behind the
 *    analytics bootstrap, so the code is stored before onboarding asks.
 * 3. After the first definitive answer the persisted resolved flag
 *    short-circuits every later launch before `read` is called, so later
 *    launches cost one local read. The only retry is a fresh Android install
 *    whose Play referrer came back empty (or whose Play call failed) inside
 *    Play's serving window; it is remembered as fresh before Play is asked
 *    (`markFreshInstall` / `isKnownFreshInstall`) so an app update before the
 *    retry cannot turn it into an "existing install".
 * 4. While an unbound code is stored, the first capture of each cold start
 *    also refreshes the rebate config in the background
 *    (`prefetchInstallReferralPostConfig`), not awaited, so the code itself is
 *    never held back by the network.
 * 5. Dialogs never block on this. They join this launch's capture attempt for
 *    a bounded time (`readInstallReferralAutoFillCode`) and read once more
 *    when it settles; they never poll the persisted flag.
 *
 * `read` resolving `undefined` means the platform cannot answer yet (e.g. an
 * older native build without the reader), which leaves the capture pending.
 */
export async function captureInstallInviteCode({
  source,
  read,
}: {
  source: EInviteCodeAttributionSource;
  read: (params: {
    /** An earlier launch judged this install fresh and left it pending. */
    isKnownFreshInstall: boolean;
    /**
     * Persists "this install is fresh" for later launches. Call it as soon as
     * the fresh-install check passes and before the store is asked, so a store
     * read that fails still leaves the judgement behind for the retry.
     */
    markFreshInstall: () => Promise<void>;
  }) => Promise<IInstallInviteCodeReadResult | undefined>;
}): Promise<void> {
  try {
    await captureOnce({ source, read });
  } finally {
    if (!hasWarmedPostConfig) {
      hasWarmedPostConfig = true;
      void backgroundApiProxy.serviceReferralCode
        .prefetchInstallReferralPostConfig()
        .catch(() => undefined);
    }
  }
}

async function captureOnce({
  source,
  read,
}: Parameters<typeof captureInstallInviteCode>[0]): Promise<void> {
  try {
    const { isResolved: isAlreadyResolved, isPendingFreshInstall } =
      await backgroundApiProxy.serviceReferralCode.getInstallReferralCaptureState();
    if (isAlreadyResolved) {
      return;
    }
    const result = await read({
      isKnownFreshInstall: isPendingFreshInstall,
      markFreshInstall: () =>
        backgroundApiProxy.serviceReferralCode.markInstallReferralPendingFreshInstall(),
    });
    if (!result) {
      return;
    }
    if (result.isExistingInstall) {
      await backgroundApiProxy.serviceReferralCode.markInstallReferralCaptureResolved();
      return;
    }
    const { isResolved, hasCode } =
      await backgroundApiProxy.serviceReferralCode.resolveInstallReferral({
        code: result.code,
        attributedAt: result.attributedAt,
        hasReferrer: result.hasReferrer,
        source,
      });
    // A pending capture is retried on every cold start until it settles;
    // reporting each attempt would count one install many times over. An
    // empty referrer that only settles because Play's window closed had
    // nothing to capture, so it is not counted either.
    if (isResolved && (hasCode || result.hasReferrer)) {
      defaultLogger.referral.page.installReferralCaptured({
        source,
        hasCode,
      });
    }
  } catch (error) {
    // Losing attribution costs a pre-filled field, nothing more. Never let it
    // surface to the user or block the analytics report next to it.
    console.warn(
      '[InstallAttribution] Invite code capture failed',
      error instanceof Error ? error.message : 'unknown_error',
    );
  }
}
