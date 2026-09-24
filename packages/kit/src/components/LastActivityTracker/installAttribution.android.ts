import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { EInviteCodeAttributionSource } from '@onekeyhq/shared/src/referralCode/installReferrerUtils';

import { captureInstallInviteCode } from './installInviteCodeCapture';

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
    captureInstallInviteCode({
      source: EInviteCodeAttributionSource.androidInstallReferrer,
      read: async () => {
        const { code, installedAt, hasReferrer } =
          await googlePlay.readGooglePlayInviteCodeAttribution(source);
        return { code, attributedAt: installedAt, hasReferrer };
      },
    }),
  ]);

  if (attributionResult.status === 'rejected') {
    // Preserves the original contract: the caller logs this failure.
    throw attributionResult.reason;
  }
}
