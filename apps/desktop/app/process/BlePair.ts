import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';

import isDev from 'electron-is-dev';
import logger from 'electron-log/main';

import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';

import { getAppStaticResourcesPath } from '../resoucePath';

// One-shot spawn wrapper for the `onekey-ble-pair` helper.
//
// Reuses the exact binary bundling + path layout of BaseProcess/BridgeProcess
// (resources/bin/<resource>/<system>/<name>), but this is NOT a resident
// daemon: it is spawned per pairing attempt, streams JSON lines on stdout, and
// exits. Windows-only — on macOS/Linux `ensureDevicePaired` is never called
// (guard with `isBlePairAvailable`), because CoreBluetooth bonds transparently
// and desktop BLE is disabled on Linux.

const RESOURCE = 'ble-pair';
const PROCESS_NAME = 'onekey-ble-pair';
// The user has up to the OS pairing window to confirm; keep some headroom.
const PAIR_TIMEOUT_MS = 60_000;

export type IBlePairEvent =
  | { type: 'diag'; t_ms: number; msg: string }
  | { type: 'pairing'; pin: string }
  // The device's stable identity address, read from the OS bond record after a
  // successful pair. Logged only for now: the SDK keys connect/write/subscribe
  // AND its inbound notification events off one id, and this seam cannot rewrite
  // the inbound ones — so swapping the id here would break the notify path.
  // Decide what to do with it once we know what a post-bond scan reports.
  | { type: 'identity'; address: string }
  | { type: 'paired' }
  | { type: 'already-paired' }
  | { type: 'is-paired'; paired: boolean }
  | { type: 'unpaired' }
  | { type: 'error'; message: string };

function getPlatform(): string {
  switch (process.platform) {
    case 'darwin':
      return 'mac';
    case 'win32':
      return 'win';
    default:
      return process.platform;
  }
}

function resolveHelperPath(): string {
  const system = `${getPlatform()}-${process.arch}`;
  const ext = process.platform === 'win32' ? '.exe' : '';
  // Same layout as BaseProcess: dev keeps the <system> subdir; packaged builds
  // flatten it via electron-builder extraResources (to: bin/ble-pair).
  const dir = path.join(
    getAppStaticResourcesPath(),
    'bin',
    RESOURCE,
    isDev ? system : '',
  );
  return path.join(dir, `${PROCESS_NAME}${ext}`);
}

export function isBlePairSupported(): boolean {
  return process.platform === 'win32';
}

/** Windows AND the helper binary is actually bundled (old installs may lack it,
 * in which case callers should fall back instead of hard-failing connect). */
export function isBlePairAvailable(): boolean {
  return isBlePairSupported() && fs.existsSync(resolveHelperPath());
}

