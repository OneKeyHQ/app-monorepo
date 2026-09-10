/* eslint-disable onekey/no-raw-error -- isolated synthetic storage verification */
import loadBenchmark, { runStorageBenchmark } from 'onekey-zcash-benchmark';
import loadRuntime, {
  closeWallet,
  deleteWallet,
  diagDatabaseHealth,
  init,
  openWallet,
  storageRequiresWorkerRestart,
  storageStats,
} from 'onekey-zcash-runtime';

let fault = '';
let crash = false;
let failFlush = false;
let acquisitions = 0;
let databaseWrites = 0;
let runtimeLoaded = false;
const access = FileSystemSyncAccessHandle.prototype;
const originalWrite = access.write;
const originalRead = access.read;
const originalFlush = access.flush;
const originalCreate = FileSystemFileHandle.prototype.createSyncAccessHandle;

FileSystemFileHandle.prototype.createSyncAccessHandle =
  function createHandle() {
    acquisitions += 1;
    if (fault === 'init' && acquisitions === 3) {
      fault = '';
      return Promise.reject(
        new DOMException('injected acquisition failure', 'UnknownError'),
      );
    }
    return originalCreate.call(this);
  };

function filename(handle) {
  const header = new Uint8Array(512);
  originalRead.call(handle, header, { at: 0 });
  return new TextDecoder().decode(header).split('\0')[0];
}

access.write = function write(data, options) {
  const bytes = new Uint8Array(
    data.buffer || data,
    data.byteOffset || 0,
    data.byteLength,
  );
  const deletingJournal =
    options?.at === 0 &&
    bytes[0] === 0 &&
    (filename(this).endsWith('-journal') ||
      (fault === 'deleteMetadata' && filename(this).endsWith('.db')));
  if (deletingJournal && (fault === 'metadata' || fault === 'deleteMetadata')) {
    failFlush = true;
    fault = '';
  }
  const written = originalWrite.call(this, data, options);
  if (deletingJournal && fault === 'shortWrite') {
    fault = '';
    return written - 1;
  }
  if (crash && options?.at >= 4096 && filename(this).endsWith('.db')) {
    databaseWrites += 1;
  }
  if (crash && databaseWrites === 8) {
    crash = false;
    postMessage({ crashPoint: true, at: options.at });
    // Interrupt inside the SQLite write callback, before it can commit or
    // unwind. Only the parent can terminate this isolated synthetic Worker.
    for (;;) {
      /* intentional fault injection */
    }
  }
  return written;
};

access.flush = function flush() {
  if (failFlush) {
    failFlush = false;
    throw new DOMException('injected metadata flush failure', 'UnknownError');
  }
  return originalFlush.call(this);
};

onmessage = async ({ data }) => {
  fault = data.fault || '';
  crash = Boolean(data.crash);
  acquisitions = 0;
  databaseWrites = 0;
  try {
    if (data.runtime) {
      await loadRuntime();
      runtimeLoaded = true;
      await init();
      if (data.runtime === 'hold') {
        postMessage({ holding: true });
        for (;;) {
          /* intentional busy-owner handoff */
        }
      }
      if (data.fault === 'metadata') fault = '';
      await openWallet('test', 'zcash-storage-probe.db');
      const first = JSON.parse(storageStats());
      const second = JSON.parse(storageStats());
      closeWallet();
      await openWallet('test', 'zcash-storage-probe.db');
      const health = JSON.parse(diagDatabaseHealth());
      closeWallet();
      if (data.fault === 'metadata') {
        fault = 'deleteMetadata';
        await deleteWallet('zcash-storage-probe.db');
      }
      postMessage({
        ok: true,
        result: { first, second, health },
        requiresWorkerRestart: storageRequiresWorkerRestart(),
      });
      return;
    }
    await loadBenchmark();
    const result = await runStorageBenchmark(JSON.stringify(data.request));
    postMessage({ ok: true, result: JSON.parse(result) });
  } catch (error) {
    // WASM stacks embed the data URL; report only the structured error fields.
    postMessage({
      ok: false,
      error: {
        message: error?.message,
        code: error?.code,
        params: error?.params,
        detail: error?.detail,
      },
      requiresWorkerRestart: runtimeLoaded && storageRequiresWorkerRestart(),
    });
  }
};
