import type { IStorageBenchmarkWorkerRequest } from './storageBenchmarkWorker';
import type {
  IZcashStorageBenchmarkAssertion,
  IZcashStorageBenchmarkBackend,
  IZcashStorageBenchmarkBackendResult,
  IZcashStorageBenchmarkCase,
  IZcashStorageBenchmarkPhaseError,
  IZcashStorageBenchmarkPreset,
  IZcashStorageBenchmarkResult,
  IZcashStorageBenchmarkRuntimeResult,
} from '../types/sdk';

const DATABASE_PREFIX = 'onekey-zcash-storage-bench-';
const BACKENDS = ['relaxedIdb', 'opfsSahpool'] as const;
const DATA_TEST_CASES = [
  'crud',
  'reopen',
  'crashRecovery',
  'concurrentAccess',
  'largeDatabase',
] as const satisfies readonly IZcashStorageBenchmarkCase[];

type IWorkload = {
  rowCount: number;
  payloadBytes: number;
  batchSize: number;
  settleMs: number;
};

const WORKLOADS: Record<
  IZcashStorageBenchmarkPreset,
  Record<(typeof DATA_TEST_CASES)[number], IWorkload>
> = {
  quick: {
    crud: { rowCount: 512, payloadBytes: 1024, batchSize: 64, settleMs: 750 },
    reopen: {
      rowCount: 1024,
      payloadBytes: 1024,
      batchSize: 64,
      settleMs: 750,
    },
    crashRecovery: {
      rowCount: 512,
      payloadBytes: 1024,
      batchSize: 64,
      settleMs: 0,
    },
    concurrentAccess: {
      rowCount: 256,
      payloadBytes: 1024,
      batchSize: 32,
      settleMs: 750,
    },
    largeDatabase: {
      rowCount: 2048,
      payloadBytes: 2048,
      batchSize: 64,
      settleMs: 1000,
    },
  },
  stress: {
    crud: {
      rowCount: 4096,
      payloadBytes: 2048,
      batchSize: 128,
      settleMs: 1500,
    },
    reopen: {
      rowCount: 4096,
      payloadBytes: 4096,
      batchSize: 128,
      settleMs: 1500,
    },
    crashRecovery: {
      rowCount: 2048,
      payloadBytes: 2048,
      batchSize: 64,
      settleMs: 0,
    },
    concurrentAccess: {
      rowCount: 1024,
      payloadBytes: 2048,
      batchSize: 64,
      settleMs: 1500,
    },
    largeDatabase: {
      rowCount: 8192,
      payloadBytes: 4096,
      batchSize: 128,
      settleMs: 2000,
    },
  },
};

type IPendingCall = {
  resolve: (result: IZcashStorageBenchmarkRuntimeResult) => void;
  reject: (error: Error) => void;
  timer: ReturnType<typeof setTimeout>;
};

class StorageBenchmarkWorkerClient {
  private readonly worker: Worker;

  private nextId = 1;

  private readonly pending = new Map<number, IPendingCall>();

  constructor() {
    this.worker = new Worker(
      new URL('./storageBenchmarkWorker.ts', import.meta.url),
    );
    this.worker.onmessage = (event: MessageEvent) => {
      const { id, ok, result, error } = event.data as {
        id: number;
        ok: boolean;
        result?: IZcashStorageBenchmarkRuntimeResult;
        error?: Record<string, unknown>;
      };
      const pending = this.pending.get(id);
      if (!pending) {
        return;
      }
      clearTimeout(pending.timer);
      this.pending.delete(id);
      if (ok && result) {
        pending.resolve(result);
        return;
      }
      const workerError = new Error(
        String(error?.message ?? 'Storage benchmark worker failed'),
      );
      Object.assign(workerError, error);
      pending.reject(workerError);
    };
    this.worker.onerror = (event) => {
      this.rejectAll(
        new Error(event.message || 'Storage benchmark worker crashed'),
      );
    };
  }

  run(
    benchmarkRequest: IStorageBenchmarkWorkerRequest,
  ): Promise<IZcashStorageBenchmarkRuntimeResult> {
    const id = this.nextId;
    this.nextId += 1;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(
        () => {
          this.pending.delete(id);
          reject(
            new Error('Storage benchmark phase timed out after 5 minutes'),
          );
        },
        5 * 60 * 1000,
      );
      this.pending.set(id, { resolve, reject, timer });
      this.worker.postMessage({ id, request: benchmarkRequest });
    });
  }

  terminate(): void {
    this.rejectAll(new Error('Storage benchmark worker terminated'));
    this.worker.terminate();
  }

  private rejectAll(error: Error): void {
    for (const pending of this.pending.values()) {
      clearTimeout(pending.timer);
      pending.reject(error);
    }
    this.pending.clear();
  }
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function databaseName(
  testCase: (typeof DATA_TEST_CASES)[number],
  preset: IZcashStorageBenchmarkPreset,
): string {
  return `${DATABASE_PREFIX}${testCase.toLowerCase()}-${preset}.db`;
}

