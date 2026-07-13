function childIsRunning(child) {
  return Boolean(
    child && child.pid && child.exitCode === null && child.signalCode === null,
  );
}

function closeCodeToExitCode(code) {
  return code === null || code === undefined ? 2 : code;
}

function sendSignal(child, signal, { killProcessGroup = false } = {}) {
  if (!childIsRunning(child)) return;

  const childPid = child.pid;
  if (killProcessGroup && typeof childPid === 'number') {
    try {
      process.kill(0 - childPid, signal);
      return;
    } catch {
      // Fall back to the direct child below if the process group is already gone.
    }
  }

  try {
    child.kill(signal);
  } catch {
    // The process may have exited between the running check and the signal.
  }
}

function waitForClose(child, timeoutMs = 5000) {
  if (!childIsRunning(child)) return Promise.resolve(true);

  return new Promise((resolve) => {
    let settled = false;
    let timer = null;
    const onClose = () => {
      if (settled) return;
      settled = true;
      if (timer) clearTimeout(timer);
      resolve(true);
    };

    if (timeoutMs > 0) {
      timer = setTimeout(() => {
        if (settled) return;
        settled = true;
        child.off('close', onClose);
        resolve(false);
      }, timeoutMs);
    }

    child.once('close', onClose);
  });
}

async function stopChild(
  child,
  {
    signal = 'SIGTERM',
    killSignal = 'SIGKILL',
    timeoutMs = 5000,
    killProcessGroup = false,
  } = {},
) {
  if (!childIsRunning(child)) return true;

  sendSignal(child, signal, { killProcessGroup });
  const closed = await waitForClose(child, timeoutMs);
  if (closed) return true;

  sendSignal(child, killSignal, { killProcessGroup });
  return waitForClose(child, 2000);
}

module.exports = {
  childIsRunning,
  closeCodeToExitCode,
  sendSignal,
  stopChild,
  waitForClose,
};
