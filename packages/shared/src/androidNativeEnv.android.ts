export const ANDROID_CHANNEL = process.env.ANDROID_CHANNEL || 'direct';

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

// Resolve the runtime Android channel.
//
// `ANDROID_CHANNEL` is inlined by Metro at bundle-build time. The builtin
// bundle shipped inside a Google Play APK inlines `google`; OTA bundles
// built without that env var inline `direct` and, when they land on a
// Google Play APK, mis-report the channel to both the update guard and
// network headers.
//
// The runtime probe is `expo-application.getInstallReferrerAsync()`: it
// returns a referrer string only when the device can talk to the Play
// Install Referrer API, so success is a reasonable proxy for "installed
// via Google Play". A dedicated `getInstallerPackageName()` native bridge
// would be stronger but is out of scope for the hot-fix.
export async function resolveAndroidChannel(): Promise<IResolvedAndroidChannel> {
  if (cached) return cached;
  if (ANDROID_CHANNEL === 'google') {
    cached = 'googlePlay';
    log('resolveAndroidChannel: inline=google resolved=googlePlay');
    return cached;
  }
  let probe = 'api-missing';
  try {
    /* eslint-disable @typescript-eslint/no-var-requires, global-require, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-assignment */
    const Application = require('expo-application');
    if (typeof Application?.getInstallReferrerAsync === 'function') {
      const referrer = await Application.getInstallReferrerAsync();
      probe =
        typeof referrer === 'string' && referrer.length
          ? `ok(len=${referrer.length})`
          : 'ok(empty)';
      cached = 'googlePlay';
    }
    /* eslint-enable */
  } catch (error) {
    probe = `fail(${(error as Error)?.message ?? 'unknown'})`;
  }
  if (!cached) cached = 'apk';
  log(
    `resolveAndroidChannel: inline=${ANDROID_CHANNEL} installerProbe=${probe} resolved=${cached}`,
  );
  return cached;
}
