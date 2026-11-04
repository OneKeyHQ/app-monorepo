import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { EInviteCodeAttributionSource } from '@onekeyhq/shared/src/referralCode/installReferrerUtils';

import { captureInstallInviteCode } from './installInviteCodeCapture';

type IGooglePlayAttributionModule =
  typeof import('@onekeyhq/shared/src/modules/InstallAttribution/googlePlay');

let startupContext:
  | Promise<{
      googlePlay: IGooglePlayAttributionModule;
      source: ReturnType<
        IGooglePlayAttributionModule['createInstallAttributionSource']
      >;
    }>
  | undefined;
let inviteCodeCaptureTask: Promise<void> | undefined;

function isGooglePlayMainRuntime(): boolean {
  return Boolean(
    platformEnv.isNativeAndroidGooglePlay && platformEnv.isNativeMainThread,
  );
}

/**
 * One referrer source per cold start, shared by the invite-code prefetch and
 * the analytics report, so the Play Store service is bound at most once
 * however the two are scheduled.
 */
function getStartupContext() {
  startupContext ??=
    import('@onekeyhq/shared/src/modules/InstallAttribution/googlePlay').then(
      (googlePlay) => ({
        googlePlay,
        source: googlePlay.createInstallAttributionSource(),
      }),
    );
  return startupContext;
}

/**
 * Starts the invite-code capture as early as the app can, ahead of the
 * analytics bootstrap, so a fresh install's code is already stored by the
 * time onboarding asks for it. Once per cold start; after a launch has
 * resolved the capture, later ones stop at the persisted flag.
 */
export function prefetchInstallInviteCode(): Promise<void> {
  if (!isGooglePlayMainRuntime()) {
    return Promise.resolve();
  }
  inviteCodeCaptureTask ??= captureInstallInviteCode({
    source: EInviteCodeAttributionSource.androidInstallReferrer,
    read: async ({ isKnownFreshInstall, markFreshInstall }) => {
      const { googlePlay, source } = await getStartupContext();
      const { code, installedAt, hasReferrer, isExistingInstall } =
        await googlePlay.readGooglePlayInviteCodeAttribution(source, {
          isKnownFreshInstall,
          onFreshInstall: markFreshInstall,
        });
      return {
        code,
        attributedAt: installedAt,
        hasReferrer,
        isExistingInstall,
      };
    },
  });
  return inviteCodeCaptureTask;
}

export async function reportInstallAttribution(): Promise<void> {
  if (!isGooglePlayMainRuntime()) {
    return;
  }

  const { googlePlay, source } = await getStartupContext();

  // Two independent one-shots over the same referrer: the analytics report is
  // gated on a 7-day install window and fires once, while the invite code has
  // to survive until it is bound or expires. Neither may block the other, so
  // they settle side by side; the capture is usually already in flight from
  // the startup prefetch and is joined rather than started again.
  const [attributionResult] = await Promise.allSettled([
    googlePlay.reportGooglePlayInstallAttribution(source),
    prefetchInstallInviteCode(),
  ]);

  if (attributionResult.status === 'rejected') {
    // Preserves the original contract: the caller logs this failure.
    throw attributionResult.reason;
  }
}
