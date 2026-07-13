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
  | { type: 'pairing'; pin: string }
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
 */
export async function ensureDevicePaired(
  address: string,
  onPin: (pin: string) => void,
): Promise<void> {
  const events = await runHelper(['pair', '--address', address], (event) => {
    if (event.type === 'pairing') {
      onPin(event.pin);
    }
  });
  const ok = events.some(
    (e) => e.type === 'paired' || e.type === 'already-paired',
  );
  if (!ok) {
    throw new OneKeyLocalError('BLE pairing did not complete');
  }
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
