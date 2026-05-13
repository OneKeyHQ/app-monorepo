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

function isPidAlive(pid) {
  if (!Number.isFinite(pid) || pid <= 0) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
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
  let acquired = false;

  while (!acquired) {
    try {
      fs.mkdirSync(path.dirname(lockDir), { recursive: true });
      fs.mkdirSync(lockDir, { recursive: false });
      fs.writeFileSync(
        path.join(lockDir, 'owner.json'),
        `${JSON.stringify(
          {
            pid: process.pid,
            name,
            startedAt: new Date().toISOString(),
          },
          null,
          2,
        )}\n`,
      );
      acquired = true;
      break;
    } catch (error) {
      if (error?.code !== 'EEXIST') throw error;

      const info = readLockInfo(lockDir);
      const lockAgeMs = info?.startedAt
        ? Date.now() - new Date(info.startedAt).getTime()
        : staleMs + 1;
      const stale =
        lockAgeMs > staleMs ||
        (Number.isFinite(info?.pid) && !isPidAlive(info.pid));
      if (stale) {
        fs.rmSync(lockDir, { recursive: true, force: true });
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
    fs.rmSync(lockDir, { recursive: true, force: true });
    log(`released build lock "${name}"`);
  }
}

module.exports = {
  withBuildLock,
};
