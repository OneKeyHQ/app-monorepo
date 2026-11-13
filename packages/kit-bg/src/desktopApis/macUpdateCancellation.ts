import { execFile } from 'child_process';
import fs from 'fs';
import path from 'path';

import { app } from 'electron';
import logger from 'electron-log/main';

import {
  EUpdateErrorCode,
  createUpdateError,
} from '@onekeyhq/shared/src/modules3rdParty/auto-update/error';

export type IMacUpdateSnapshot = Record<string, unknown>;
export type IMacPreparedBuild = { current: string; previous: string };
type IMacCancellationRecord = {
  version: 1;
  snapshot?: IMacUpdateSnapshot;
  build?: IMacPreparedBuild;
};

function invoke(request: Record<string, unknown>): Promise<{
  snapshot?: IMacUpdateSnapshot;
  status?: string;
}> {
  const executable = app.isPackaged
    ? path.join(process.resourcesPath, 'bin/squirrel-cancel')
    : path.join(app.getAppPath(), 'build/native/squirrel-cancel');
  return new Promise((resolve, reject) => {
    const child = execFile(
      executable,
      [],
      { timeout: 60_000, maxBuffer: 65_536 },
      (error, stdout) => {
        try {
          const response = JSON.parse(stdout) as {
            error?: string;
            unchanged?: boolean;
            snapshot?: IMacUpdateSnapshot;
            status?: string;
          };
          if (error || response.error) {
            logger.warn(
              'auto-updater',
              'Native cancellation failed',
              response.error || 'HELPER_FAILED',
            );
            const failure = createUpdateError({
              code: EUpdateErrorCode.installFailed,
              step: 'cleanup',
            });
            Object.assign(failure, {
              nativeCancellationUnchanged: response.unchanged === true,
            });
            reject(failure);
            return;
          }
          resolve(response);
        } catch {
          logger.warn(
            'auto-updater',
            'Native cancellation helper unavailable',
            error?.message || 'INVALID_RESPONSE',
          );
          reject(
            createUpdateError({
              code: EUpdateErrorCode.installFailed,
              step: 'cleanup',
            }),
          );
        }
      },
    );
    // execFile's callback reports failed startup/exit; do not turn an early
    // helper exit into an unhandled EPIPE in the main process.
    child.stdin?.on('error', () => undefined);
    child.stdin?.end(JSON.stringify(request));
  });
}

export async function captureMacUpdate(version: string, stagedAfter: number) {
  const result = await invoke({ action: 'capture', version, stagedAfter });
  if (!result.snapshot)
    throw createUpdateError({
      code: EUpdateErrorCode.installFailed,
      step: 'cleanup',
    });
  return result.snapshot;
}

// A persistent barrier also covers failure after the native job was stopped but
// before OneKey's cache/DB cleanup finished. Automatic operations must not erase it.
export function getMacCancellationMarker(cacheDir: string) {
  return path.join(path.dirname(cacheDir), 'mac-update-cancellation.json');
}

export async function cancelMacUpdate(
  cacheDir: string,
  snapshot?: IMacUpdateSnapshot,
  build?: IMacPreparedBuild,
) {
  const marker = getMacCancellationMarker(cacheDir);
  let saved: IMacCancellationRecord = { version: 1, snapshot, build };
  const existingMarker = fs.existsSync(marker);
  if (existingMarker) {
    saved = JSON.parse(
      fs.readFileSync(marker, 'utf8'),
    ) as IMacCancellationRecord;
    if (
      saved?.version !== 1 ||
      (saved.build &&
        (typeof saved.build.current !== 'string' ||
          typeof saved.build.previous !== 'string'))
    ) {
      throw createUpdateError({
        code: EUpdateErrorCode.installFailed,
        step: 'cleanup',
      });
    }
  } else {
    fs.mkdirSync(path.dirname(marker), { recursive: true });
    const temporary = `${marker}.${process.pid}.tmp`;
    try {
      fs.writeFileSync(temporary, JSON.stringify(saved), {
        mode: 0o600,
      });
      fs.renameSync(temporary, marker);
    } finally {
      fs.rmSync(temporary, { force: true });
    }
  }
  let result;
  try {
    result = await invoke({ action: 'cancel', snapshot: saved.snapshot });
  } catch (error) {
    if (
      !existingMarker &&
      (error as { nativeCancellationUnchanged?: boolean })
        .nativeCancellationUnchanged
    ) {
      fs.rmSync(marker, { force: true });
    }
    throw error;
  }
  if (!['cancelled', 'not-staged'].includes(result.status || '')) {
    throw createUpdateError({
      code: EUpdateErrorCode.installFailed,
      step: 'cleanup',
    });
  }
  return saved.build;
}

export async function finishMacUpdateCancellation(cacheDir: string) {
  await invoke({ action: 'finish' });
  fs.rmSync(getMacCancellationMarker(cacheDir), { force: true });
}
