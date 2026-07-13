const { spawn } = require('child_process');

const { closeCodeToExitCode, stopChild } = require('./processTree');

function stopTimeoutMs() {
  return Number(process.env.PERF_JOB_STOP_TIMEOUT_MS) || 30_000;
}

function runReleaseJob({ repoRoot, script, args, env }) {
  const child = spawn(process.execPath, [script, ...args], {
    cwd: repoRoot,
    env: {
      ...process.env,
      ...env,
    },
    stdio: 'inherit',
    detached: true,
  });

  let stopping = false;
  const onStop = async () => {
    if (stopping) return;
    stopping = true;
    const stopped = await stopChild(child, {
      signal: 'SIGINT',
      killSignal: 'SIGKILL',
      timeoutMs: stopTimeoutMs(),
      killProcessGroup: true,
    });
    process.exit(stopped ? 0 : 2);
  };

  process.once('SIGINT', onStop);
  process.once('SIGTERM', onStop);

  child.on('error', (error) => {
    // eslint-disable-next-line no-console
    console.error(error?.stack || error?.message || String(error));
    process.exit(2);
  });

  child.on('close', (code) => {
    if (stopping) return;
    process.exit(closeCodeToExitCode(code));
  });
}

module.exports = {
  runReleaseJob,
};
