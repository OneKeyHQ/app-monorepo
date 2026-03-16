/**
 * Electron main process logger configuration.
 * Aligns electron-log with react-native-native-logger behavior on iOS/Android.
 *
 * Must be imported before any other code that uses logger.
 */
import fs from 'fs';
import path from 'path';

import logger from 'electron-log/main';

// ---------------------------------------------------------------------------
// File transport configuration
// ---------------------------------------------------------------------------

logger.initialize();

// File naming and size aligned with native MAX_FILE_SIZE / MAX_HISTORY
logger.transports.file.fileName = 'app-latest.log';
logger.transports.file.maxSize = 20 * 1024 * 1024;

// ---------------------------------------------------------------------------
// Archive rotation: date-based archives as app-{date}.{i}.log
// ---------------------------------------------------------------------------

const MAX_LOG_HISTORY = 6;

logger.transports.file.archiveLogFn = (oldLogFile: {
  path: string;
  toString(): string;
}) => {
  const oldPath = oldLogFile.path || oldLogFile.toString();
  const dir = path.dirname(oldPath);
  const now = new Date();
  const pad2 = (n: number) => String(n).padStart(2, '0');
  const dateStr = `${now.getFullYear()}-${pad2(now.getMonth() + 1)}-${pad2(now.getDate())}`;

  // Find next available index using link+unlink for cross-platform safety.
  // On Linux, renameSync silently overwrites the target, so we use
  // linkSync (which throws EEXIST atomically) to avoid overwriting archives.
  let index = 0;
  let moved = false;
  while (!moved && index < 1000) {
    const archivePath = path.join(dir, `app-${dateStr}.${index}.log`);
    try {
      fs.linkSync(oldPath, archivePath);
      fs.unlinkSync(oldPath);
      moved = true;
    } catch (e: any) {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      if (e?.code === 'EEXIST') {
        // Collision: archive slot taken; try next index
        index += 1;
        // eslint-disable-next-line no-continue
        continue;
      }
      // linkSync not supported (e.g. cross-device) — fall back to renameSync
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      if (e?.code === 'EXDEV') {
        try {
          fs.renameSync(oldPath, archivePath);
          moved = true;
        } catch {
          // eslint-disable-next-line no-console
          console.warn('[log-archive] Failed to archive log file:', e);
          break;
        }
      } else {
        // eslint-disable-next-line no-console
        console.warn('[log-archive] Failed to archive log file:', e);
        break;
      }
    }
    index += 1;
  }
  if (!moved) {
    // eslint-disable-next-line no-console
    console.warn('[log-archive] Could not archive after 1000 attempts');
  }

  // Cleanup: remove oldest archives beyond MAX_HISTORY
  try {
    const files = fs
      .readdirSync(dir)
      .filter(
        (f: string) =>
          f.startsWith('app-') && f.endsWith('.log') && f !== 'app-latest.log',
      )
      .toSorted((a: string, b: string) => {
        // Sort by date desc, then by numeric index desc
        // e.g. app-2026-03-16.10.log should sort after app-2026-03-16.2.log
        const parseArchive = (f: string) => {
          const m = f.match(/^app-(\d{4}-\d{2}-\d{2})\.(\d+)\.log$/);
          return m
            ? { date: m[1], index: parseInt(m[2], 10) }
            : { date: f, index: 0 };
        };
        const pa = parseArchive(a);
        const pb = parseArchive(b);
        if (pa.date !== pb.date) return pb.date.localeCompare(pa.date);
        return pb.index - pa.index;
      });

    if (files.length > MAX_LOG_HISTORY) {
      for (const file of files.slice(MAX_LOG_HISTORY)) {
        try {
          fs.unlinkSync(path.join(dir, file));
        } catch {
          // ignore cleanup errors
        }
      }
    }

    // Clean up legacy main.log / main.old.log files from previous electron-log defaults
    for (const legacyFile of ['main.log', 'main.old.log']) {
      try {
        fs.unlinkSync(path.join(dir, legacyFile));
      } catch {
        // ignore if not exists
      }
    }
  } catch {
    // ignore cleanup errors
  }
};

// ---------------------------------------------------------------------------
// Sanitization and truncation (applied in file format transform)
// ---------------------------------------------------------------------------

