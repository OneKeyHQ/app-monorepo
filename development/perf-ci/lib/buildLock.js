const fs = require('fs');
const os = require('os');
const path = require('path');

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getLockDir(name) {
  const safeName = String(name || 'default').replace(/[^a-zA-Z0-9._-]/g, '_');
  const baseDir =
    process.env.PERF_BUILD_LOCK_DIR ||
    path.join(os.tmpdir(), 'onekey-perf-locks');
  return path.join(baseDir, `${safeName}.lock`);
}

function readLockInfo(lockDir) {
  try {
    return JSON.parse(
      fs.readFileSync(path.join(lockDir, 'owner.json'), 'utf8'),
    );
  } catch {
    return null;
  }
}

function readLockSnapshot(lockDir) {
  try {
    const stat = fs.statSync(lockDir);
    return {
      info: readLockInfo(lockDir),
      mtimeMs: stat.mtimeMs,
    };
  } catch {
    return null;
  }
}

function isPidAlive(pid) {
  if (!Number.isFinite(pid) || pid <= 0) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

function createLockOwner(name) {
  return {
    pid: process.pid,
    name,
    startedAt: new Date().toISOString(),
    token: `${process.pid}-${Date.now()}-${Math.random()
      .toString(16)
      .slice(2)}`,
  };
}

function lockInfoMatches(current, expected) {
  if (!current || !expected) return current === expected;
  if (current.token || expected.token) {
    return Boolean(
      current.token && expected.token && current.token === expected.token,
    );
  }
  return (
    current.pid === expected.pid &&
    current.name === expected.name &&
    current.startedAt === expected.startedAt
  );
}

function lockSnapshotMatches(current, expected) {
  if (!current || !expected) return false;
  if (current.info?.token || expected.info?.token) {
    return lockInfoMatches(current.info, expected.info);
  }
  if (!current.info || !expected.info) {
    return (
      current.info === expected.info && current.mtimeMs === expected.mtimeMs
    );
  }
  return lockInfoMatches(current.info, expected.info);
}

function removeLockDirIfOwner(lockDir, expectedSnapshot) {
  const current = readLockSnapshot(lockDir);
  if (!lockSnapshotMatches(current, expectedSnapshot)) return false;
  fs.rmSync(lockDir, { recursive: true, force: true });
  return true;
}

async function withBuildLock(name, fn, options = {}) {
  const lockDir = getLockDir(name);
  const staleMs =
    Number(process.env.PERF_BUILD_LOCK_STALE_MS) ||
    options.staleMs ||
    2 * 60 * 60 * 1000;
  const timeoutMs =
    Number(process.env.PERF_BUILD_LOCK_TIMEOUT_MS) ||
    options.timeoutMs ||
    90 * 60 * 1000;
  const pollMs =
    Number(process.env.PERF_BUILD_LOCK_POLL_MS) || options.pollMs || 1000;
  const log = options.log || (() => {});
  const startedAt = Date.now();
  let ownerSnapshot = null;
  let acquired = false;

  while (!acquired) {
    try {
      fs.mkdirSync(path.dirname(lockDir), { recursive: true });
      fs.mkdirSync(lockDir, { recursive: false });
      const ownerInfo = createLockOwner(name);
      fs.writeFileSync(
        path.join(lockDir, 'owner.json'),
        `${JSON.stringify(ownerInfo, null, 2)}\n`,
      );
      ownerSnapshot = { info: ownerInfo };
      acquired = true;
      break;
    } catch (error) {
      if (error?.code !== 'EEXIST') throw error;

      const snapshot = readLockSnapshot(lockDir);
      const info = snapshot?.info || null;
      let lockAgeMs = staleMs + 1;
      if (info?.startedAt) {
        lockAgeMs = Date.now() - new Date(info.startedAt).getTime();
      } else if (snapshot?.mtimeMs) {
        lockAgeMs = Date.now() - snapshot.mtimeMs;
      }
      const stale =
        lockAgeMs > staleMs ||
        (Number.isFinite(info?.pid) && !isPidAlive(info.pid));
      if (stale) {
        if (removeLockDirIfOwner(lockDir, snapshot)) {
          log(`removed stale build lock "${name}"`, info || {});
        } else {
          log(`stale build lock "${name}" changed before removal`, info || {});
        }
      } else {
        if (Date.now() - startedAt > timeoutMs) {
          throw new Error(
            `Timeout waiting for perf build lock "${name}" (lockDir=${lockDir})`,
            { cause: error },
          );
        }

        log(`waiting for build lock "${name}"`, info || {});
        // eslint-disable-next-line no-await-in-loop
        await sleep(pollMs);
      }
    }
  }

  try {
    log(`acquired build lock "${name}"`);
    return await fn();
  } finally {
    if (removeLockDirIfOwner(lockDir, ownerSnapshot)) {
      log(`released build lock "${name}"`);
    } else {
      log(`build lock "${name}" changed before release; skip removal`);
    }
  }
}

module.exports = {
  withBuildLock,
};
