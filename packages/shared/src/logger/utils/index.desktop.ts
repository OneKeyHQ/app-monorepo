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
  // Matches space and comma separators, aligned with native NativeLogger.sanitize()
  // V8 regex engine handles this linearly due to disjoint character classes
  /(?:\b[a-z]{3,8}\b[\s,]+){11,}\b[a-z]{3,8}\b/g,
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

// Per-level rate limiting matching native token bucket behavior:
// - DEBUG/INFO: 400/s, burst 2000
// - WARN: 1000/s, burst 2000
// - ERROR: never limited
type IRateLimitBucket = {
  tokens: number;
  lastRefill: number;
  dropped: number;
  ratePerSecond: number;
  burstCapacity: number;
};

function createBucket(ratePerSecond: number, burstCapacity: number) {
  return {
    tokens: burstCapacity,
    lastRefill: Date.now(),
    dropped: 0,
    ratePerSecond,
    burstCapacity,
  } satisfies IRateLimitBucket;
}

const rateLimitBuckets = {
  debugInfo: createBucket(400, 2000),
  warn: createBucket(1000, 2000),
};

function isRateLimited(level: 'info' | 'warn' | 'error' = 'info'): boolean {
  if (level === 'error') {
    return false;
  }
  const bucket = level === 'warn' ? rateLimitBuckets.warn : rateLimitBuckets.debugInfo;
  const now = Date.now();
  const elapsed = Math.max(0, now - bucket.lastRefill);
  if (elapsed > 0) {
    bucket.tokens = Math.min(
      bucket.burstCapacity,
      bucket.tokens + (elapsed / 1000) * bucket.ratePerSecond,
    );
    bucket.lastRefill = now;
  }
  if (bucket.tokens >= 1) {
    bucket.tokens -= 1;
    if (bucket.dropped > 0) {
      const dropped = bucket.dropped;
      bucket.dropped = 0;
      appLogger.warn(
        `[OneKeyLog] Rate-limited: dropped ${dropped} ${level} log messages`,
      );
    }
    return false;
  }
  bucket.dropped += 1;
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
