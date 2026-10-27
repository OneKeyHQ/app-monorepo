import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import type {
  IFetchStreamRequest,
  IFetchStreamRequester,
  IFetchStreamResult,
} from '@onekeyhq/shared/types/fetchStream';

/**
 * Worker transport shared by every client-scanning chain. A failed Worker rejects
 * its calls and never retries, replays or falls back to the page thread: replaying
 * a call with an unknown outcome can turn one broadcast into two.
 */

const DEFAULT_HANDSHAKE_TIMEOUT_MS = 15_000;

/**
 * Tags a carrier failure (Worker never answered, crashed or was torn down).
 * Kept in `data`, which every carrier bridge forwards.
 */
export type IPrivacyChainRuntimeFailure =
  | 'handshake'
  | 'crashed'
  | 'invalidResponse'
  | 'reset'
  | 'trapped'
  | 'storage';

function runtimeFailureError(
  message: string,
  failure: IPrivacyChainRuntimeFailure,
): OneKeyLocalError {
  return new OneKeyLocalError({
    message,
    data: { privacyChainRuntimeFailure: failure },
  });
}

export function getPrivacyChainRuntimeFailure(
  error: unknown,
): IPrivacyChainRuntimeFailure | undefined {
  if (typeof error !== 'object' || error === null) return undefined;
  const data = (error as { data?: unknown }).data;
  if (typeof data !== 'object' || data === null) return undefined;
  const failure = (data as { privacyChainRuntimeFailure?: unknown })
    .privacyChainRuntimeFailure;
  return typeof failure === 'string'
    ? (failure as IPrivacyChainRuntimeFailure)
    : undefined;
}

type IPendingCall = {
  resolve: (result: unknown) => void;
  reject: (error: Error) => void;
};

type IWorkerState = {
  worker: Worker;
  pending: Map<number, IPendingCall>;
  ready: Promise<void>;
  disposed: boolean;
  hostStreams: Set<string>;
};

export type IPrivacyChainWorkerClient<TApi> = {
  api: TApi;
  ensureReady: () => Promise<void>;
  /** Tears down a wedged carrier; runs outside the Worker, which cannot reset itself mid wasm call. */
  reset: () => void;
};

/**
 * Performs one network request on the Worker's behalf. The Worker's own fetch obeys
 * CORS and mixed content, which most nodes fail, so the host relays instead.
 */
export type IPrivacyChainHostRequest = (
  url: string,
  contentType: string,
  body: Uint8Array,
) => Promise<Uint8Array>;

