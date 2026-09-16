import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

type IGooglePlayAttributionModule =
  typeof import('@onekeyhq/shared/src/modules/InstallAttribution/googlePlay');

/**
 * Stores the invite code carried by this install's Play referrer so the
 * onboarding bind dialog can pre-fill it later.
 *
 * Runs on every cold start until the capture resolves, because the Play
 * referrer is not guaranteed to be readable on the very first launch. Once
 * resolved — with or without a code — the flag short-circuits this before any
 * store round-trip happens.
 */
async function captureInviteCodeAttribution(
  googlePlay: IGooglePlayAttributionModule,
  source: ReturnType<
    IGooglePlayAttributionModule['createInstallAttributionSource']
  >,
): Promise<void> {
  try {
    const isAlreadyResolved =
      await backgroundApiProxy.serviceReferralCode.isInstallReferralCaptureResolved();
    if (isAlreadyResolved) {
      return;
    }
    const { code, installedAt, hasReferrer } =
      await googlePlay.readGooglePlayInviteCodeAttribution(source);
    const { isResolved, hasCode } =
      await backgroundApiProxy.serviceReferralCode.resolveInstallReferral({
        code,
        attributedAt: installedAt,
        hasReferrer,
      });
    // A pending capture is retried on every cold start until it settles;
    // reporting each attempt would count one install many times over.
    if (isResolved) {
      defaultLogger.referral.page.installReferralCaptured({
        source: 'androidInstallReferrer',
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

export async function reportInstallAttribution(): Promise<void> {
  if (
    !platformEnv.isNativeAndroidGooglePlay ||
    !platformEnv.isNativeMainThread
  ) {
    return;
  }

  const googlePlay =
    await import('@onekeyhq/shared/src/modules/InstallAttribution/googlePlay');

  // Two independent one-shots over the same referrer: the analytics report is
  // gated on a 7-day install window and fires once, while the invite code has
  // to survive until it is bound or expires. Neither may block the other, so
  // they settle side by side — but they share one source, so the Play Store
  // is bound at most once per cold start.
  const source = googlePlay.createInstallAttributionSource();
  const [attributionResult] = await Promise.allSettled([
    googlePlay.reportGooglePlayInstallAttribution(source),
    captureInviteCodeAttribution(googlePlay, source),
  ]);

  if (attributionResult.status === 'rejected') {
    // Preserves the original contract: the caller logs this failure.
    throw attributionResult.reason;
  }
}
