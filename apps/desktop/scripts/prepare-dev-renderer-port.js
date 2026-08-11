const { spawnSync } = require('node:child_process');
const path = require('node:path');

const DEFAULT_PORT = 3001;
const DEFAULT_SHUTDOWN_TIMEOUT_MS = 3000;
const DEFAULT_SHUTDOWN_CHECK_INTERVAL_MS = 100;

class DevRendererPortError extends Error {}

function runLsof(args, spawnSyncImpl = spawnSync) {
  const result = spawnSyncImpl('lsof', args, {
    encoding: 'utf8',
  });

  if (result.error) {
    throw new DevRendererPortError(
      `Unable to inspect renderer port: ${result.error.message}`,
    );
  }

  if (result.status === 1 && !result.stdout.trim()) {
    return '';
  }

  if (result.status !== 0) {
    const details = result.stderr.trim();
    throw new DevRendererPortError(
      `Unable to inspect renderer port with lsof${
        details ? `: ${details}` : ''
      }`,
    );
  }

  return result.stdout;
}

function getListenerPids({ port, spawnSyncImpl = spawnSync }) {
  const output = runLsof(
    ['-nP', '-t', `-iTCP:${port}`, '-sTCP:LISTEN'],
    spawnSyncImpl,
  );

  return [
    ...new Set(
      output
        .split(/\s+/)
        .map((value) => Number(value))
        .filter((value) => Number.isSafeInteger(value) && value > 0),
    ),
  ];
}

function getProcessCwd({ pid, spawnSyncImpl = spawnSync }) {
  const output = runLsof(
    ['-a', '-p', String(pid), '-d', 'cwd', '-Fn'],
    spawnSyncImpl,
  );
  const cwdLine = output.split(/\r?\n/).find((line) => line.startsWith('n'));

  return cwdLine ? cwdLine.slice(1) : null;
}

function isPathInside(candidatePath, parentPath) {
  const relativePath = path.relative(
    path.resolve(parentPath),
    path.resolve(candidatePath),
  );

  return (
    relativePath === '' ||
    (!relativePath.startsWith(`..${path.sep}`) &&
      relativePath !== '..' &&
      !path.isAbsolute(relativePath))
  );
}

function sleep(milliseconds) {
  return new Promise((resolve) => {
    setTimeout(resolve, milliseconds);
  });
}

async function prepareDevRendererPort({
  desktopRoot = path.join(__dirname, '..'),
  getListenerPidsImpl = getListenerPids,
  getProcessCwdImpl = getProcessCwd,
  killProcessImpl = process.kill.bind(process),
  logger = console,
  platform = process.platform,
  port = DEFAULT_PORT,
  shutdownCheckIntervalMs = DEFAULT_SHUTDOWN_CHECK_INTERVAL_MS,
  shutdownTimeoutMs = DEFAULT_SHUTDOWN_TIMEOUT_MS,
  sleepImpl = sleep,
} = {}) {
  if (platform !== 'darwin' && platform !== 'linux') {
    return [];
  }

  const listenerPids = getListenerPidsImpl({ port });
  if (listenerPids.length === 0) {
    return [];
  }

  const ownedListenerPids = [];
  const foreignListeners = [];

  for (const pid of listenerPids) {
    const processCwd = getProcessCwdImpl({ pid });

    if (processCwd && isPathInside(processCwd, desktopRoot)) {
      ownedListenerPids.push(pid);
    } else {
      const currentListenerPids = getListenerPidsImpl({ port });
      if (currentListenerPids.includes(pid)) {
        foreignListeners.push({
          cwd: processCwd ?? 'unknown',
          pid,
        });
      }
    }
  }

  if (foreignListeners.length > 0) {
    const details = foreignListeners
      .map(({ cwd, pid }) => `PID ${pid} (cwd: ${cwd})`)
      .join(', ');
    throw new DevRendererPortError(
      `Port ${port} is in use by a process outside this Desktop project: ${details}`,
    );
  }

  if (ownedListenerPids.length === 0) {
    return [];
  }

  logger.log(
    `[desktop] Releasing renderer port ${port} from previous Desktop process${
      ownedListenerPids.length === 1 ? '' : 'es'
    }: ${ownedListenerPids.join(', ')}`,
  );

  for (const pid of ownedListenerPids) {
    try {
      killProcessImpl(pid, 'SIGTERM');
    } catch (error) {
      if (error.code !== 'ESRCH') {
        throw error;
      }
    }
  }

  const maximumChecks = Math.ceil(shutdownTimeoutMs / shutdownCheckIntervalMs);
  for (let check = 0; check <= maximumChecks; check += 1) {
    if (getListenerPidsImpl({ port }).length === 0) {
      return ownedListenerPids;
    }

    if (check < maximumChecks) {
      await sleepImpl(shutdownCheckIntervalMs);
    }
  }

  throw new DevRendererPortError(
    `Previous Desktop process did not release renderer port ${port} after SIGTERM`,
  );
}

if (require.main === module) {
  prepareDevRendererPort().catch((error) => {
    console.error(`[desktop] ${error.message}`);
    process.exitCode = 1;
  });
}

module.exports = {
  getListenerPids,
  getProcessCwd,
  isPathInside,
  prepareDevRendererPort,
  runLsof,
};
