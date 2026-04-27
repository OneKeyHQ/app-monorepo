/* eslint-disable @typescript-eslint/no-restricted-imports */
import { devSettingsPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms/devSettings';
import { checkIsOneKeyDomain } from './checkIsOneKeyDomain';

import platformEnv from '../platformEnv';

export type ECustomUARuntime =
  | 'desktop-electron'
  | 'cli-node'
  | 'ios-native'
  | 'android-native';

let runtimeOverride: ECustomUARuntime | null = null;

export function setCustomUARuntime(runtime: ECustomUARuntime): void {
  runtimeOverride = runtime;
}

export function __setCustomUARuntimeForTest(
  runtime: ECustomUARuntime | null,
): void {
  runtimeOverride = runtime;
}

export function __resetCustomUARuntimeForTest(): void {
  runtimeOverride = null;
}

function detectRuntime(): ECustomUARuntime | null {
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
    const state = await devSettingsPersistAtom.get();
    return Boolean(state.enabled && state.settings?.disableCustomUA);
  } catch {
    return false;
  }
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
  return checkIsOneKeyDomain(url);
}

export async function buildCustomUA(): Promise<string | null> {
  const runtime = detectRuntime();
  if (!runtime) return null;
  if (await isDisabledByDevSetting()) return null;
  const version = platformEnv.version ?? 'unknown';
  return `OneKeyWallet/${version} (${runtime})`;
}

const USER_AGENT_HEADER = 'User-Agent';

function hasUserAgent(headers: Record<string, string>): boolean {
  return Object.keys(headers).some(
    (k) => k.toLowerCase() === USER_AGENT_HEADER.toLowerCase(),
  );
}

export async function withCustomUAHeaders(
  url: string,
  headers: Record<string, string> = {},
): Promise<Record<string, string>> {
  const next = { ...headers };
  if (!(await shouldInjectUAForUrl(url))) return next;
  if (hasUserAgent(next)) return next;
  const ua = await buildCustomUA();
  if (ua) next[USER_AGENT_HEADER] = ua;
  return next;
}
