/* eslint-disable no-continue */
// cspell:ignore Crashpad
import fs from 'fs/promises';
import path from 'path';

import { app, utilityProcess } from 'electron';
import logger from 'electron-log/main';

import { startNativeCrashCapture } from './nativeCrashCapture';
import {
  readNativeCrashReports,
  writeNativeCrashReport,
} from './nativeCrashFiles';
import {
  MAX_NATIVE_CRASH_REPORTS,
  MAX_NATIVE_DUMP_BYTES,
  sanitizeNativeCrashReport,
} from './nativeCrashReport';

import type { INativeCrashReport } from './nativeCrashReport';

const PARSER_TIMEOUT_MS = 5000;
const MAX_RAW_DUMP_AGE_MS = 24 * 60 * 60 * 1000;
const SETTLE_MS = 5000;
const PARSER_SERVICE = 'OneKey native crash parser';
let collecting: Promise<void> | undefined;
let started = false;
let crashDumpsDirectory = '';

export function parseNativeCrashInUtilityProcess(
  filePath: string,
): Promise<INativeCrashReport | undefined> {
  return new Promise((resolve) => {
    // No shell, network endpoint, inherited credentials, native parsing addon,
    // stdout, or stderr. The native shell bundles this project-owned JS entry.
    const child = utilityProcess.fork(
      path.join(__dirname, 'nativeCrashWorker.js'),
      [filePath],
      {
        execArgv: ['--max-old-space-size=64'],
        env: {},
        stdio: 'ignore',
        serviceName: PARSER_SERVICE,
      },
    );
    let finished = false;
    let result: INativeCrashReport | undefined;
    // The callback is defined before the timer is created.
    // eslint-disable-next-line prefer-const
    let timeout: ReturnType<typeof setTimeout> | undefined;
    const finish = () => {
      if (finished) return;
      finished = true;
      clearTimeout(timeout);
      child.removeAllListeners();
      child.kill();
      resolve(result);
    };
    timeout = setTimeout(finish, PARSER_TIMEOUT_MS);
    child.on('message', (message: unknown) => {
      result = sanitizeNativeCrashReport(message);
      // Kill before resolving so no parser retains an open dump during deletion.
      child.kill();
    });
    child.once('exit', finish);
    child.once('error', finish);
  });
}

type IDump = {
  filePath: string;
  mtimeMs: number;
  size: number;
  ino: number;
  dev: number;
};

async function removeDump(dump: IDump): Promise<void> {
  const stat = await fs.lstat(dump.filePath).catch(() => undefined);
  if (
    stat?.isFile() &&
    stat.ino === dump.ino &&
    stat.dev === dump.dev &&
    stat.mtimeMs === dump.mtimeMs &&
    stat.size === dump.size
  ) {
    await fs.unlink(dump.filePath).catch(() => {});
  }
}

async function findDumps(
  directory: string,
  depth = 0,
  now = Date.now(),
): Promise<IDump[]> {
  const stat = await fs.lstat(directory);
  if (!stat.isDirectory() || stat.isSymbolicLink()) return [];
  const dumps: IDump[] = [];
  const entries = await fs.opendir(directory);
  for await (const entry of entries) {
    const filePath = path.join(directory, entry.name);
    if (entry.isDirectory() && depth < 2) {
      dumps.push(
        ...(await findDumps(filePath, depth + 1, now).catch(() => [])),
      );
    } else if (entry.isFile() && entry.name.endsWith('.dmp')) {
      const file = await fs.lstat(filePath).catch(() => undefined);
      if (file?.isFile() && !file.isSymbolicLink() && file.nlink === 1) {
        const dump = {
          filePath,
          mtimeMs: file.mtimeMs,
          size: file.size,
          ino: file.ino,
          dev: file.dev,
        };
        if (now - file.mtimeMs < SETTLE_MS && file.mtimeMs <= now) continue;
        if (
          file.size > MAX_NATIVE_DUMP_BYTES ||
          now - file.mtimeMs > MAX_RAW_DUMP_AGE_MS ||
          file.mtimeMs > now
        ) {
          await removeDump(dump);
        } else dumps.push(dump);
      }
    }
    dumps.sort((a, b) => b.mtimeMs - a.mtimeMs);
    while (dumps.length > MAX_NATIVE_CRASH_REPORTS) {
      const excess = dumps.pop();
      if (excess && now - excess.mtimeMs >= SETTLE_MS) await removeDump(excess);
    }
  }
  return dumps;
}

async function collectDumps(): Promise<void> {
  const logDir = path.dirname(logger.transports.file.getFile().path);
  const now = Date.now();
  const dumps = await findDumps(crashDumpsDirectory).catch(() => []);
  dumps.sort((a, b) => b.mtimeMs - a.mtimeMs);
  let attempted = 0;
  for (const dump of dumps) {
    // Let Crashpad finish writing; active dumps are picked up by the next sweep.
    if (now - dump.mtimeMs < SETTLE_MS && dump.mtimeMs <= now) continue;
    if (
      dump.size <= MAX_NATIVE_DUMP_BYTES &&
      now - dump.mtimeMs <= MAX_RAW_DUMP_AGE_MS &&
      dump.mtimeMs <= now &&
      attempted < MAX_NATIVE_CRASH_REPORTS
    ) {
      attempted += 1;
      try {
        const report = await parseNativeCrashInUtilityProcess(dump.filePath);
        if (report)
          await writeNativeCrashReport(logDir, {
            ...report,
            collectedAt: Date.now(),
          });
      } catch {
        // Static status only: exceptions can contain a path or dump bytes.
        logger.warn('[native-crash] Report processing failed');
      }
    }
    // Unsupported, malformed, oversized, expired, excess, and timed-out dumps
    // are discarded too. Never preserve raw memory as a fallback export.
    await removeDump(dump);
  }
  await readNativeCrashReports(logDir);
}

export async function collectNativeCrashReports(): Promise<void> {
  if (!started) return;
  if (!collecting) {
    collecting = collectDumps()
      .catch(() => {
        logger.warn('[native-crash] Collection unavailable');
      })
      .finally(() => {
        collecting = undefined;
      });
  }
  await collecting;
}

// Called before app.ts/native dependencies and before any renderer is created.
export function startNativeCrashCollection(): void {
  if (started || process.mas) return;
  // Previous-launch dumps still need disposal if reporter startup is unavailable.
  let directory = startNativeCrashCapture();
  if (!directory) {
    try {
      directory = app.getPath('crashDumps');
    } catch {
      return;
    }
  }
  if (!directory) return;
  crashDumpsDirectory = directory;
  started = true;
  void app.whenReady().then(() => {
    void collectNativeCrashReports();
    const interval = setInterval(() => {
      void collectNativeCrashReports();
    }, 60_000);
    const schedule = () => {
      setTimeout(() => {
        void collectNativeCrashReports();
      }, SETTLE_MS);
    };
    app.on('render-process-gone', schedule);
    app.on('child-process-gone', (_event, details) => {
      if (details.name !== PARSER_SERVICE && details.reason === 'crashed')
        schedule();
    });
    app.once('before-quit', () => {
      clearInterval(interval);
    });
  });
}
