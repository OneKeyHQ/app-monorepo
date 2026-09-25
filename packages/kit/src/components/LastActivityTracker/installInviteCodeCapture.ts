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
 * Runs on every cold start until the capture resolves; once resolved — with or
 * without a code — the flag short-circuits this before `read` is called.
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