function runHelper(
  args: string[],
  onEvent?: (event: IBlePairEvent) => void,
): Promise<IBlePairEvent[]> {
  return new Promise((resolve, reject) => {
    const helperPath = resolveHelperPath();
    logger.info(`[BlePair] spawning ${helperPath} ${args.join(' ')}`);

    const child = spawn(helperPath, args, {
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    const spawnedAt = Date.now();
    const sinceSpawn = () => Date.now() - spawnedAt;

    const events: IBlePairEvent[] = [];
    let stdoutBuf = '';
    let settled = false;
    let lastError: string | undefined;

    const timer = setTimeout(() => {
      lastError = `BLE pairing timed out after ${PAIR_TIMEOUT_MS}ms`;
      child.kill();
    }, PAIR_TIMEOUT_MS);

    const settle = (fn: () => void) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      fn();
    };

    child.stdout?.on('data', (chunk: Buffer) => {
      stdoutBuf += chunk.toString('utf8');
      let nl = stdoutBuf.indexOf('\n');
      while (nl >= 0) {
        const line = stdoutBuf.slice(0, nl).trim();
        stdoutBuf = stdoutBuf.slice(nl + 1);
        nl = stdoutBuf.indexOf('\n');
        if (line) {
          try {
            const event = JSON.parse(line) as IBlePairEvent;
            events.push(event);
            // Every helper event is logged, not just failures: `Failed(19)` is
            // opaque, so the surrounding state (address type, bond inventory,
            // link up/down, timings) is what actually explains a failing run.
            if (event.type === 'diag') {
              logger.info(`[BlePair] +${event.t_ms}ms ${event.msg}`);
            } else {
              logger.info(
                `[BlePair] +${sinceSpawn()}ms event ${JSON.stringify(event)}`,
              );
            }
            if (event.type === 'error') {
              lastError = event.message;
            }
            onEvent?.(event);
          } catch {
            logger.warn(`[BlePair] non-JSON stdout line: ${line}`);
          }
        }
      }
    });

    child.stderr?.on('data', (chunk: Buffer) => {
      logger.warn(`[BlePair] stderr: ${chunk.toString('utf8').trim()}`);
    });

    child.on('error', (err) => {
      settle(() => reject(err));
    });

    child.on('exit', (code) => {
      settle(() => {
        logger.info(
          `[BlePair] exit code=${code ?? 'null'} after ${sinceSpawn()}ms`,
        );
        if (code === 0) {
          resolve(events);
        } else {
          reject(
            new OneKeyLocalError(
              lastError ?? `helper exited with code ${code ?? 'unknown'}`,
            ),
          );
        }
      });
    });
  });
}

/**
 * Pair `address` (a colon/dash BLE MAC) at the OS level, streaming the
 * numeric-comparison pin to `onPin` so the UI can show it. Resolves once the
 * device is paired (or already paired); rejects on error/timeout.
 *
 * Returns which of the two it was: a fresh bond briefly stops the device from
 * advertising, an existing one does not, and only the caller knows whether that
 * matters.
 */
export async function ensureDevicePaired(
  address: string,
  onPin: (pin: string) => void,
): Promise<'paired' | 'already-paired'> {
  const events = await runHelper(['pair', '--address', address], (event) => {
    if (event.type === 'pairing') {
      onPin(event.pin);
    }
  });
  if (events.some((e) => e.type === 'paired')) {
    return 'paired';
  }
  if (events.some((e) => e.type === 'already-paired')) {
    return 'already-paired';
  }
  throw new OneKeyLocalError('BLE pairing did not complete');
}

/** Query whether the OS already holds a bond for `address`. */
export async function isDevicePaired(address: string): Promise<boolean> {
  const events = await runHelper(['is-paired', '--address', address]);
  const result = events.find((e) => e.type === 'is-paired');
  return result?.type === 'is-paired' ? result.paired : false;
}

/** Remove the OS bond for `address` (re-pair / orphan cleanup). */
export async function forgetDevice(address: string): Promise<void> {
  await runHelper(['forget', '--address', address]);
}

/**
 * Fire-and-forget raw advertisement dump into the app log.
 *
 * ACTIVE scan, no service-UUID filter — deliberately everything noble's filtered
 * scan could be hiding. This is the only way to tell "the device is not
 * advertising at all" apart from "it IS advertising but we filter it out", and —
 * after a bond — whether Windows resolves the device's rotating RPA back to a
 * stable identity address. Rebuilding the app to find that out is expensive, so
 * the answer is captured in the normal log instead.
 *
 * Never awaited and never throws: this is instrumentation, it must not be able
 * to fail a connect.
 */
export function startRawAdvertisementWatch(
  seconds: number,
  reason: string,
): void {
  if (!isBlePairAvailable()) return;
  logger.info(
    `[BlePair] raw advertisement watch (${seconds}s), reason=${reason}`,
  );
  void runHelper(['watch', '--seconds', String(seconds)]).catch((error) => {
    logger.warn(
      `[BlePair] raw watch failed: ${
        error instanceof Error ? error.message : ''
      }`,
    );
  });
}
