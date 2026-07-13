import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { LOCK_TIMEOUT_MS } from '../constants';
import { LockError, acquireVaultLock } from '../lock';

const tempDirs: string[] = [];

async function pathExists(filePath: string): Promise<boolean> {
  try {
    await fs.stat(filePath);
    return true;
  } catch {
    return false;
  }
}

async function createLockPaths() {
  const vaultDir = await fs.mkdtemp(path.join(os.tmpdir(), 'ok-vault-lock-'));
  tempDirs.push(vaultDir);
  const vaultFile = path.join(vaultDir, 'vault.enc');
  const vaultLock = `${vaultFile}.lock`;
  return { vaultDir, vaultFile, vaultLock };
}

function createLockedError(): Error {
  return Object.assign(new Error('locked'), { code: 'ELOCKED' });
}

afterEach(async () => {
  await Promise.all(
    tempDirs.splice(0).map((dir) =>
      fs.rm(dir, {
        recursive: true,
        force: true,
      }),
    ),
  );
});

describe('vault lock', () => {
  it('acquires and releases a single-process lock', async () => {
    const paths = await createLockPaths();

    const release = await acquireVaultLock(paths);
    expect(await pathExists(paths.vaultLock)).toBe(true);

    await release();
    expect(await pathExists(paths.vaultLock)).toBe(false);
  });

  it('serializes competition until the first holder releases', async () => {
    const paths = await createLockPaths();
    let held = false;
    const releaseFirstRef: { current?: () => Promise<void> } = {};
    let now = 0;
    const lock = jest.fn(async () => {
      if (held) {
        throw createLockedError();
      }
      held = true;
      return async () => {
        held = false;
      };
    });
    const wait = jest.fn(async (ms: number) => {
      now += ms;
      await releaseFirstRef.current?.();
    });

    releaseFirstRef.current = await acquireVaultLock({
      ...paths,
      lock,
      now: () => now,
      sleep: wait,
    });
    const releaseSecond = await acquireVaultLock({
      ...paths,
      lock,
      now: () => now,
      sleep: wait,
    });

    expect(wait).toHaveBeenCalledTimes(1);
    expect(lock).toHaveBeenCalledTimes(3);
    await releaseSecond();
  });

  it('fails secure with LOCK_TIMEOUT after 5s total wait', async () => {
    const paths = await createLockPaths();
    let now = 0;
    const lock = jest.fn(async () => {
      throw createLockedError();
    });
    const wait = jest.fn(async (ms: number) => {
      now += ms;
    });

    await expect(
      acquireVaultLock({ ...paths, lock, now: () => now, sleep: wait }),
    ).rejects.toBeInstanceOf(LockError);
    await expect(
      acquireVaultLock({ ...paths, lock, now: () => now, sleep: wait }),
    ).rejects.toMatchObject({ code: 'LOCK_TIMEOUT' });
  });

  it('steals stale lock directories left by dead processes', async () => {
    const paths = await createLockPaths();
    await fs.mkdir(paths.vaultLock, { recursive: true });
    const staleTime = new Date(Date.now() - 60_000);
    await fs.utimes(paths.vaultLock, staleTime, staleTime);

    const release = await acquireVaultLock(paths);

    expect(await pathExists(paths.vaultLock)).toBe(true);
    await release();
  });

  it('deletes the lock file on release', async () => {
    const paths = await createLockPaths();
    const release = await acquireVaultLock(paths);

    await release();

    expect(await pathExists(paths.vaultLock)).toBe(false);
  });

  it('prevents accidental reentry by timing out while the lock is held', async () => {
    const paths = await createLockPaths();
    const release = await acquireVaultLock(paths);
    let now = 0;
    const wait = jest.fn(async (ms: number) => {
      now += ms;
    });

    await expect(
      acquireVaultLock({ ...paths, now: () => now, sleep: wait }),
    ).rejects.toMatchObject({ code: 'LOCK_TIMEOUT' });

    await release();
  });

  it('times out while waiting for an in-process holder', async () => {
    const paths = await createLockPaths();
    const releaseFirst = await acquireVaultLock(paths);
    jest.useFakeTimers();

    try {
      const acquireSecond = acquireVaultLock(paths);
      const acquireSecondError = acquireSecond.catch((error: unknown) => error);

      await jest.advanceTimersByTimeAsync(LOCK_TIMEOUT_MS);
      await expect(acquireSecondError).resolves.toMatchObject({
        code: 'LOCK_TIMEOUT',
      });
    } finally {
      jest.useRealTimers();
      await releaseFirst();
    }

    const releaseThird = await acquireVaultLock(paths);
    await releaseThird();
  });
});
