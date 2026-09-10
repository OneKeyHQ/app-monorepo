/* eslint-disable onekey/no-raw-error -- isolated synthetic storage verification */
import ProbeWorker from './probe.worker';

function call(worker, message) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error('storage probe timeout')),
      30_000,
    );
    worker.onmessage = ({ data }) => {
      clearTimeout(timer);
      resolve(data);
    };
    worker.onerror = (error) => {
      clearTimeout(timer);
      reject(new Error(error.message || 'storage probe Worker error'));
    };
    worker.postMessage(message);
  });
}

async function run() {
  const request = {
    backend: 'opfsSahpool',
    databaseName: 'onekey-zcash-storage-bench-regression.db',
    rowCount: 1000,
    payloadBytes: 1024,
    batchSize: 1000,
  };
  let worker = new ProbeWorker();
  const benchmark = (action, fault = '', crash = false) =>
    call(worker, { request: { ...request, action }, fault, crash });
  const mode =
    globalThis.OPFS_PROBE_MODE ||
    new URLSearchParams(location.search).get('mode');
  try {
    if (mode === 'handoff') {
      const holding = await call(worker, { runtime: 'hold' });
      if (!holding.holding) throw new Error(JSON.stringify(holding));
      worker.terminate();
      worker = new ProbeWorker();
      const started = performance.now();
      const reopened = await call(worker, { runtime: 'check' });
      return {
        mode,
        pass: reopened.ok && !reopened.requiresWorkerRestart,
        handoffMs: performance.now() - started,
        reopened,
      };
    }
    if (mode === 'runtimeFault') {
      const failed = await call(worker, {
        runtime: 'check',
        fault: 'metadata',
      });
      return { mode, pass: !failed.ok && failed.requiresWorkerRestart, failed };
    }
    if (mode === 'metadata' || mode === 'shortWrite') {
      const failedInit = await benchmark('probe', 'init');
      const retry = await benchmark('probe');
      const baseline = await benchmark('replace');
      const failed = await benchmark('mutate', mode);
      const poisoned = await benchmark('verify');
      return {
        mode,
        pass:
          failedInit.result?.supported === false &&
          retry.result?.supported === true &&
          baseline.ok &&
          !failed.ok &&
          !poisoned.ok,
        failedInit,
        retry,
        failed,
        poisoned,
      };
    }
    const baseline = await benchmark('replace');
    if (!baseline.ok) throw new Error(JSON.stringify(baseline));
    const interrupted = await benchmark('mutate', '', true);
    if (!interrupted.crashPoint)
      throw new Error('did not interrupt a database page write');
    worker.terminate();
    // Chromium forcefully terminates a busy Worker after two seconds. This
    // benchmark deliberately bypasses the wallet's bounded ownership retry.
    await new Promise((resolve) => setTimeout(resolve, 3000));
    worker = new ProbeWorker();
    const recovered = await benchmark('verify');
    return {
      mode,
      pass:
        recovered.ok &&
        JSON.stringify(baseline.result.data) ===
          JSON.stringify(recovered.result.data) &&
        recovered.result.integrity.quickCheckOk,
      interrupted,
      baseline: baseline.result.data,
      recovered,
    };
  } finally {
    worker.terminate();
  }
}

globalThis.result = run().catch((error) => ({
  pass: false,
  error: String(error),
}));