const SENSITIVE_PATTERNS = [
  /(?:0x)?[0-9a-fA-F]{64}/g,
  /\b[5KL][1-9A-HJ-NP-Za-km-z]{50,51}\b/g,
  /\b[xyzXYZ](?:prv|pub)[1-9A-HJ-NP-Za-km-z]{107,108}\b/g,
  /(?:\b[a-z]{3,8}\b[\s,]+){11,}\b[a-z]{3,8}\b/g,
  /(?:Bearer|token[=:]?)\s*[A-Za-z0-9_.\-+/=]{20,}/g,
  /(?:eyJ|AAAA)[A-Za-z0-9+/=]{40,}/g,
];

const MAX_MESSAGE_LENGTH = 4096;

function sanitizeMessage(message: string): string {
  let result = message;
  for (const pattern of SENSITIVE_PATTERNS) {
    pattern.lastIndex = 0;
    result = result.replace(pattern, '[REDACTED]');
  }
  return result.replace(/\n/g, ' ').replace(/\r/g, ' ');
}

function truncateMessage(message: string): string {
  if (message.length > MAX_MESSAGE_LENGTH) {
    return `${message.slice(0, MAX_MESSAGE_LENGTH)}...(truncated)`;
  }
  return message;
}

function sanitizeAndTruncateData(data: any[]): string[] {
  return data.map((item) => {
    // Serialize non-string items so sensitive data in objects/arrays
    // (e.g. Bearer tokens in headers, hex keys in data structures) is also redacted
    let str: string;
    if (typeof item === 'string') {
      str = item;
    } else if (item instanceof Error) {
      // Error properties (message, stack) are non-enumerable,
      // so JSON.stringify returns '{}'. Use stack instead.
      str = item.stack || `${item.name}: ${item.message}`;
    } else if (item === undefined || typeof item === 'function') {
      str = String(item);
    } else {
      try {
        const json = JSON.stringify(item);
        str = json ?? String(item);
      } catch {
        str = String(item);
      }
    }
    return truncateMessage(sanitizeMessage(str));
  });
}

// ---------------------------------------------------------------------------
// Rate limiting via logger.hooks (runs before any transport)
// Returning null drops the message entirely.
// - DEBUG/INFO: 400/s, burst 2000
// - WARN: 1000/s, burst 2000
// - ERROR: never limited
// ---------------------------------------------------------------------------

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

// 1s cooldown for drop reports, matching native lastDropReportMs behavior
let lastDropReportAt = 0;

logger.hooks.push((message: any) => {
  // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
  const level: string = message?.level ?? 'info';
  if (level === 'error') {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return
    return message;
  }
  const bucket =
    level === 'warn' ? rateLimitBuckets.warn : rateLimitBuckets.debugInfo;
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
    // Report dropped count at most once per second, deferred to avoid
    // re-entering the hook (which would consume warn bucket tokens)
    if (bucket.dropped > 0 && now - lastDropReportAt >= 1000) {
      const dropped = bucket.dropped;
      const droppedLevel = level;
      bucket.dropped = 0;
      lastDropReportAt = now;
      setImmediate(() => {
        logger.warn(
          `[OneKeyLog] Rate-limited: dropped ${dropped} ${droppedLevel} log messages`,
        );
      });
    }
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return
    return message;
  }
  bucket.dropped += 1;
  return null;
});

// ---------------------------------------------------------------------------
// File format: sanitize + truncate all messages
// ---------------------------------------------------------------------------

// eslint-disable-next-line @typescript-eslint/no-unsafe-return
logger.transports.file.format = (params: {
  data: any[];
  level: string;
  message: { date: Date; scope?: string };
}) => {
  const filtered = sanitizeAndTruncateData(params.data);

  if (params.message?.scope === 'app') {
    // App-scoped messages from renderer: write filtered data as-is
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return
    return filtered;
  }

  // Main process messages: add timestamp and level prefix
  const d = params.message.date;
  const pad2 = (n: number) => String(n).padStart(2, '0');
  const pad3 = (n: number) => String(n).padStart(3, '0');
  const ts = `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())} ${pad2(d.getHours())}:${pad2(d.getMinutes())}:${pad2(d.getSeconds())}.${pad3(d.getMilliseconds())}`;
  // eslint-disable-next-line @typescript-eslint/no-unsafe-return
  return [`[${ts}] [${params.level}]`, ...filtered];
};

// Startup marker matching native: OneKeyLog.info("App", "OneKey started")
logger.info('[App] OneKey started');