function allDatabaseNames(): string[] {
  return (['quick', 'stress'] as const).flatMap((preset) =>
    DATA_TEST_CASES.map((testCase) => databaseName(testCase, preset)),
  );
}

function request(
  backend: IZcashStorageBenchmarkBackend,
  action: IStorageBenchmarkWorkerRequest['action'],
  name: string,
  workload?: IWorkload,
  writerId = 0,
): IStorageBenchmarkWorkerRequest {
  return {
    backend,
    action,
    databaseName: name,
    rowCount: workload?.rowCount ?? 0,
    payloadBytes: workload?.payloadBytes ?? 1024,
    batchSize: workload?.batchSize ?? 64,
    writerId,
  };
}

function phaseError(error: unknown): IZcashStorageBenchmarkPhaseError {
  if (!(error instanceof Object)) {
    return {
      error: { name: 'Error', message: String(error) },
    };
  }
  const source = error as Record<string, unknown>;
  return {
    error: {
      name: String(source.name ?? 'Error'),
      message: String(source.message ?? error),
      ...(typeof source.code === 'string' ? { code: source.code } : {}),
      ...(source.params !== undefined ? { params: source.params } : {}),
      ...(typeof source.detail === 'string' ? { detail: source.detail } : {}),
      ...(typeof source.stack === 'string' ? { stack: source.stack } : {}),
    },
  };
}

function assertion(
  name: string,
  passed: boolean,
  expected: string,
  actual: string,
): IZcashStorageBenchmarkAssertion {
  return { name, passed, expected, actual };
}

function healthy(result: IZcashStorageBenchmarkRuntimeResult): boolean {
  return (
    result.integrity?.quickCheckOk === true &&
    result.integrity.foreignKeyViolations === 0 &&
    result.sampleMetrics?.mismatches === 0
  );
}

function sameData(
  before: IZcashStorageBenchmarkRuntimeResult,
  after: IZcashStorageBenchmarkRuntimeResult,
): boolean {
  return (
    before.data?.rowCount === after.data?.rowCount &&
    before.data?.payloadBytes === after.data?.payloadBytes &&
    before.data?.checksumSum === after.data?.checksumSum &&
    before.data?.generationSum === after.data?.generationSum &&
    before.data?.writerCount === after.data?.writerCount
  );
}

async function probeBackend(
  backend: IZcashStorageBenchmarkBackend,
): Promise<IZcashStorageBenchmarkRuntimeResult> {
  let client: StorageBenchmarkWorkerClient | undefined;
  try {
    client = new StorageBenchmarkWorkerClient();
    return await client.run(
      request(backend, 'probe', `${DATABASE_PREFIX}capability.db`),
    );
  } catch (error) {
    const serialized = phaseError(error).error;
    return {
      backend,
      action: 'probe',
      databaseName: `${DATABASE_PREFIX}capability.db`,
      supported: false,
      vfsName: 'unavailable',
      totalMs: 0,
      timingsMs: {},
      memoryBytes: { start: 0, afterAction: 0 },
      error: {
        code: serialized.code ?? 'WORKER_UNAVAILABLE',
        params: {},
        detail: serialized.detail ?? serialized.message,
      },
    };
  } finally {
    client?.terminate();
  }
}

async function cleanupDatabase(
  backend: IZcashStorageBenchmarkBackend,
  name: string,
): Promise<IZcashStorageBenchmarkRuntimeResult> {
  const client = new StorageBenchmarkWorkerClient();
  try {
    return await client.run(request(backend, 'cleanup', name));
  } finally {
    client.terminate();
  }
}

function unsupportedResult(
  backend: IZcashStorageBenchmarkBackend,
  probe: IZcashStorageBenchmarkRuntimeResult,
): IZcashStorageBenchmarkBackendResult {
  return {
    backend,
    status: 'unsupported',
    verdict: 'This carrier cannot install this backend in a dedicated Worker.',
    assertions: [],
    phases: { probe },
  };
}

function failedResult(
  backend: IZcashStorageBenchmarkBackend,
  phases: IZcashStorageBenchmarkBackendResult['phases'],
  error: unknown,
): IZcashStorageBenchmarkBackendResult {
  phases.error = phaseError(error);
  return {
    backend,
    status: 'failed',
    verdict: 'The backend did not complete the test.',
    assertions: [],
    phases,
  };
}

