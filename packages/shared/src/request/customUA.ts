import appGlobals from '../appGlobals';
import platformEnv from '../platformEnv';

import requestHelper from './requestHelper';

export type ICustomUARuntime =
  | 'desktop-electron'
  | 'cli-node'
  | 'ios-native'
  | 'android-native';

const ONEKEY_OFFICIAL_HOST = /\.onekey(cn|test)\.com$/i;
const USER_AGENT_HEADER = 'User-Agent';

let runtimeOverride: ICustomUARuntime | null = null;

export function setCustomUARuntime(runtime: ICustomUARuntime): void {
  runtimeOverride = runtime;
}

export function __setCustomUARuntimeForTest(
  runtime: ICustomUARuntime | null,
): void {
  runtimeOverride = runtime;
}

export function __resetCustomUARuntimeForTest(): void {
  runtimeOverride = null;
}

function detectRuntime(): ICustomUARuntime | null {
  if (runtimeOverride) return runtimeOverride;
  if (platformEnv.isDesktop) return 'desktop-electron';
  if (platformEnv.isNative) {
    if (platformEnv.appPlatform === 'ios') return 'ios-native';
    if (platformEnv.appPlatform === 'android') return 'android-native';
  }
  return null;
}

async function isDisabledByDevSetting(): Promise<boolean> {
  // requestHelper is shared-internal DI. When not wired (e.g. CLI runtime),
  // getDevSettingsPersistAtom throws — treat as "toggle off" (UA enabled).
  try {
    const state = await requestHelper.getDevSettingsPersistAtom();
    return Boolean(state.enabled && state.settings?.disableCustomUA);
  } catch {
    return false;
  }
}

async function isManagedHost(url: string): Promise<boolean> {
  // Prefer the upper-layer wired implementation (covers dev customApiEndpoints).
  // Fall back to the built-in OneKey official-domain regex when the DI is not
  // wired (CLI), or when the wired call rejects.
  try {
    return await requestHelper.checkIsOneKeyDomain(url);
  } catch {
    try {
      return ONEKEY_OFFICIAL_HOST.test(new URL(url).host);
    } catch {
      return false;
    }
  }
}

export async function buildCustomUA(): Promise<string | null> {
  const runtime = detectRuntime();
  if (!runtime) return null;
  if (await isDisabledByDevSetting()) return null;
  const version = platformEnv.version ?? 'unknown';
  return `OneKeyWallet/${version} (${runtime})`;
}

export async function shouldInjectUAForUrl(url: string): Promise<boolean> {
  if (!url || typeof url !== 'string') return false;
  try {
    // throws on invalid URL — guard with try/catch
    // eslint-disable-next-line no-new
    new URL(url);
  } catch {
    return false;
  }
  return isManagedHost(url);
}

function hasUserAgent(headers: Record<string, string>): boolean {
  return Object.keys(headers).some(
    (k) => k.toLowerCase() === USER_AGENT_HEADER.toLowerCase(),
  );
}

function logUADecision(record: {
  url: string;
  decision:
    | 'inject'
    | 'skip-non-whitelist'
    | 'skip-caller-already-set'
    | 'skip-runtime-or-disabled';
  injected: string | null;
  existing?: string;
}): void {
  try {
    appGlobals.$defaultLogger?.app?.customUA?.decision?.(record);
  } catch {
    // never let logging failures affect the request
  }
}

export async function withCustomUAHeaders(
  url: string,
  headers: Record<string, string> = {},
): Promise<Record<string, string>> {
  const next = { ...headers };
  if (!(await shouldInjectUAForUrl(url))) {
    logUADecision({ url, decision: 'skip-non-whitelist', injected: null });
    return next;
  }
  if (hasUserAgent(next)) {
    const existing = next[USER_AGENT_HEADER] ?? next['user-agent'] ?? 'unknown';
    logUADecision({
      url,
      decision: 'skip-caller-already-set',
      injected: null,
      existing,
    });
    return next;
  }
  const ua = await buildCustomUA();
  if (ua) {
    next[USER_AGENT_HEADER] = ua;
    logUADecision({ url, decision: 'inject', injected: ua });
  } else {
    logUADecision({
      url,
      decision: 'skip-runtime-or-disabled',
      injected: null,
    });
  }
  return next;
}
