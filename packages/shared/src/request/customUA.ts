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

function getDesktopPlatformLabel(): string {
  if (platformEnv.isDesktopMac) return 'macOS';
  if (platformEnv.isDesktopWin) return 'Windows';
  if (platformEnv.isDesktopLinux) return 'Linux';
  // The Electron main process has no desktopApi bridge, so platformEnv's
  // desktop OS flags are all false there; Node's process.platform still is set.
  const nodePlatform =
    typeof process !== 'undefined' ? process.platform : undefined;
  if (nodePlatform === 'darwin') return 'macOS';
  if (nodePlatform === 'win32') return 'Windows';
  if (nodePlatform === 'linux') return 'Linux';
  return 'Desktop';
}

export function getCustomUAPlatformLabel(runtime: ICustomUARuntime): string {
  if (runtime === 'ios-native') return 'iOS';
  if (runtime === 'android-native') return 'Android';
  if (runtime === 'cli-node') return 'CLI';
  return getDesktopPlatformLabel();
}

export async function buildCustomUA(): Promise<string | null> {
  // Human-readable `OneKey <platform> <version>` (e.g. `OneKey macOS 6.6.1`),
  // the same shape on every runtime so a log filter on the `OneKey ` prefix
  // covers them all. Finer platform detail stays in X-Onekey-Request-Platform.
  const runtime = detectRuntime();
  if (!runtime) return null;
  if (await isDisabledByDevSetting()) return null;
  // CLI's platformEnv.version is undefined at runtime (the bundle does not
  // substitute process.env.VERSION), so it naturally falls through to '1'.
  // App targets get the build-time substituted version.
  const version = platformEnv.version ?? '1';
  return `OneKey ${getCustomUAPlatformLabel(runtime)} ${version}`;
}

export async function shouldInjectUAForUrl(url: string): Promise<boolean> {
  if (!url || typeof url !== 'string') return false;
  const parsed = uriUtils.safeParseURL(url);
  if (!parsed) return false;
  try {
    return await requestHelper.checkIsOneKeyDomain(url);
  } catch {
    // CLI and the Electron main process never call updateInterceptorRequestHelper()
    // (renderer-only init), so checkIsOneKeyDomain() throws there. Fall back
    // to a narrow regex (both runtimes only talk to *.onekeycn.com /
    // *.onekeytest.com). On native / web / extension, DI is reliable — refuse
    // rather than mis-inject under an uncertain whitelist.
    const runtime = detectRuntime();
    if (runtime !== 'cli-node' && runtime !== 'desktop-electron') return false;
    return ONEKEY_OFFICIAL_HOST.test(parsed.hostname);
  }
}

function hasUserAgent(headers: Record<string, string>): boolean {
  return Object.keys(headers).some(
    (k) => k.toLowerCase() === USER_AGENT_HEADER.toLowerCase(),
  );
}

function logCallerConflict(url: string, existing: string): void {
  try {
    // Strip query/fragment — swap/auth URLs carry addresses, amounts, tokens.
    const parsed = uriUtils.safeParseURL(url);
    const safeUrl = parsed
      ? `${parsed.protocol}//${parsed.host}${parsed.pathname}`
      : '<invalid>';
    appGlobals.$defaultLogger?.app?.customUA?.callerConflict?.({
      url: safeUrl,
      existing,
    });
  } catch {
    // never let logging failures affect the request
  }
}

export async function withCustomUAHeaders(
  url: string,
  headers: Record<string, string> = {},
): Promise<Record<string, string>> {
  const next = { ...headers };
  if (!(await shouldInjectUAForUrl(url))) return next;
  if (hasUserAgent(next)) {
    const existing = next[USER_AGENT_HEADER] ?? next['user-agent'] ?? 'unknown';
    logCallerConflict(url, existing);
    return next;
  }
  const ua = await buildCustomUA();
  if (ua) next[USER_AGENT_HEADER] = ua;
  return next;
}
