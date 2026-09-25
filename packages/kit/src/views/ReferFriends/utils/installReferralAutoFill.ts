import { NativeModules } from 'react-native';

import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';

const CAPTURE_POLL_INTERVAL_MS = 300;

/**
 * Whether this runtime runs a startup capture whose "not read yet" can still
 * turn into a code: the Android Google Play build (Play referrer) and iOS
 * builds whose native module can read the App Clip handoff. Everywhere else
 * the first answer is final.
 *
 * Decided on the UI runtime deliberately — the same one
 * `installAttribution.*.ts` uses to decide whether to capture at all.
 * `platformEnv` is evaluated again in `bg`, where the native channel probe
 * can fall back and disagree.
 */
function hasPendingInstallReferralCapture(): boolean {
  if (platformEnv.isNativeAndroidGooglePlay) {
    return true;
  }
  return (
    Boolean(platformEnv.isNativeIOS) &&
    typeof NativeModules.AppClipAttribution?.readInviteCode === 'function'
  );
}

/**
 * The install-referrer invite code eligible for auto-fill, waiting out a
 * startup capture that is still in flight.
 *
 * The capture runs as an independent startup task, so a dialog opened during
 * a fresh install's first seconds can ask before the code has landed.
 * `isCaptureResolved` distinguishes "no code for this install" from "not read
 * yet"; only the latter is worth waiting on — bounded by `timeoutMs`, and only
 * while `isActive()` holds (e.g. the dialog is still mounted).
 */
export async function readInstallReferralAutoFillCode({
  timeoutMs,
  isActive,
}: {
  timeoutMs: number;
  isActive: () => boolean;
}): Promise<string | undefined> {
  let state =
    await backgroundApiProxy.serviceReferralCode.getInstallReferralAutoFill();
  if (!hasPendingInstallReferralCapture()) {
    return state.code;
  }
  const deadline = Date.now() + timeoutMs;
  while (
    !state.code &&
    !state.isCaptureResolved &&
    isActive() &&
    Date.now() < deadline
  ) {
    await timerUtils.wait(CAPTURE_POLL_INTERVAL_MS);
    state =
      await backgroundApiProxy.serviceReferralCode.getInstallReferralAutoFill();
  }
  return state.code;
}