async function runCapability(
  backend: IZcashStorageBenchmarkBackend,
): Promise<IZcashStorageBenchmarkBackendResult> {
  try {
    const probe = await probeBackend(backend);
    if (!probe.supported) {
      return unsupportedResult(backend, probe);
    }
    return {
      backend,
      status: 'passed',
      verdict: 'The backend installed successfully in a dedicated Worker.',
      assertions: [
        assertion('Worker installation', true, 'supported', 'supported'),
      ],
      phases: { probe },
    };
  } catch (error) {
    return failedResult(backend, {}, error);
  }
}

async function runCrud(
  backend: IZcashStorageBenchmarkBackend,
  name: string,
  workload: IWorkload,
): Promise<IZcashStorageBenchmarkBackendResult> {
  const probe = await probeBackend(backend);
  if (!probe.supported) {
    return unsupportedResult(backend, probe);
  }
  const phases: IZcashStorageBenchmarkBackendResult['phases'] = { probe };
  const client = new StorageBenchmarkWorkerClient();
  try {
    phases.replace = await client.run(
      request(backend, 'replace', name, workload),
    );
    const mutated = await client.run(
      request(backend, 'mutate', name, workload),
    );
    phases.mutate = mutated;
    const expectedRows = workload.rowCount - Math.ceil(workload.rowCount / 7);
    const assertions = [
      assertion(
        'SQLite and sampled payload integrity',
        healthy(mutated),
        'quick_check ok, 0 FK violations, 0 sample mismatches',
        JSON.stringify({
          integrity: mutated.integrity,
          sampleMismatches: mutated.sampleMetrics?.mismatches,
        }),
      ),
      assertion(
        'Delete count',
        mutated.data?.rowCount === expectedRows,
        String(expectedRows),
        String(mutated.data?.rowCount),
      ),
    ];
    return {
      backend,
      status: assertions.every((item) => item.passed) ? 'passed' : 'failed',
      verdict: assertions.every((item) => item.passed)
        ? 'Create, batched write, sampled read, update, delete, and integrity checks passed.'
        : 'CRUD completed but one or more correctness checks failed.',
      assertions,
      phases,
    };
  } catch (error) {
    return failedResult(backend, phases, error);
  } finally {
    client.terminate();
    try {
      phases.cleanup = await cleanupDatabase(backend, name);
    } catch (error) {
      phases.cleanupError = phaseError(error);
    }
  }
}

async function runRestartTest({
  backend,
  name,
  workload,
  abrupt,
}: {
  backend: IZcashStorageBenchmarkBackend;
  name: string;
  workload: IWorkload;
  abrupt: boolean;
}): Promise<IZcashStorageBenchmarkBackendResult> {
  const probe = await probeBackend(backend);
  if (!probe.supported) {
    return unsupportedResult(backend, probe);
  }
  const phases: IZcashStorageBenchmarkBackendResult['phases'] = { probe };
  let writer: StorageBenchmarkWorkerClient | undefined;
  let reader: StorageBenchmarkWorkerClient | undefined;
  try {
    await cleanupDatabase(backend, name);
    writer = new StorageBenchmarkWorkerClient();
    const written = await writer.run(
      request(backend, 'replace', name, workload),
    );
    phases.write = written;
    if (!abrupt) {
      await delay(workload.settleMs);
    }
    writer.terminate();
    writer = undefined;

    reader = new StorageBenchmarkWorkerClient();
    const reopened = await reader.run(
      request(backend, 'verify', name, workload),
    );
    phases.reopen = reopened;
    const assertions = [
      assertion(
        'Exact dataset after Worker replacement',
        sameData(written, reopened),
        JSON.stringify(written.data),
        JSON.stringify(reopened.data),
      ),
      assertion(
        'Reopened database integrity',
        healthy(reopened),
        'quick_check ok, 0 FK violations, 0 sample mismatches',
        JSON.stringify({
          integrity: reopened.integrity,
          sampleMismatches: reopened.sampleMetrics?.mismatches,
        }),
      ),
    ];
    const passed = assertions.every((item) => item.passed);
    let verdict = 'The delayed reopen did not reproduce the exact dataset.';
    if (passed) {
      verdict = abrupt
        ? 'All acknowledged rows survived immediate Worker termination.'
        : 'All rows survived the configured settle delay and Worker replacement.';
    } else if (abrupt) {
      verdict =
        'At least one acknowledged write did not survive immediate Worker termination.';
    }
    return {
      backend,
      status: passed ? 'passed' : 'failed',
      verdict,
      assertions,
      phases,
    };
  } catch (error) {
    return failedResult(backend, phases, error);
  } finally {
    writer?.terminate();
    reader?.terminate();
    try {
      phases.cleanup = await cleanupDatabase(backend, name);
    } catch (error) {
      phases.cleanupError = phaseError(error);
    }
  }
}

