import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { prefetchInstallInviteCode } from '@onekeyhq/kit/src/components/LastActivityTracker/installAttribution';

/**
 * The install-referrer invite code eligible for auto-fill, waiting out this
 * launch's startup capture if it is still in flight.
 *
 * A dialog opened during a fresh install's first seconds can ask before the
 * code has landed, so it joins this launch's capture attempt
 * (`prefetchInstallInviteCode`, shared and started at app start) and reads
 * once more after it settles. It deliberately does not poll the persisted
 * "resolved" flag: a capture can stay pending across launches (an empty Play
 * referrer is retried on the next cold start), and nothing in this launch
 * will change it once the attempt has settled. Bounded by `timeoutMs`; the
 * dialog stays usable throughout.
 */
export async function readInstallReferralAutoFillCode({
  timeoutMs,
  isActive,
}: {
  timeoutMs: number;
  isActive: () => boolean;
}): Promise<string | undefined> {
  const state =
    await backgroundApiProxy.serviceReferralCode.getInstallReferralAutoFill();
  if (state.code || state.isCaptureResolved) {
    return state.code;
  }
  let timer: ReturnType<typeof setTimeout> | undefined;
  const outcome = await Promise.race([
    prefetchInstallInviteCode().then(() => 'settled' as const),
    new Promise<'timeout'>((resolve) => {
      timer = setTimeout(() => resolve('timeout'), timeoutMs);
    }),
  ]);
  clearTimeout(timer);
  if (outcome === 'timeout' || !isActive()) {
    return undefined;
  }
  const settled =
    await backgroundApiProxy.serviceReferralCode.getInstallReferralAutoFill();
  return settled.code;
}
