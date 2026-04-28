import appGlobals from '../appGlobals';
import platformEnv from '../platformEnv';
import uriUtils from '../utils/uriUtils';

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
  try {
    const state = await requestHelper.getDevSettingsPersistAtom();
    return Boolean(state.enabled && state.settings?.disableCustomUA);
  } catch {
    return false;
  }
}

export async function buildCustomUA(): Promise<string | null> {
  // UA is product-token only; runtime is conveyed via X-Onekey-Request-Platform.
  const runtime = detectRuntime();
  if (!runtime) return null;
  if (await isDisabledByDevSetting()) return null;
  const version = platformEnv.version ?? 'unknown';
  return `OneKeyWallet/${version}`;
}

export async function shouldInjectUAForUrl(url: string): Promise<boolean> {
  if (!url || typeof url !== 'string') return false;
  const parsed = uriUtils.safeParseURL(url);
  if (!parsed) return false;
  // CLI has no wired DI — fall back to official-domain regex only.
  try {
    return await requestHelper.checkIsOneKeyDomain(url);
  } catch {
    return ONEKEY_OFFICIAL_HOST.test(parsed.host);
  }
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
