// `ANDROID_CHANNEL` is Metro-inlined at bundle build time. It is exported as
// a mutable binding on purpose: `probeInstallReferrer()` (invoked from
// `resolveAndroidChannel()`) is the single write point for any runtime
// correction. The sync portion of `resolveAndroidChannel()` runs during
// module evaluation (see the eager kick at the bottom of this file), so
// any write-back lands before `platformEnv.ts` — which imports this
// module — captures the value into its `const` snapshots. Do not mutate
// `ANDROID_CHANNEL` from anywhere else.
// Kept as `let` on purpose — `probeInstallReferrer()` is the designated
// write point (today a no-op, wired up when a native bridge lands). Both
// `prefer-const` (no current writer) and `import/no-mutable-exports`
// (mutable named export) would flag this without the disables.
/* eslint-disable-next-line prefer-const, import/no-mutable-exports */
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

// Probe the Play Install Referrer API, update `cached` / `ANDROID_CHANNEL`
// if the probe proves we are on Google Play, and write a diagnostic line
// to the native-logger.
//
// Today the probe is informational only: `getInstallReferrerAsync()`
// succeeds as long as the device can talk to Play Services, which is a
// weaker signal than actually being installed via Play Store (it would
// misclassify sideloaded APKs on Play-Services-enabled devices). Until a
// native bridge lands that exposes `PackageManager.getInstallerPackageName()`
// and lets us whitelist the two canonical installer packages
// (`com.android.vending`, `com.google.android.feedback`), we deliberately
// do NOT promote `cached` or mutate `ANDROID_CHANNEL` from the probe. The
// promotion hook stays commented as a placeholder so the bridge PR can
// plug in with a minimal diff.
async function probeInstallReferrer(): Promise<void> {
  let probe = 'api-missing';
  try {
    /* eslint-disable @typescript-eslint/no-var-requires, global-require, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-assignment */
    const Application = require('expo-application');
    if (typeof Application?.getInstallReferrerAsync === 'function') {
      const referrer = await Application.getInstallReferrerAsync();
      probe =
        typeof referrer === 'string'
          ? `ok(len=${referrer.length})`
          : 'ok(non-string)';
      // FUTURE (native-bridge PR): read getInstallerPackageName() here,
      // match against the Play Store whitelist, and on match do:
      //   cached = 'googlePlay';
      //   if (ANDROID_CHANNEL !== 'google') ANDROID_CHANNEL = 'google';
    }
    /* eslint-enable */
  } catch (error) {
    probe = `fail(${(error as Error)?.message ?? 'unknown'})`;
  }
  log(
    `resolveAndroidChannel: inline=${ANDROID_CHANNEL} installerProbe=${probe} resolved=${cached ?? 'unresolved'}`,
  );
}

// Resolve the runtime Android channel.
//
// Classification is driven strictly by the Metro-inlined `ANDROID_CHANNEL`
// on the sync path; runtime signals currently available to JS are not
// strong enough to promote a user into `googlePlay`. The async
// `probeInstallReferrer()` call only writes a diagnostic line today, but
// it is the designated extension point for a future native bridge that
// updates `cached` and `ANDROID_CHANNEL`.
export async function resolveAndroidChannel(): Promise<IResolvedAndroidChannel> {
  if (cached) return cached;
  // Sync step, must complete before the first `await` so the module-level
  // kick below settles `cached` during module evaluation. After this line,
  // platformEnv (and any other downstream consumer) reads the correct
  // inline-based value; probeInstallReferrer can still upgrade it later.
  cached = ANDROID_CHANNEL === 'google' ? 'googlePlay' : 'apk';
  await probeInstallReferrer();
  return cached;
}

// Eager kick at module load. The synchronous portion of
// `resolveAndroidChannel()` (inline classification) runs before the first
// `await` inside the function, which is BEFORE `platformEnv` — which
// imports this module — captures `ANDROID_CHANNEL` into its `const`
// snapshots. The probe continues off-thread and drives the diagnostic log.
void resolveAndroidChannel();
