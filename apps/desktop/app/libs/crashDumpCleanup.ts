import fs from 'fs';
import path from 'path';

import { app } from 'electron';
import logger from 'electron-log/main';

const MAX_SENTRY_CACHE_AGE_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

async function removeOldFiles(
  dirPath: string,
  maxAgeMs: number,
  isRoot = true,
): Promise<number> {
  let removedCount = 0;
  const now = Date.now();
  try {
    const entries = await fs.promises.readdir(dirPath, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dirPath, entry.name);
      try {
        if (entry.isDirectory()) {
          removedCount += await removeOldFiles(fullPath, maxAgeMs, false);
        } else {
          const stats = await fs.promises.stat(fullPath);
          if (now - stats.mtimeMs > maxAgeMs) {
            await fs.promises.unlink(fullPath);
            removedCount += 1;
          }
        }
      } catch (_e) {
        // Ignore individual file errors
      }
    }
    // Remove empty subdirectories after cleaning old files (keep root dir)
    if (!isRoot) {
      const remaining = await fs.promises.readdir(dirPath);
      if (remaining.length === 0) {
        await fs.promises.rmdir(dirPath).catch(() => {});
      }
    }
  } catch (_e) {
    // Directory may not exist
  }
  return removedCount;
}

async function performCleanup() {
  // Native dump processing/retention is owned by nativeCrash.ts.
  // 2. Remove Sentry cache files older than 30 days
  const sentryCachePath = path.join(app.getPath('userData'), 'sentry');
  const sentryFilesRemoved = await removeOldFiles(
    sentryCachePath,
    MAX_SENTRY_CACHE_AGE_MS,
  );
  if (sentryFilesRemoved > 0) {
    logger.info(
      `[CrashDumpCleanup] Removed ${sentryFilesRemoved} old Sentry cache files from ${sentryCachePath}`,
    );
  }
}

const CLEANUP_DELAY_MS = 60_000; // 60 seconds after app ready

export function scheduleCrashDumpCleanup() {
  setTimeout(() => {
    performCleanup().catch((error) => {
      logger.error('[CrashDumpCleanup] Cleanup failed:', error);
    });
  }, CLEANUP_DELAY_MS);
}
