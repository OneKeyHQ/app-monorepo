// `ANDROID_CHANNEL` is Metro-inlined at bundle build time. It is exported as
// a mutable binding on purpose: `resolveAndroidChannel()` is the single
// write point. The sync portion of the resolver runs during module
// evaluation (see the eager kick at the bottom of this file), so any
// correction lands before `platformEnv.ts` — which imports this module —
// captures the value into its `const` snapshots. Do not mutate
// `ANDROID_CHANNEL` from anywhere else.
// eslint-disable-next-line import/no-mutable-exports
export let ANDROID_CHANNEL = process.env.ANDROID_CHANNEL || 'direct';

export type IResolvedAndroidChannel = 'googlePlay' | 'apk';

let cached: IResolvedAndroidChannel | undefined;

// Write a one-liner to the native-logger so incident triage can inspect the
// resolver outcome offline. Lazy require avoids the circular import chain
// androidNativeEnv -> logger -> platformEnv -> androidNativeEnv.
function log(message: string): void {
  try {
    /* eslint-disable @typescript-eslint/no-var-requires, global-require, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-argument */
    require('./logger/logger').defaultLogger?.app?.appUpdate?.log?.(message);
    /* eslint-enable */
  } catch {
    // logger not ready yet — drop silently
  }
}

// Best-effort Install Referrer probe, used ONLY for diagnostic logging. It
// is NOT suitable for classification: `getInstallReferrerAsync` succeeds as
// long as the device can talk to Play Services, and the referrer string is
// also empty on direct-install devices that happen to have Play Services
// installed. Proper Play Store detection requires a native bridge that
// returns `PackageManager.getInstallerPackageName()` so we can whitelist
// the known installer packages (`com.android.vending`,
// `com.google.android.feedback`). Until that bridge lands, classification
// must rely on the Metro-inlined `ANDROID_CHANNEL`.
async function probeInstallReferrerForLogging(): Promise<string> {
  try {
    /* eslint-disable @typescript-eslint/no-var-requires, global-require, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-assignment */
    const Application = require('expo-application');
    if (typeof Application?.getInstallReferrerAsync !== 'function') {
      return 'api-missing';
    }
    const referrer = await Application.getInstallReferrerAsync();
    return typeof referrer === 'string'
      ? `ok(len=${referrer.length})`
      : 'ok(non-string)';
    /* eslint-enable */
  } catch (error) {
    return `fail(${(error as Error)?.message ?? 'unknown'})`;
  }
}

// Sync classification + write-back. Must stay synchronous so it can run
// during module evaluation, before any downstream consumer (platformEnv,
// header builder) reads `ANDROID_CHANNEL`. A future native-bridge upgrade
// that returns the real installer package name would extend this block to
// promote 'direct' -> 'google' based on the whitelist; the mutation step
// is already in place.
function classifyAndroidChannelSync(): IResolvedAndroidChannel {
  const resolved: IResolvedAndroidChannel =
    ANDROID_CHANNEL === 'google' ? 'googlePlay' : 'apk';
  // Single write-back point for ANDROID_CHANNEL. Currently a no-op
  // (cached === 'googlePlay' implies inline is already 'google'), kept so
  // future installer-based promotion only needs to extend classification.
  if (resolved === 'googlePlay' && ANDROID_CHANNEL !== 'google') {
    ANDROID_CHANNEL = 'google';
  }
  return resolved;
}

// Resolve the runtime Android channel.
//
// Classification is driven strictly by the Metro-inlined `ANDROID_CHANNEL`.
// Runtime signals currently available to JS (Install Referrer,
// applicationId) are not strong enough to promote a user into `googlePlay`,
// so we refuse to do that and keep a direct-install device safely on the
// in-app APK path.
export async function resolveAndroidChannel(): Promise<IResolvedAndroidChannel> {
  if (cached) return cached;
  cached = classifyAndroidChannelSync();
  const probe = await probeInstallReferrerForLogging();
  log(
    `resolveAndroidChannel: inline=${ANDROID_CHANNEL} installerProbe=${probe} resolved=${cached}`,
  );
  return cached;
}

// Eager kick at module load. The synchronous portion of
// `resolveAndroidChannel()` (classification + ANDROID_CHANNEL write-back)
// runs before the first `await` inside the function, which is BEFORE
// `platformEnv` — which imports this module — captures `ANDROID_CHANNEL`
// into its `const` snapshots. The async Install Referrer probe then
// continues off-thread and drives the diagnostic log.
void resolveAndroidChannel();
