import type {
  IZcashStorageBenchmarkBackend,
  IZcashStorageBenchmarkRuntimeResult,
} from '../types/sdk';

type IBenchmarkAction = IZcashStorageBenchmarkRuntimeResult['action'];

export type IStorageBenchmarkWorkerRequest = {
  backend: IZcashStorageBenchmarkBackend;
  action: IBenchmarkAction;
  databaseName: string;
  rowCount?: number;
  payloadBytes?: number;
  batchSize?: number;
  writerId?: number;
};

type IWorkerMessage = {
  id: number;
  request: IStorageBenchmarkWorkerRequest;
};

const ERROR_FIELDS = [
  'name',
  'message',
  'code',
  'params',
  'detail',
  'stack',
] as const;

function toPlainError(error: unknown): Record<string, unknown> {
  if (!(error instanceof Object)) {
    return { name: 'Error', message: String(error) };
  }
  const source = error as Record<string, unknown>;
  const output: Record<string, unknown> = {
    name: error instanceof Error ? error.name : 'Error',
    message: error instanceof Error ? error.message : String(error),
  };
  for (const field of ERROR_FIELDS) {
    if (source[field] !== undefined) {
      output[field] = source[field];
    }
  }
  return output;
}

type IRuntimeModule =
  typeof import('onekey-zcash-runtime/storage-benchmark/onekey_zcash_storage_benchmark.js');

let runtimePromise: Promise<IRuntimeModule> | undefined;

async function getRuntime(): Promise<IRuntimeModule> {
  if (!runtimePromise) {
    runtimePromise =
      import('onekey-zcash-runtime/storage-benchmark/onekey_zcash_storage_benchmark.js').then(
        async (runtime) => {
          await runtime.default();
          return runtime;
        },
      );
  }
  return runtimePromise;
}

const scope = globalThis as unknown as {
  onmessage: ((event: MessageEvent<IWorkerMessage>) => void) | null;
  postMessage: (message: unknown) => void;
};

scope.onmessage = (event: MessageEvent<IWorkerMessage>) => {
  const { id, request } = event.data;
  void (async () => {
    try {
      const runtime = await getRuntime();
      const raw = await runtime.runStorageBenchmark(JSON.stringify(request));
      scope.postMessage({
        id,
        ok: true,
        result: JSON.parse(raw) as IZcashStorageBenchmarkRuntimeResult,
      });
    } catch (error) {
      scope.postMessage({ id, ok: false, error: toPlainError(error) });
    }
  })();
};
