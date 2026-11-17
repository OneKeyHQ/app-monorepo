import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';

import { HardwareErrorCode, createHwkError } from '@onekeyfe/hwk-adapter-core';
import { app } from 'electron';
import electronIsDev from 'electron-is-dev';
import logger from 'electron-log/main';

import { getAppStaticResourcesPath } from '../resoucePath';

import type { IHwkErrorPayload } from '@onekeyfe/hwk-adapter-core';

const isDev = !app?.isPackaged && electronIsDev;

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
// After the deadline the helper still needs a moment to decline before it is killed.
const PAIR_DECLINE_GRACE_MS = 5000;
// Once confirmed the user is out of the loop, but PairAsync must not hang forever:
// the helper's own deadline only covers waiting for a decision, not the ceremony.
const PAIR_COMPLETION_TIMEOUT_MS = 30_000;

export type IBlePairEvent =
  | { type: 'diag'; t_ms: number; msg: string }
  | { type: 'link'; connected: boolean }
  | { type: 'pairing-result'; status: number }
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

/**
 * The helper reports a WinRT pairing result only in its text, as
 * `DevicePairingResultStatus(N)`. Any other failure means it never got that far.
 */
function helperFailure(message: string): IHwkErrorPayload {
  const status = /DevicePairingResultStatus\((\d+)\)/.exec(message)?.[1];
  if (status === undefined) {
    return { code: HardwareErrorCode.BleConnectFailed, message };
  }
  return {
    code: HardwareErrorCode.BlePairingTimeout,
    message,
    params: { phase: 'pairing', pairingStatus: Number(status) },
  };
}

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
  registerDecide?: (decide: (decision: IPairDecision) => void) => void,
  closePrompt?: () => void,
  confirmationTimeoutMs = PAIR_TIMEOUT_MS,
  disconnectGraceMs = 0,
): Promise<IBlePairEvent[]> {
  return new Promise((resolve, reject) => {
    const helperPath = resolveHelperPath();
    logger.info(`[BlePair] spawning ${helperPath} ${args.join(' ')}`);

    // stdin carries the pair decision (confirm/cancel).
    const child = spawn(helperPath, args, {
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    const spawnedAt = Date.now();
    const sinceSpawn = () => Date.now() - spawnedAt;

    const events: IBlePairEvent[] = [];
    let stdoutBuf = '';
    let settled = false;
    let failure: IHwkErrorPayload | undefined;

    // Once we know why the attempt ends, the helper's own failure must not
    // replace it: a declined pairing also ends in `pairing failed with status N`.
    let failureLocked = false;
    let waitingForDecision = false;
    let confirmationTimer: ReturnType<typeof setTimeout> | undefined;
    let disconnectTimer: ReturnType<typeof setTimeout> | undefined;
    const clearDisconnectTimer = () => {
      if (disconnectTimer) clearTimeout(disconnectTimer);
      disconnectTimer = undefined;
    };
    const stopWaitingForDecision = () => {
      waitingForDecision = false;
      if (confirmationTimer) clearTimeout(confirmationTimer);
      clearDisconnectTimer();
    };
    const lockFailure = (reason: IHwkErrorPayload) => {
      if (failureLocked) return;
      failure = reason;
      failureLocked = true;
      stopWaitingForDecision();
      closePrompt?.();
    };

    let killTimer: ReturnType<typeof setTimeout> | undefined;
    let completionTimer: ReturnType<typeof setTimeout> | undefined;
    const timer = setTimeout(() => {
      lockFailure({
        code: HardwareErrorCode.BlePairingTimeout,
        message: `BLE pairing timed out after ${PAIR_TIMEOUT_MS}ms`,
        params: { phase: 'pairing', timedOut: true },
      });
      // Decline first, kill second: only a live helper can complete the WinRT
      // deferral, and that is what makes Windows tell the device the pairing
      // failed instead of leaving it to notice a dead peer.
      child.stdin?.write('cancel\n', (error) => {
        if (error) child.kill();
      });
      killTimer = setTimeout(() => child.kill(), PAIR_DECLINE_GRACE_MS);
    }, PAIR_TIMEOUT_MS);

    // Cancel goes through stdin, not kill(): only a live helper can decline the
    // request, which is what makes Windows send the device an SMP Pairing Failed.
    registerDecide?.((decision) => {
      if (settled || failureLocked) return;
      stopWaitingForDecision();
      if (decision === 'cancel') {
        lockFailure({
          code: HardwareErrorCode.BlePairingCancelled,
          message: 'BLE pairing declined by user',
          params: { phase: 'pairing' },
        });
      } else {
        // The deadline covers the user, not WinRT: PairAsync can take a while after
        // Accept, and killing it then would report a confirmed pairing as failed.
        // It still needs an end though — the helper only bounds waiting for us.
        clearTimeout(timer);
        completionTimer = setTimeout(() => {
          lockFailure({
            code: HardwareErrorCode.BlePairingTimeout,
            message: `BLE pairing did not complete ${PAIR_COMPLETION_TIMEOUT_MS}ms after confirmation`,
            params: { phase: 'pairing', timedOut: true },
          });
          child.kill();
        }, PAIR_COMPLETION_TIMEOUT_MS);
      }
      child.stdin?.write(`${decision}\n`, (error) => {
        if (!error) return;
        logger.warn(
          `[BlePair] failed to send '${decision}' to helper: ${error.message}`,
        );
        // Pipe is gone; no clean decline left.
        if (decision === 'cancel') child.kill();
      });
    });

    const settle = (fn: () => void) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (killTimer) clearTimeout(killTimer);
      if (completionTimer) clearTimeout(completionTimer);
      stopWaitingForDecision();
      closePrompt?.();
      fn();
    };

    const expireConfirmation = () => {
      if (settled || failureLocked) return;
      lockFailure({
        code: HardwareErrorCode.BlePairingTimeout,
        message: `BLE pairing confirmation timed out after ${confirmationTimeoutMs}ms`,
        params: {
          phase: 'pairing',
          timedOut: true,
          confirmationTimedOut: true,
        },
      });
      clearTimeout(timer);
      child.stdin?.write('cancel\n', (error) => {
        if (error) child.kill();
      });
      killTimer = setTimeout(() => child.kill(), PAIR_DECLINE_GRACE_MS);
    };

    const endDisconnectedPairing = () => {
      if (settled || failureLocked || !waitingForDecision) return;
      lockFailure({
        code: HardwareErrorCode.BlePairingTimeout,
        message: 'BLE pairing ended because the device disconnected',
        params: { phase: 'pairing', deviceDisconnected: true },
      });
      clearTimeout(timer);
      child.stdin?.write('cancel\n', (error) => {
        if (error) child.kill();
      });
      killTimer = setTimeout(() => child.kill(), PAIR_DECLINE_GRACE_MS);
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
            if (
              event.type === 'pairing' &&
              !failureLocked &&
              !confirmationTimer
            ) {
              waitingForDecision = true;
              confirmationTimer = setTimeout(
                expireConfirmation,
                confirmationTimeoutMs,
              );
            }
            // WinRT can hold its confirmation deferral after a device refusal.
            // Allow transient Trezor link changes to recover, but do not leave
            // an unanswered dialog open for the full pairing timeout offline.
            if (event.type === 'link') {
              if (event.connected) {
                clearDisconnectTimer();
              } else if (waitingForDecision && !failureLocked) {
                if (disconnectGraceMs === 0) {
                  endDisconnectedPairing();
                } else if (!disconnectTimer) {
                  disconnectTimer = setTimeout(
                    endDisconnectedPairing,
                    disconnectGraceMs,
                  );
                }
              }
            }
            // Every helper event is logged, not just failures: `Failed(19)` is
            // opaque, so the surrounding state (address type, bond inventory,
            // link up/down, timings) is what actually explains a failing run.
            if (event.type === 'diag') {
              logger.info(`[BlePair] +${event.t_ms}ms ${event.msg}`);
            } else {
              // The pairing code is a live credential for the few seconds the
              // ceremony lasts — log that it arrived, never its value.
              const logged =
                event.type === 'pairing'
                  ? { type: event.type, pin: '[redacted]' }
                  : event;
              logger.info(
                `[BlePair] +${sinceSpawn()}ms event ${JSON.stringify(logged)}`,
              );
            }
            if (event.type === 'pairing-result') {
              if (event.status === 0 || event.status === 3) {
                stopWaitingForDecision();
                closePrompt?.();
              } else {
                lockFailure(
                  helperFailure(
                    `pairing failed with status DevicePairingResultStatus(${event.status})`,
                  ),
                );
              }
            }
            if (event.type === 'error' && !failureLocked) {
              lockFailure(helperFailure(event.message));
            }
            if (event.type === 'paired' || event.type === 'already-paired') {
              stopWaitingForDecision();
              closePrompt?.();
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
      settle(() =>
        reject(
          createHwkError({
            code: HardwareErrorCode.BleConnectFailed,
            message: `BLE pairing helper failed to run: ${err.message}`,
          }),
        ),
      );
    });

    child.on('exit', (code) => {
      settle(() => {
        logger.info(
          `[BlePair] exit code=${code ?? 'null'} after ${sinceSpawn()}ms`,
        );
        if (code === 0 && !failureLocked) {
          resolve(events);
        } else {
          reject(
            createHwkError(
              failure ?? {
                code: HardwareErrorCode.BleConnectFailed,
                message: `helper exited with code ${code ?? 'unknown'}`,
              },
            ),
          );
        }
      });
    });
  });
}

/** The host's half of the BLE numeric comparison. */
export type IPairDecision = 'confirm' | 'cancel';

// Only `pair` registers here. The token identifies which ceremony a decision is
// answering: a dialog left open by an earlier attempt must not answer a later one,
// and an earlier attempt settling must not clear the callback of a later one.
export type IPairCeremonyToken = number;
let ceremonySeq = 0;
let activeCeremony: {
  token: IPairCeremonyToken;
  decide: (decision: IPairDecision) => void;
} | null = null;

/**
 * Answer the in-flight OS pairing ceremony. Returns false when none is waiting,
 * or when `token` belongs to a ceremony that has already settled.
 */
export function decideActivePairing(
  decision: IPairDecision,
  token?: IPairCeremonyToken,
): boolean {
  const current = activeCeremony;
  if (!current) return false;
  if (token !== undefined && token !== current.token) return false;
  current.decide(decision);
  return true;
}

/**
 * Pair `address` (a colon/dash BLE MAC) at the OS level, streaming the
 * numeric-comparison pin to `onPin` so the UI can show it. Resolves once the
 * device is paired (or already paired); rejects on error/timeout.
 * The prompt signal aborts when confirmation ends, independently of helper cleanup.
 *
 * Returns which of the two it was: a fresh bond briefly stops the device from
 * advertising, an existing one does not, and only the caller knows whether that
 * matters.
 */
export async function ensureDevicePaired(
  address: string,
  onPin: (pin: string, signal: AbortSignal) => void,
  keepLink = false,
  onCeremonyToken?: (token: IPairCeremonyToken) => void,
  options?: { confirmationTimeoutMs?: number; disconnectGraceMs?: number },
): Promise<'paired' | 'already-paired'> {
  const prompt = new AbortController();
  let ownToken: IPairCeremonyToken | undefined;
  const args = ['pair', '--address', address];
  if (keepLink) {
    // Leave the BLE link up after bonding instead of closing it — the other half
    // of the "who is holding the device" experiment.
    args.push('--keep-link');
  }
  const events = await runHelper(
    args,
    (event) => {
      if (event.type === 'pairing' && !prompt.signal.aborted) {
        onPin(event.pin, prompt.signal);
      }
    },
    (decide) => {
      ceremonySeq += 1;
      const token = ceremonySeq;
      ownToken = token;
      activeCeremony = { token, decide };
      onCeremonyToken?.(token);
    },
    // Invalidate the UI as soon as the request ends, before helper cleanup exits.
    () => prompt.abort(),
    options?.confirmationTimeoutMs,
    options?.disconnectGraceMs,
  ).finally(() => {
    prompt.abort();
    if (activeCeremony?.token === ownToken) {
      activeCeremony = null;
    }
  });
  if (events.some((e) => e.type === 'paired')) {
    return 'paired';
  }
  if (events.some((e) => e.type === 'already-paired')) {
    return 'already-paired';
  }
  throw createHwkError({
    code: HardwareErrorCode.BlePairingTimeout,
    message: 'BLE pairing did not complete',
    params: { phase: 'pairing' },
  });
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
