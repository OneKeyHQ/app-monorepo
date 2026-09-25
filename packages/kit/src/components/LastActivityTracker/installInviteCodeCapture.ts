import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import type { EInviteCodeAttributionSource } from '@onekeyhq/shared/src/referralCode/installReferrerUtils';

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
   * An installation that predates this capture (reached this version through
   * an update). Only fresh installs are attributed, so this settles the
   * capture without a code and without counting it as a capture.
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
 *    whose Play referrer came back empty inside Play's serving window.
 * 4. Dialogs never block on this. They poll a bounded time for a capture still
 *    in flight (`readInstallReferralAutoFillCode`) and refresh when it lands.
 *
 * `read` resolving `undefined` means the platform cannot answer yet (e.g. an
 * older native build without the reader), which leaves the capture pending.
 */
export async function captureInstallInviteCode({
  source,
  read,
}: {
  source: EInviteCodeAttributionSource;
  read: () => Promise<IInstallInviteCodeReadResult | undefined>;
}): Promise<void> {
  try {
    const isAlreadyResolved =
      await backgroundApiProxy.serviceReferralCode.isInstallReferralCaptureResolved();
    if (isAlreadyResolved) {
      return;
    }
    const result = await read();
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
    // reporting each attempt would count one install many times over.
    if (isResolved) {
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
