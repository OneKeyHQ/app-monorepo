import logger from 'electron-log/renderer';

import platformEnv from '../../platformEnv';

import type { IUtilsType } from './types';

logger.transports.console.level = false;

// Use 'app' scope so the main process format function can strip
// electron-log's own timestamp/level prefix for app logs,
// aligning output with react-native-native-logger on mobile.
const appLogger = logger.scope('app');

// ---------------------------------------------------------------------------
// Align with react-native-native-logger security & performance features
// ---------------------------------------------------------------------------

const MAX_MESSAGE_LENGTH = 4096;

// Sensitive data patterns matching native NativeLogger.sanitize()
const SENSITIVE_PATTERNS = [
  // Hex-encoded private keys (64 hex chars), with optional 0x prefix
  /(?:0x)?[0-9a-fA-F]{64}/g,
  // WIF private keys (base58, starting with 5, K, or L)
  /\b[5KL][1-9A-HJ-NP-Za-km-z]{50,51}\b/g,
  // Extended keys (xprv/xpub/zprv/zpub/yprv/ypub)
  /\b[xyzXYZ](?:prv|pub)[1-9A-HJ-NP-Za-km-z]{107,108}\b/g,
  // BIP39 mnemonic-like sequences (12+ words of 3-8 lowercase letters)
  // Use single space instead of [\s,]+ to avoid nested quantifier ReDoS
  /(?:\b[a-z]{3,8} ){11,}\b[a-z]{3,8}\b/g,
  // Bearer/API tokens
  /(?:Bearer|token[=:]?)\s*[A-Za-z0-9_.\-+/=]{20,}/g,
  // Base64 encoded data that looks like keys (44+ chars)
  /(?:eyJ|AAAA)[A-Za-z0-9+/=]{40,}/g,
];

function sanitize(message: string): string {
  let result = message;
  for (const pattern of SENSITIVE_PATTERNS) {
    // Reset lastIndex for global regexps
    pattern.lastIndex = 0;
    result = result.replace(pattern, '[REDACTED]');
  }
  // Strip newlines to prevent log injection
  result = result.replace(/\n/g, ' ').replace(/\r/g, ' ');
  return result;
}

function truncate(message: string): string {
  if (message.length > MAX_MESSAGE_LENGTH) {
    return `${message.slice(0, MAX_MESSAGE_LENGTH)}...(truncated)`;
  }
  return message;
}

// Rate limiting: token bucket matching native debugInfoRate=400/s, burst=2000
const RATE_PER_SECOND = 400;
const BURST_CAPACITY = 2000;
let rateLimitTokens = BURST_CAPACITY;
let rateLimitLastRefill = Date.now();
let rateLimitDropped = 0;

function isRateLimited(): boolean {
  const now = Date.now();
  const elapsed = Math.max(0, now - rateLimitLastRefill);
  if (elapsed > 0) {
    rateLimitTokens = Math.min(
      BURST_CAPACITY,
      rateLimitTokens + (elapsed / 1000) * RATE_PER_SECOND,
    );
    rateLimitLastRefill = now;
  }
  if (rateLimitTokens >= 1) {
    rateLimitTokens -= 1;
    if (rateLimitDropped > 0) {
      const dropped = rateLimitDropped;
      rateLimitDropped = 0;
      appLogger.warn(
        `[OneKeyLog] Rate-limited: dropped ${dropped} log messages`,
      );
    }
    return false;
  }
  rateLimitDropped += 1;
  return true;
}

const consoleFunc = (msg: string) => {
  if (isRateLimited()) {
    return;
  }
  const sanitized = truncate(sanitize(msg));
  if (platformEnv.isDev) {
    // eslint-disable-next-line no-console
    console.log(sanitized);
  }
  appLogger.info(sanitized);
};

const getLogFilePath = () => Promise.resolve('');

const desktopPlatform = globalThis.desktopApi.platform;
const desktopSystemVersion = globalThis.desktopApi.systemVersion;
const getDeviceInfo = () =>
  [
    `System: ${desktopPlatform} ${desktopSystemVersion}`,
    `appPlatform: ${platformEnv.appPlatform ?? ''}`,
    `appChannel: ${platformEnv.appChannel ?? ''}`,
    `buildNumber: ${platformEnv.buildNumber ?? ''}`,
    `Version Hash: ${platformEnv.githubSHA ?? ''}`,
    `version: ${platformEnv.version ?? ''}`,
  ].join(',');

const utils: IUtilsType = { getDeviceInfo, getLogFilePath, consoleFunc };
export default utils;