async function runConcurrentAccess(
  backend: IZcashStorageBenchmarkBackend,
  name: string,
  workload: IWorkload,
): Promise<IZcashStorageBenchmarkBackendResult> {
  const probe = await probeBackend(backend);
  if (!probe.supported) {
    return unsupportedResult(backend, probe);
  }
  const phases: IZcashStorageBenchmarkBackendResult['phases'] = { probe };
  let first: StorageBenchmarkWorkerClient | undefined;
  let second: StorageBenchmarkWorkerClient | undefined;
  let verifier: StorageBenchmarkWorkerClient | undefined;
  let seed: StorageBenchmarkWorkerClient | undefined;
  try {
    const seedWorkload = { ...workload, rowCount: 0 };
    seed = new StorageBenchmarkWorkerClient();
    phases.seed = await seed.run(
      request(backend, 'replace', name, seedWorkload),
    );
    await delay(workload.settleMs);
    seed.terminate();
    seed = undefined;

    first = new StorageBenchmarkWorkerClient();
    second = new StorageBenchmarkWorkerClient();
    const settled = await Promise.allSettled([
      first.run(request(backend, 'append', name, workload, 1)),
      second.run(request(backend, 'append', name, workload, 2)),
    ]);
    let successCount = 0;
    let expectedExclusiveErrorObserved = false;
    settled.forEach((result, index) => {
      const phaseName = index === 0 ? 'writerOne' : 'writerTwo';
      if (result.status === 'fulfilled') {
        successCount += 1;
        phases[phaseName] = result.value;
      } else {
        phases[phaseName] = phaseError(result.reason);
        const errorText = JSON.stringify(phases[phaseName]);
        expectedExclusiveErrorObserved =
          expectedExclusiveErrorObserved ||
          errorText.includes('CreateSyncAccessHandle') ||
          errorText.includes('NoModificationAllowedError');
      }
    });
    await delay(workload.settleMs);
    first.terminate();
    second.terminate();
    first = undefined;
    second = undefined;

    verifier = new StorageBenchmarkWorkerClient();
    const verified = await verifier.run(
      request(backend, 'verify', name, workload),
    );
    phases.verify = verified;

    const exclusiveOwnerObserved =
      backend === 'opfsSahpool' &&
      successCount === 1 &&
      expectedExclusiveErrorObserved;
    const expectedRows = exclusiveOwnerObserved
      ? workload.rowCount
      : workload.rowCount * 2;
    const expectedWriters = exclusiveOwnerObserved ? 1 : 2;
    const assertions = [
      assertion(
        'Concurrent ownership behavior',
        backend === 'opfsSahpool' ? exclusiveOwnerObserved : successCount === 2,
        backend === 'opfsSahpool'
          ? 'exactly one Worker owns OPFS handles'
          : 'both IndexedDB Workers complete',
        `${successCount} writer(s) completed`,
      ),
      assertion(
        'Rows retained after concurrent attempt',
        verified.data?.rowCount === expectedRows &&
          verified.data.writerCount === expectedWriters,
        `${expectedRows} rows from ${expectedWriters} writer(s)`,
        `${verified.data?.rowCount} rows from ${verified.data?.writerCount} writer(s)`,
      ),
      assertion(
        'Database integrity after concurrent attempt',
        healthy(verified),
        'quick_check ok, 0 FK violations, 0 sample mismatches',
        JSON.stringify({
          integrity: verified.integrity,
          sampleMismatches: verified.sampleMetrics?.mismatches,
        }),
      ),
    ];
    const passed = assertions.every((item) => item.passed);
    let verdict =
      'Concurrent access caused an unexpected failure or lost dataset.';
    if (passed) {
      verdict = exclusiveOwnerObserved
        ? 'Exclusive OPFS ownership was enforced and the owner dataset stayed intact.'
        : 'Both concurrent writers completed and both datasets were retained.';
    }
    return {
      backend,
      status: passed ? 'passed' : 'failed',
      verdict,
      assertions,
      phases,
    };
  } catch (error) {
    return failedResult(backend, phases, error);
  } finally {
    seed?.terminate();
    first?.terminate();
    second?.terminate();
    verifier?.terminate();
    try {
      phases.cleanup = await cleanupDatabase(backend, name);
    } catch (error) {
      phases.cleanupError = phaseError(error);
    }
  }
}

