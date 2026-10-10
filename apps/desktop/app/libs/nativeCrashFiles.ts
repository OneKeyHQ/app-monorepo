/* eslint-disable no-continue */
import { randomUUID } from 'crypto';
import { constants } from 'fs';
import fs from 'fs/promises';
import path from 'path';

import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';

import {
  MAX_NATIVE_CRASH_REPORTS,
  MAX_NATIVE_CRASH_REPORT_BYTES,
  NATIVE_CRASH_REPORT_AGE_MS,
  sanitizeNativeCrashReport,
} from './nativeCrashReport';

import type { INativeCrashReport } from './nativeCrashReport';

const REPORT_NAME = /^native-[a-f0-9-]{36}\.json$/;

async function ensureReportDirectory(logDir: string): Promise<string> {
  const directory = path.join(logDir, 'crashes');
  await fs.mkdir(directory, { recursive: true, mode: 0o700 });
  const stat = await fs.lstat(directory);
  if (!stat.isDirectory() || stat.isSymbolicLink())
    throw new OneKeyLocalError('Invalid report directory');
  return directory;
}

export async function writeNativeCrashReport(
  logDir: string,
  report: INativeCrashReport,
): Promise<void> {
  const clean = sanitizeNativeCrashReport(report);
  if (!clean) throw new OneKeyLocalError('Invalid report');
  const buffer = Buffer.from(JSON.stringify(clean));
  if (buffer.length > MAX_NATIVE_CRASH_REPORT_BYTES)
    throw new OneKeyLocalError('Oversized report');
  const directory = await ensureReportDirectory(logDir);
  const name = `native-${randomUUID()}.json`;
  const temporaryPath = path.join(directory, `${name}.tmp`);
  try {
    await fs.writeFile(temporaryPath, buffer, { flag: 'wx', mode: 0o600 });
    await fs.rename(temporaryPath, path.join(directory, name));
  } finally {
    await fs.unlink(temporaryPath).catch(() => {});
  }
}

// Return reconstructed bytes, never add a stored file (or an arbitrary crash
// directory) directly to the ZIP. Retention is enforced again at export time.
export async function readNativeCrashReports(
  logDir: string,
  now = Date.now(),
): Promise<{ name: string; data: Buffer }[]> {
  const directory = await ensureReportDirectory(logDir);
  const reports: { name: string; data: Buffer; collectedAt: number }[] = [];
  for (const name of await fs.readdir(directory)) {
    if (!REPORT_NAME.test(name)) continue;
    const filePath = path.join(directory, name);
    let handle: Awaited<ReturnType<typeof fs.open>> | undefined;
    try {
      const before = await fs.lstat(filePath);
      if (
        !before.isFile() ||
        before.isSymbolicLink() ||
        before.nlink !== 1 ||
        before.size > MAX_NATIVE_CRASH_REPORT_BYTES
      )
        throw new OneKeyLocalError('Invalid file');
      handle = await fs.open(
        filePath,
        constants.O_RDONLY | (constants.O_NOFOLLOW || 0),
      );
      const stat = await handle.stat();
      if (
        stat.ino !== before.ino ||
        stat.dev !== before.dev ||
        stat.size > MAX_NATIVE_CRASH_REPORT_BYTES
      )
        throw new OneKeyLocalError('Changed file');
      const data = Buffer.alloc(stat.size);
      const { bytesRead } = await handle.read(data, 0, data.length, 0);
      if (bytesRead !== data.length) throw new OneKeyLocalError('Short read');
      const report = sanitizeNativeCrashReport(
        JSON.parse(data.toString('utf8')) as unknown,
      );
      if (
        !report ||
        report.collectedAt > now ||
        now - report.collectedAt > NATIVE_CRASH_REPORT_AGE_MS
      )
        throw new OneKeyLocalError('Expired report');
      reports.push({
        name,
        data: Buffer.from(JSON.stringify(report)),
        collectedAt: report.collectedAt,
      });
      reports.sort((a, b) => b.collectedAt - a.collectedAt);
      if (reports.length > MAX_NATIVE_CRASH_REPORTS) {
        const excess = reports.pop();
        if (excess)
          await fs.unlink(path.join(directory, excess.name)).catch(() => {});
      }
    } catch {
      await fs.unlink(filePath).catch(() => {});
    } finally {
      await handle?.close();
    }
  }
  reports.sort((a, b) => b.collectedAt - a.collectedAt);
  for (const report of reports.slice(MAX_NATIVE_CRASH_REPORTS)) {
    await fs.unlink(path.join(directory, report.name)).catch(() => {});
  }
  return reports
    .slice(0, MAX_NATIVE_CRASH_REPORTS)
    .map(({ name, data }) => ({ name, data }));
}