export function createPrivacyChainWorkerClient<TApi>(options: {
  label: string;
  methods: readonly string[];
  createWorker: () => Worker;
  /** Omitted: the runtime keeps fetching inside wasm, reaching only browser-serving nodes. */
  hostRequest?: IPrivacyChainHostRequest;
  hostStreamRequest?: IFetchStreamRequester;
  /** Cheap method used to prove the Worker booted. */
  handshakeMethod?: string;
  handshakeTimeoutMs?: number;
}): IPrivacyChainWorkerClient<TApi> {
  const {
    label,
    methods,
    createWorker,
    handshakeMethod = 'ping',
    handshakeTimeoutMs = DEFAULT_HANDSHAKE_TIMEOUT_MS,
    hostRequest,
    hostStreamRequest,
  } = options;

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
    for (const id of current.hostStreams) {
      void hostStreamRequest?.({ action: 'cancel', id }).catch(() => undefined);
    }
    current.hostStreams.clear();
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
    return new Promise((resolve, reject) => {
      current.pending.set(id, { resolve, reject });
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
        callWorker(current, handshakeMethod, [
          {
            hostRequest: Boolean(hostRequest),
            hostStreamRequest: Boolean(hostStreamRequest),
          },
        ]),
        new Promise<void>((_, reject) => {
          timer = setTimeout(() => {
            reject(
              runtimeFailureError(
                `${label} worker: handshake timed out`,
                'handshake',
              ),
            );
          }, handshakeTimeoutMs);
        }),
      ]);
    } catch (error) {
      dispose(
        current,
        runtimeFailureError(`${label} worker: handshake failed`, 'handshake'),
      );
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
        // Ask the browser not to evict OPFS (iOS ITP, low disk); Workers
        // cannot call persist() themselves.
        void navigator.storage?.persist?.().catch(() => undefined);
        return createWorker();
      })(),
      pending: new Map(),
      ready: Promise.resolve(),
      disposed: false,
      hostStreams: new Set(),
    };
    current.worker.onmessage = (event: MessageEvent) => {
      const streamAsk = event.data as {
        type?: string;
        requestId?: number;
        request?: IFetchStreamRequest;
      };
      if (streamAsk.type === 'host-stream-request' && streamAsk.request) {
        const request = streamAsk.request;
        void (async () => {
          let result: IFetchStreamResult;
          try {
            if (!hostStreamRequest)
              throw new OneKeyLocalError('host stream channel unavailable');
            result = await hostStreamRequest(request);
            if (result.ok && 'response' in result) {
              if (current.disposed) {
                await hostStreamRequest({
                  action: 'cancel',
                  id: result.response.id,
                });
                return;
              }
              current.hostStreams.add(result.response.id);
            } else if (
              request.action !== 'open' &&
              (!result.ok ||
                request.action === 'cancel' ||
                ('chunk' in result && result.chunk.done))
            ) {
              current.hostStreams.delete(request.id);
            }
          } catch (error) {
            if (request.action !== 'open') {
              current.hostStreams.delete(request.id);
              if (request.action === 'read') {
                void hostStreamRequest?.({
                  action: 'cancel',
                  id: request.id,
                }).catch(() => undefined);
              }
            }
            result = {
              ok: false,
              error: error instanceof Error ? error.message : String(error),
            };
          }
          if (!current.disposed)
            current.worker.postMessage({
              type: 'host-stream-response',
              requestId: streamAsk.requestId,
              result,
            });
        })();
        return;
      }
      const ask = event.data as {
        type?: string;
        requestId?: number;
        url?: string;
        contentType?: string;
        body?: Uint8Array;
      };
      if (ask?.type === 'host-request') {
        const reply = (payload: Record<string, unknown>) =>
          current.worker.postMessage({
            type: 'host-response',
            requestId: ask.requestId,
            ...payload,
          });
        if (!hostRequest) {
          reply({
            ok: false,
            error: `${label} worker: this carrier installed no host fetch`,
          });
          return;
        }
        void hostRequest(
          ask.url ?? '',
          ask.contentType ?? '',
          ask.body ?? new Uint8Array(),
        )
          .then((bytes) => reply({ ok: true, bytes }))
          .catch((e: unknown) =>
            reply({
              ok: false,
              error: e instanceof Error ? e.message : String(e),
            }),
          );
        return;
      }

      const {
        id,
        ok,
        result,
        error,
        requiresWorkerRestart,
        workerRestartReason,
      } = event.data as {
        id: number;
        ok: boolean;
        result?: unknown;
        error?: Record<string, unknown>;
        requiresWorkerRestart?: boolean;
        workerRestartReason?: 'trapped';
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
          String(error?.message ?? `${label} worker: call failed`),
        );
        Object.assign(workerError, error);
        if (requiresWorkerRestart && workerRestartReason === 'trapped') {
          const originalData = error?.data;
          workerError.data = {
            ...(typeof originalData === 'object' && originalData !== null
              ? originalData
              : {}),
            privacyChainRuntimeFailure: 'trapped',
          };
        }
        pending.reject(workerError);
      }
      if (requiresWorkerRestart) {
        // Keep this call's result (even an uncertain broadcast outcome), but
        // never let a poisoned runtime serve another request.
        const failure =
          workerRestartReason === 'trapped' ? 'trapped' : 'storage';
        dispose(
          current,
          runtimeFailureError(
            `${label} worker: ${failure === 'trapped' ? 'wasm trapped' : 'storage failed'}`,
            failure,
          ),
        );
      }
    };
    current.worker.onerror = (event) => {
      dispose(
        current,
        runtimeFailureError(
          event?.message
            ? `${label} worker: crashed: ${event.message}`
            : `${label} worker: crashed`,
          'crashed',
        ),
      );
    };
    current.worker.onmessageerror = () => {
      dispose(
        current,
        runtimeFailureError(
          `${label} worker: invalid response`,
          'invalidResponse',
        ),
      );
    };
    state = current;
    current.ready = handshake(current);
    return current;
  }

  const forward =
    (method: string) =>
    async (...args: unknown[]) => {
      const current = getWorkerState();
      await current.ready;
      if (state !== current) {
        // Torn down while this call waited; the replacement Worker lacks the state the caller assumed.
        throw runtimeFailureError(`${label} worker: carrier reset`, 'reset');
      }
      return callWorker(current, method, args);
    };

  const api: Record<string, unknown> = {};
  for (const method of methods) {
    api[method] = forward(method);
  }

  return {
    api: api as TApi,
    ensureReady: async () => {
      await getWorkerState().ready;
    },
    reset: () => {
      if (state) {
        dispose(
          state,
          runtimeFailureError(`${label} worker: carrier reset`, 'reset'),
        );
      }
    },
  };
}

