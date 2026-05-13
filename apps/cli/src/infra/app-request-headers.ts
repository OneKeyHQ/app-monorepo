import { randomUUID } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const DEFAULT_APP_VERSION = '6.3.0';
const DEFAULT_BUILD_NUMBER = '1';
// '0' matches the "BUNDLE_VERSION not injected" sentinel used by the
// iOS Info.plist, Android Gradle defEnvStr, Desktop esbuild define, and
// the JS-side platformEnv fallback. The previous '1' collided with the
// historical iOS Info.plist value and the legacy `?? '1'` fallback,
// polluting whichever Mixpanel bucket '1' ultimately maps to.
const DEFAULT_BUNDLE_VERSION = '0';
const DEFAULT_PLATFORM = 'desktop-macosStore';
const DEFAULT_DEVICE_NAME = 'OneKey Desktop';
const DEFAULT_LOCALE = 'zh-cn';
const DEFAULT_THEME = 'light';
const DEFAULT_CURRENCY = 'usd';
const DEFAULT_WALLET_TYPE = 'hd';

let cachedEnvVersionFile: Record<string, string> | null = null;
let cachedInstanceId: string | null = null;

function parseEnvFile(content: string): Record<string, string> {
  const result: Record<string, string> = {};
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) {
      // skip blanks and comments
    } else {
      const eqIndex = line.indexOf('=');
      if (eqIndex > 0) {
        const key = line.slice(0, eqIndex).trim();
        const value = line.slice(eqIndex + 1).trim();
        if (key) result[key] = value;
      }
    }
  }
  return result;
}

function findEnvVersionFile(startDir: string): string | null {
  let current = startDir;
  for (;;) {
    const candidate = path.join(current, '.env.version');
    if (fs.existsSync(candidate)) return candidate;
    const parent = path.dirname(current);
    if (parent === current) return null;
    current = parent;
  }
}

function readEnvVersionFile(): Record<string, string> {
  if (cachedEnvVersionFile) return cachedEnvVersionFile;

  const searchDirs = [process.cwd(), __dirname];
  for (const dir of searchDirs) {
    const file = findEnvVersionFile(dir);
    if (file) {
      try {
        cachedEnvVersionFile = parseEnvFile(fs.readFileSync(file, 'utf8'));
        return cachedEnvVersionFile;
      } catch {
        // Fall through to defaults. Request headers must not break CLI commands.
      }
    }
  }

  cachedEnvVersionFile = {};
  return cachedEnvVersionFile;
}

function readVersionValue(
  appEnvKey: string,
  rawEnvKey: string,
  fallback: string,
): string {
  return (
    process.env[appEnvKey] ??
    process.env[rawEnvKey] ??
    readEnvVersionFile()[rawEnvKey] ??
    fallback
  );
}

export function getCliAppRequestVersion(): string {
  return readVersionValue('ONEKEY_APP_VERSION', 'VERSION', DEFAULT_APP_VERSION);
}

function getCliAppBuildNumber(): string {
  return readVersionValue(
    'ONEKEY_APP_BUILD_NUMBER',
    'BUILD_NUMBER',
    DEFAULT_BUILD_NUMBER,
  );
}

function getCliAppBundleVersion(): string {
  return readVersionValue(
    'ONEKEY_APP_BUNDLE_VERSION',
    'BUNDLE_VERSION',
    DEFAULT_BUNDLE_VERSION,
  );
}

function getInstanceId(): string {
  cachedInstanceId ??= process.env.ONEKEY_INSTANCE_ID ?? randomUUID();
  return cachedInstanceId;
}

function getPlatformName(): string {
  // NEVER fall back to os.hostname() — on macOS it commonly contains the user's
  // real name (e.g. "Leons-MacBook-Pro.local"), which would leak as PII to the
  // OneKey backend in `x-onekey-request-platform-name`. Require explicit opt-in.
  return (
    process.env.ONEKEY_REQUEST_PLATFORM_NAME ??
    process.env.ONEKEY_CLI_REQUEST_PLATFORM_NAME ??
    'OneKey CLI'
  );
}

export function buildCliAppUserAgent(): string {
  const version = getCliAppRequestVersion();
  return (
    `Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) ` +
    `AppleWebKit/537.36 (KHTML, like Gecko) OneKeyWallet/${version} ` +
    `Chrome/142.0.7444.265 Electron/39.8.9 Safari/537.36`
  );
}

export function buildCliAppRequestHeaders(
  extraHeaders?: Record<string, string>,
): Record<string, string> {
  const requestId = randomUUID();
  return {
    'user-agent': buildCliAppUserAgent(),
    'x-amzn-trace-id': requestId,
    'x-onekey-hide-asset-details':
      process.env.ONEKEY_HIDE_ASSET_DETAILS ?? 'false',
    'x-onekey-instance-id': getInstanceId(),
    'x-onekey-request-build-number': getCliAppBuildNumber(),
    'x-onekey-request-currency':
      process.env.ONEKEY_REQUEST_CURRENCY ?? DEFAULT_CURRENCY,
    'x-onekey-request-device-name':
      process.env.ONEKEY_REQUEST_DEVICE_NAME ?? DEFAULT_DEVICE_NAME,
    'x-onekey-request-id': requestId,
    'x-onekey-request-jsbundle-version': getCliAppBundleVersion(),
    'x-onekey-request-locale':
      process.env.ONEKEY_REQUEST_LOCALE ?? DEFAULT_LOCALE,
    'x-onekey-request-platform':
      process.env.ONEKEY_REQUEST_PLATFORM ?? DEFAULT_PLATFORM,
    'x-onekey-request-platform-name': getPlatformName(),
    'x-onekey-request-theme': process.env.ONEKEY_REQUEST_THEME ?? DEFAULT_THEME,
    'x-onekey-request-version': getCliAppRequestVersion(),
    'x-onekey-wallet-type':
      process.env.ONEKEY_REQUEST_WALLET_TYPE ?? DEFAULT_WALLET_TYPE,
    'x-requested-with': 'XMLHttpRequest',
    ...extraHeaders,
  };
}
