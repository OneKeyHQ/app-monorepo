import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import {
  privacyChainPerfLog,
  summarizeResultSize,
} from '@onekeyhq/shared/src/utils/privacyChainPerfLog';

import { ZCASH_SDK_METHODS } from '../types/methods';

import createZcashWorker from './createZcashWorker';

import type { IZcashSdkApi } from '../types/sdk';

const HANDSHAKE_TIMEOUT_MS = 15_000;

type IPendingCall = {
  resolve: (result: unknown) => void;
  reject: (error: Error) => void;
};

type IWorkerState = {
  worker: Worker;
  pending: Map<number, IPendingCall>;
  ready: Promise<void>;
  disposed: boolean;
};

let state: IWorkerState | undefined;
let nextCallId = 1;

function dispose(current: IWorkerState, error: Error): void {
  if (current.disposed) {
    return;
  }
  current.disposed = true;
  if (state === current) {
    state = undefined;
  }
  current.worker.onmessage = null;
  current.worker.onerror = null;
  current.worker.onmessageerror = null;
  current.worker.terminate();
  for (const pending of current.pending.values()) {
    pending.reject(error);
  }
  current.pending.clear();
}

function callWorker(
  current: IWorkerState,
  method: string,
  args: unknown[],
): Promise<unknown> {
  const id = nextCallId;
  nextCallId += 1;
  const startedAt = Date.now();
  return new Promise((resolve, reject) => {
    current.pending.set(id, {
      resolve: (result) => {
        privacyChainPerfLog(`worker ${method}`, {
          id,
          ms: Date.now() - startedAt,
          ...summarizeResultSize(result),
        });
        resolve(result);
      },
      reject,
    });
    try {
      current.worker.postMessage({ id, method, args });
    } catch (error) {
      current.pending.delete(id);
      reject(error);
    }
  });
}

async function handshake(current: IWorkerState): Promise<void> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    await Promise.race([
      callWorker(current, 'ping', []),
      new Promise<void>((_, reject) => {
        timer = setTimeout(() => {
          reject(new OneKeyLocalError('zcash worker: handshake timed out'));
        }, HANDSHAKE_TIMEOUT_MS);
      }),
    ]);
  } catch (error) {
    dispose(current, new OneKeyLocalError('zcash worker: handshake failed'));
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

function getWorkerState(): IWorkerState {
  if (state) {
    return state;
  }
  const current: IWorkerState = {
    worker: (() => {
      // OPFS lives under the host origin's quota; ask the browser not to
      // evict it (iOS ITP, low-disk). Workers cannot call persist() themselves.
      void navigator.storage?.persist?.().catch(() => undefined);
      return createZcashWorker();
    })(),
    pending: new Map(),
    ready: Promise.resolve(),
    disposed: false,
  };
  current.worker.onmessage = (event: MessageEvent) => {
    const { id, ok, result, error, requiresWorkerRestart } = event.data as {
      id: number;
      ok: boolean;
      result?: unknown;
      error?: Record<string, unknown>;
      requiresWorkerRestart?: boolean;
    };
    const pending = current.pending.get(id);
    if (!pending) {
      return;
    }
    current.pending.delete(id);
    if (ok) {
      pending.resolve(result);
    } else {
      const workerError = new OneKeyLocalError(
        String(error?.message ?? 'zcash worker: call failed'),
      );
      Object.assign(workerError, error);
      pending.reject(workerError);
    }
    if (requiresWorkerRestart) {
      // Keep the completed call's result, including an uncertain broadcast
      // outcome, but never let a poisoned database serve another request.
      dispose(current, new OneKeyLocalError('zcash worker: storage failed'));
    }
  };
  current.worker.onerror = (event) => {
    dispose(
      current,
      new OneKeyLocalError(
        event?.message
          ? `zcash worker: crashed: ${event.message}`
          : 'zcash worker: crashed',
      ),
    );
  };
  current.worker.onmessageerror = () => {
    dispose(current, new OneKeyLocalError('zcash worker: invalid response'));
  };
  state = current;
  current.ready = handshake(current);
  return current;
}

// Every browser carrier uses this transport. A failed Worker rejects calls;
// it never replays a transaction or switches to execution on the page thread.
const methods: Record<string, unknown> = {};
function createWorkerMethod(method: string) {
  return async (...args: unknown[]) => {
    const current = getWorkerState();
    await current.ready;
    if (state !== current) {
      throw new OneKeyLocalError('zcash worker: carrier reset');
    }
    return callWorker(current, method, args);
  };
}
for (const method of ZCASH_SDK_METHODS) {
  methods[method] = createWorkerMethod(method);
}

export const workerApi = methods as IZcashSdkApi;

// Reset must run outside the Worker: a stuck synchronous WASM call cannot
// receive another message. Storage initialization waits for asynchronous
// browser handle release before acquiring the next owner.
workerApi.resetCarrier = async () => {
  if (state) {
    dispose(state, new OneKeyLocalError('zcash worker: carrier reset'));
  }
};

export async function ensureWorkerReady(): Promise<void> {
  await getWorkerState().ready;
}
