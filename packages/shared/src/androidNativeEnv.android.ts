export const ANDROID_CHANNEL = process.env.ANDROID_CHANNEL || 'direct';

export type IResolvedAndroidChannel = 'googlePlay' | 'apk';

let cached: IResolvedAndroidChannel | undefined;
let inflight: Promise<IResolvedAndroidChannel> | undefined;

interface IInstallReferrerApi {
  getInstallReferrerAsync?: () => Promise<string | null | undefined>;
}

interface ILoggerApi {
  defaultLogger?: {
    app?: {
      appUpdate?: {
        log?: (message: string) => void;
      };
    };
  };
}

// Play Store install is probed via expo-application.getInstallReferrerAsync.
// When the device can talk to the Play Install Referrer API we treat the app
// as installed via Google Play. A native `getInstallerPackageName()` signal
// would be stronger but is not exposed to JS in the current dependency graph;
// when a native bridge is added in a future release we can extend the
// resolver to prefer it.
async function probeInstallReferrer(): Promise<{
  ok: boolean;
  detail: string;
}> {
  try {
    // Lazy require to avoid importing expo-application before the RN bridge
    // is ready and to keep this module safe to evaluate in any context.
    // eslint-disable-next-line @typescript-eslint/no-var-requires, global-require
    const Application = require('expo-application') as IInstallReferrerApi;
    if (typeof Application?.getInstallReferrerAsync !== 'function') {
      return { ok: false, detail: 'api-missing' };
    }
    const referrer = await Application.getInstallReferrerAsync();
    return {
      ok: true,
      detail: referrer ? `ok(len=${referrer.length})` : 'ok(empty)',
    };
  } catch (error) {
    const message = (error as Error)?.message ?? String(error);
    return { ok: false, detail: `fail(${message})` };
  }
}

function writeLog(message: string): void {
  // Lazy require to avoid a circular import:
  //   androidNativeEnv -> logger -> platformEnv -> androidNativeEnv.
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires, global-require
    const mod = require('./logger/logger') as ILoggerApi;
    mod.defaultLogger?.app?.appUpdate?.log?.(message);
  } catch {
    // Logger not available yet; drop the message silently.
  }
}

export async function resolveAndroidChannel(): Promise<IResolvedAndroidChannel> {
  if (cached) return cached;
  if (inflight) return inflight;
  inflight = (async () => {
    const inlineChannel = ANDROID_CHANNEL;
    // Builtin bundle carries the APK flavor via Metro-inlined env var. When
    // inline says 'google' we trust it and skip the probe. This is the 100%
    // common case today (OTA bundles for mobile are still served from a
    // single pipeline that inlines `google`).
    if (inlineChannel === 'google') {
      cached = 'googlePlay';
      writeLog(
        `resolveAndroidChannel: inline=google resolved=googlePlay source=inline`,
      );
      return cached;
    }
    // OTA bundle built without `ANDROID_CHANNEL=google` can land on a Google
    // Play APK and inline 'direct'. Probe Play Install Referrer to correct
    // the mismatch at runtime. This also acts as a diagnostic log for any
    // future user who reports APK-download behaviour while running a Play
    // Store build.
    const probe = await probeInstallReferrer();
    const resolved: IResolvedAndroidChannel = probe.ok ? 'googlePlay' : 'apk';
    cached = resolved;
    writeLog(
      `resolveAndroidChannel: inline=${inlineChannel} installerProbe=${probe.detail} resolved=${resolved} source=installReferrer`,
    );
    return resolved;
  })();
  return inflight;
}

export function getAndroidChannelSync(): IResolvedAndroidChannel | undefined {
  return cached;
}