/** Forwards every declared method to `getTarget()`, resolved per call because the target can be recreated. */
export function createPrivacyChainRemoteProxy<TApi>(
  methods: readonly string[],
  getTarget: () => TApi | Promise<TApi>,
): TApi {
  const api: Record<string, unknown> = {};
  for (const method of methods) {
    api[method] = async (...args: unknown[]) => {
      const target = (await getTarget()) as Record<string, unknown>;
      return (target[method] as (...a: unknown[]) => unknown)(...args);
    };
  }
  return api as TApi;
}

/** Worker-side half of the transport; protocol: `{ id, method, args }` in, `{ id, ok, result | error }` out. */

/** Errors cross as plain objects: structured clone keeps only name/message/stack of an `Error`. */
const ERROR_FIELDS = [
  'name',
  'message',
  'code',
  'data',
  'info',
  'key',
  'className',
  'payload',
  'autoToast',
  'stack',
  'params',
  'detail',
] as const;

function toPlainError(e: unknown): Record<string, unknown> {
  if (!(e instanceof Object)) {
    return { message: String(e) };
  }
  const src = e as Record<string, unknown>;
  const out: Record<string, unknown> = {
    message: e instanceof Error ? e.message : String(e),
  };
  for (const f of ERROR_FIELDS) {
    if (src[f] !== undefined) {
      out[f] = src[f];
    }
  }
  return out;
}

/** Backstop for a relayed node request: hosts time out after 30s of silence, this catches one that never answers. */
export const PRIVACY_CHAIN_HOST_REQUEST_TIMEOUT_MS = 10 * 60 * 1000;

export function createWorkerHostRequester(
  label: string,
  timeoutMs = PRIVACY_CHAIN_HOST_REQUEST_TIMEOUT_MS,
) {
  const scope = globalThis as unknown as {
    postMessage: (message: unknown) => void;
    addEventListener: (type: string, fn: (event: MessageEvent) => void) => void;
  };
  const pending = new Map<
    number,
    { resolve: (b: Uint8Array) => void; reject: (e: Error) => void }
  >();
  let nextId = 1;

  scope.addEventListener('message', (event: MessageEvent) => {
    const data = event.data as {
      type?: string;
      requestId?: number;
      ok?: boolean;
      bytes?: Uint8Array;
      error?: string;
    };
    if (data?.type !== 'host-response') return;
    const waiter = pending.get(data.requestId ?? -1);
    if (!waiter) return;
    pending.delete(data.requestId ?? -1);
    if (data.ok && data.bytes) {
      waiter.resolve(new Uint8Array(data.bytes));
    } else {
      waiter.reject(
        new Error(data.error ?? `${label} worker: host fetch failed`),
      );
    }
  });

  return async (url: string, contentType: string, body: Uint8Array) => {
    const requestId = nextId;
    nextId += 1;
    return new Promise<Uint8Array>((resolve, reject) => {
      const timer = setTimeout(() => {
        if (pending.delete(requestId)) {
          reject(
            new Error(
              `${label} worker: host fetch timed out after ${timeoutMs}ms (${url})`,
            ),
          );
        }
      }, timeoutMs);
      pending.set(requestId, {
        resolve: (bytes) => {
          clearTimeout(timer);
          resolve(bytes);
        },
        reject: (error) => {
          clearTimeout(timer);
          reject(error);
        },
      });
      scope.postMessage({
        type: 'host-request',
        requestId,
        url,
        contentType,
        body,
      });
    });
  };
}

// Set by the client's handshake; false on carriers with no relay (web, mobile web-embed).
let carrierHasHostRequest = false;
let carrierHasHostStreamRequest = false;

export function workerCarrierHasHostStreamRequest(): boolean {
  return carrierHasHostStreamRequest;
}

export function workerCarrierHasHostRequest(): boolean {
  return carrierHasHostRequest;
}

type IWorkerRuntimeState = {
  label: string;
  trapped: boolean;
};

let workerRuntimeState: IWorkerRuntimeState | undefined;

export async function runPrivacyChainWorkerOperation<T>(
  operation: () => T | Promise<T>,
): Promise<T> {
  const current = workerRuntimeState;
  if (current?.trapped) {
    throw runtimeFailureError(
      `${current.label} worker: wasm trapped`,
      'trapped',
    );
  }
  try {
    return await operation();
  } catch (error) {
    if (current && error instanceof WebAssembly.RuntimeError) {
      // Latch before an internal execution queue can release its next call.
      current.trapped = true;
    }
    throw error;
  }
}

