import fs from 'node:fs/promises';

import * as properLockfile from 'proper-lockfile';

import { LOCK_TIMEOUT_MS } from './constants';
import { VAULT_DIR, VAULT_FILE, VAULT_LOCK } from './paths';

export const properLockfileInlineSentinel = properLockfile;

export type IVaultLockRelease = () => Promise<void>;

export type ILockErrorCode = 'LOCK_TIMEOUT';

export class LockError extends Error {
  constructor(readonly code: ILockErrorCode) {
    super(code);
    this.name = 'LockError';
  }
}

type IAcquireVaultLockOptions = {
  vaultDir?: string;
  vaultFile?: string;
  vaultLock?: string;
  lock?: typeof properLockfile.lock;
  now?: () => number;
  sleep?: (ms: number) => Promise<void>;
};

const inProcessLockQueues = new Map<string, Promise<void>>();

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

async function acquireInProcessTurn(
  vaultLock: string,
  timeoutMs: number,
): Promise<() => void> {
  const previous = inProcessLockQueues.get(vaultLock) ?? Promise.resolve();
  let releaseCurrent: (() => void) | undefined;
  let markCurrentStarted: (() => void) | undefined;
  let rejectCurrentStarted: ((error: unknown) => void) | undefined;
  let canceled = false;
  let currentAcquired = false;
  const currentStarted = new Promise<void>((resolve, reject) => {
    markCurrentStarted = resolve;
    rejectCurrentStarted = reject;
  });
  const current = previous
    .catch(() => undefined)
    .then(
      () =>
        new Promise<void>((resolve) => {
          releaseCurrent = resolve;
          currentAcquired = true;
          if (canceled) {
            resolve();
            return;
          }
          markCurrentStarted?.();
        }),
    );

  const cleanupCurrent = () => {
    void current.finally(() => {
      if (inProcessLockQueues.get(vaultLock) === current) {
        inProcessLockQueues.delete(vaultLock);
      }
    });
  };

  inProcessLockQueues.set(vaultLock, current);
  const timeout = setTimeout(() => {
    canceled = true;
    if (currentAcquired) {
      releaseCurrent?.();
    }
    rejectCurrentStarted?.(new LockError('LOCK_TIMEOUT'));
    cleanupCurrent();
  }, timeoutMs);

  try {
    await currentStarted;
  } finally {
    clearTimeout(timeout);
  }

  let released = false;
  return () => {
    if (released) {
      return;
    }
    released = true;
    releaseCurrent?.();
    cleanupCurrent();
  };
}

export async function acquireVaultLock(
  options: IAcquireVaultLockOptions = {},
): Promise<IVaultLockRelease> {
  const vaultDir = options.vaultDir ?? VAULT_DIR;
  const vaultFile = options.vaultFile ?? VAULT_FILE;
  const vaultLock = options.vaultLock ?? VAULT_LOCK;
  const lock = options.lock ?? properLockfile.lock;
  const now = options.now ?? Date.now;
  const wait = options.sleep ?? sleep;
  const deadline = now() + LOCK_TIMEOUT_MS;
  let retryDelayMs = 5;
  const shouldUseInProcessQueue =
    options.lock === undefined &&
    options.now === undefined &&
    options.sleep === undefined;
  const inProcessTimeoutMs = deadline - now();
  const releaseInProcessTurn = shouldUseInProcessQueue
    ? await acquireInProcessTurn(vaultLock, inProcessTimeoutMs)
    : undefined;

  try {
    await fs.mkdir(vaultDir, { recursive: true });

    while (now() <= deadline) {
      try {
        const release = await lock(vaultFile, {
          realpath: false,
          lockfilePath: vaultLock,
          stale: LOCK_TIMEOUT_MS,
          update: Math.max(1000, Math.floor(LOCK_TIMEOUT_MS / 2)),
          retries: 0,
        });

        let released = false;
        return async () => {
          if (released) {
            return;
          }
          released = true;
          try {
            await release();
          } finally {
            releaseInProcessTurn?.();
          }
        };
      } catch {
        const remainingMs = deadline - now();
        if (remainingMs <= 0) {
          break;
        }
        const delayMs = Math.min(retryDelayMs, remainingMs);
        await wait(delayMs);
        retryDelayMs = Math.min(retryDelayMs * 2, 50);
      }
    }
  } catch (error) {
    releaseInProcessTurn?.();
    throw error;
  }

  releaseInProcessTurn?.();
  throw new LockError('LOCK_TIMEOUT');
}