async function runCleanup(
  backend: IZcashStorageBenchmarkBackend,
): Promise<IZcashStorageBenchmarkBackendResult> {
  const probe = await probeBackend(backend);
  if (!probe.supported) {
    return unsupportedResult(backend, probe);
  }
  const phases: IZcashStorageBenchmarkBackendResult['phases'] = { probe };
  const client = new StorageBenchmarkWorkerClient();
  try {
    for (const name of allDatabaseNames()) {
      phases[name] = await client.run(request(backend, 'cleanup', name));
    }
    return {
      backend,
      status: 'passed',
      verdict: 'All known benchmark databases are absent.',
      assertions: [
        assertion(
          'Cleanup calls completed',
          true,
          `${allDatabaseNames().length} database names checked`,
          `${allDatabaseNames().length} database names checked`,
        ),
      ],
      phases,
    };
  } catch (error) {
    return failedResult(backend, phases, error);
  } finally {
    client.terminate();
  }
}

async function runBackend({
  backend,
  testCase,
  preset,
}: {
  backend: IZcashStorageBenchmarkBackend;
  testCase: IZcashStorageBenchmarkCase;
  preset: IZcashStorageBenchmarkPreset;
}): Promise<IZcashStorageBenchmarkBackendResult> {
  try {
    if (testCase === 'capability') {
      return await runCapability(backend);
    }
    if (testCase === 'cleanup') {
      return await runCleanup(backend);
    }
    const workload = WORKLOADS[preset][testCase];
    const name = databaseName(testCase, preset);
    if (testCase === 'crud') {
      return await runCrud(backend, name, workload);
    }
    if (testCase === 'reopen') {
      return await runRestartTest({
        backend,
        name,
        workload,
        abrupt: false,
      });
    }
    if (testCase === 'crashRecovery') {
      return await runRestartTest({
        backend,
        name,
        workload,
        abrupt: true,
      });
    }
    if (testCase === 'concurrentAccess') {
      return await runConcurrentAccess(backend, name, workload);
    }
    return await runRestartTest({
      backend,
      name,
      workload,
      abrupt: false,
    });
  } catch (error) {
    return failedResult(backend, {}, error);
  }
}

async function storageSnapshot(): Promise<{
  persisted: boolean | null;
  usageBytes: number | null;
  quotaBytes: number | null;
  error: string | null;
}> {
  try {
    const storage = globalThis.navigator?.storage;
    const persisted =
      typeof storage?.persisted === 'function'
        ? await storage.persisted()
        : null;
    const estimate =
      typeof storage?.estimate === 'function' ? await storage.estimate() : null;
    return {
      persisted,
      usageBytes: estimate?.usage ?? null,
      quotaBytes: estimate?.quota ?? null,
      error: null,
    };
  } catch (error) {
    return {
      persisted: null,
      usageBytes: null,
      quotaBytes: null,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

export async function runStorageBenchmark({
  testCase,
  preset,
}: {
  testCase: IZcashStorageBenchmarkCase;
  preset: IZcashStorageBenchmarkPreset;
}): Promise<IZcashStorageBenchmarkResult> {
  const started = Date.now();
  const before = await storageSnapshot();
  // Run sequentially so write/read throughput is not distorted by two WASM
  // workers competing for CPU and the same origin storage at once.
  const relaxedIdb = await runBackend({
    backend: BACKENDS[0],
    testCase,
    preset,
  });
  const opfsSahpool = await runBackend({
    backend: BACKENDS[1],
    testCase,
    preset,
  });
  const after = await storageSnapshot();
  const name =
    testCase === 'capability' || testCase === 'cleanup'
      ? null
      : databaseName(testCase, preset);
  const workload =
    testCase === 'capability' || testCase === 'cleanup'
      ? null
      : WORKLOADS[preset][testCase];

  return {
    testCase,
    preset,
    databaseName: name,
    isolatedFromWalletData: true,
    execution: {
      runtimeScope: 'dedicated-benchmark-worker',
      storageOwnership: {
        relaxedIdb: 'origin-shared-indexeddb',
        opfsSahpool: 'exclusive-opfs-sync-access-handles',
      },
      origin: globalThis.location?.origin ?? null,
      persisted: after.persisted ?? before.persisted,
      originUsageBeforeBytes: before.usageBytes,
      originUsageAfterBytes: after.usageBytes,
      originQuotaBytes: after.quotaBytes ?? before.quotaBytes,
      storageEstimateError: before.error ?? after.error,
    },
    workload,
    backends: { relaxedIdb, opfsSahpool },
    durationMs: Date.now() - started,
  };
}