export function servePrivacyChainWorker<TApi extends object>(options: {
  label: string;
  methods: readonly string[];
  loadApi: () => Promise<TApi>;
  /** True once storage has failed unrecoverably; the client retires the Worker but still delivers the finished call's result. */
  storageRequiresRestart?: () => boolean;
  /** Answers a call without loading the implementation (return `undefined` to fall through). */
  intercept?: (
    method: string,
    args: unknown[],
  ) => { result: unknown } | undefined;
}): void {
  const {
    label,
    methods,
    loadApi,
    storageRequiresRestart = () => false,
    intercept,
  } = options;

  const scope = globalThis as unknown as {
    onmessage: ((event: MessageEvent) => void) | null;
    postMessage: (message: unknown) => void;
  };
  const methodSet = new Set<string>(methods);

  let apiPromise: Promise<TApi> | undefined;
  const runtimeState: IWorkerRuntimeState = { label, trapped: false };
  workerRuntimeState = runtimeState;
  const getApi = async (): Promise<TApi> => {
    if (!apiPromise) {
      apiPromise = loadApi().catch((error) => {
        // Do not cache a failure: a transient load error must not disable the chain.
        apiPromise = undefined;
        throw error;
      });
    }
    return apiPromise;
  };

  scope.onmessage = (event: MessageEvent) => {
    // Replies to our own host-fetch requests belong to the requester's
    // listener; they are not calls for us to dispatch.
    if (
      ['host-response', 'host-stream-response'].includes(
        (event.data as { type?: string })?.type ?? '',
      )
    ) {
      return;
    }
    const { id, method, args } = event.data as {
      id: number;
      method: string;
      args: unknown[];
    };
    void (async () => {
      try {
        const intercepted = intercept?.(method, args);
        if (intercepted) {
          scope.postMessage({ id, ok: true, result: intercepted.result });
          return;
        }
        if (method === 'ping') {
          carrierHasHostRequest =
            (args?.[0] as { hostRequest?: boolean } | undefined)
              ?.hostRequest === true;
          carrierHasHostStreamRequest =
            (args?.[0] as { hostStreamRequest?: boolean } | undefined)
              ?.hostStreamRequest === true;
          scope.postMessage({ id, ok: true, result: 'pong' });
          return;
        }
        if (!methodSet.has(method)) {
          throw new OneKeyLocalError(
            `${label} worker: unknown method ${method}`,
          );
        }
        const api = await runPrivacyChainWorkerOperation(getApi);
        // Block queued exports before the host has time to terminate us.
        if (runtimeState.trapped) {
          throw new OneKeyLocalError(`${label} worker: wasm trapped`);
        }
        if (storageRequiresRestart()) {
          throw new OneKeyLocalError(`${label} worker: storage failed`);
        }
        const fn = (api as Record<string, unknown>)[method] as (
          ...a: unknown[]
        ) => unknown;
        const result = await runPrivacyChainWorkerOperation(() =>
          fn.apply(api, args),
        );
        scope.postMessage({
          id,
          ok: true,
          result,
          requiresWorkerRestart:
            runtimeState.trapped || storageRequiresRestart(),
          workerRestartReason: runtimeState.trapped ? 'trapped' : undefined,
        });
      } catch (e) {
        runtimeState.trapped ||= e instanceof WebAssembly.RuntimeError;
        scope.postMessage({
          id,
          ok: false,
          error: toPlainError(e),
          requiresWorkerRestart:
            runtimeState.trapped || storageRequiresRestart(),
          workerRestartReason: runtimeState.trapped ? 'trapped' : undefined,
        });
      }
    })();
  };
}

/** Worker-side JSON stream requests; each pull has its own bounded wait. */
export function createWorkerHostStreamRequester(
  timeoutMs = 45_000,
): IFetchStreamRequester {
  const scope = globalThis as unknown as {
    postMessage: (message: unknown) => void;
    addEventListener: (
      type: string,
      listener: (event: MessageEvent) => void,
    ) => void;
  };
  let nextId = 1;
  const pending = new Map<number, (result: IFetchStreamResult) => void>();
  scope.addEventListener('message', (event: MessageEvent) => {
    const data = event.data as {
      type?: string;
      requestId: number;
      result: IFetchStreamResult;
    };
    if (data.type !== 'host-stream-response') return;
    const resolve = pending.get(data.requestId);
    if (resolve) {
      pending.delete(data.requestId);
      resolve(data.result);
    } else if (data.result.ok && 'response' in data.result) {
      // A caller timed out before headers arrived; release the late stream.
      void requester({ action: 'cancel', id: data.result.response.id }).catch(
        () => undefined,
      );
    }
  });
  async function requester(
    request: IFetchStreamRequest,
  ): Promise<IFetchStreamResult> {
    return new Promise((resolve) => {
      const requestId = nextId;
      nextId += 1;
      const timer = setTimeout(() => {
        pending.delete(requestId);
        resolve({ ok: false, error: 'fetch stream host timed out' });
      }, timeoutMs);
      pending.set(requestId, (result) => {
        clearTimeout(timer);
        resolve(result);
      });
      scope.postMessage({ type: 'host-stream-request', requestId, request });
    });
  }
  return requester;
}
