import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';

import { ZCASH_SDK_METHODS } from '../types/methods';

import type { IZcashSdkApi } from '../types/sdk';

// Shared Worker entry for every carrier. Hosts the implementation -- wasm,
// wallet database, scan loop -- so none of it runs on the window thread.
//
// Web/desktop/extensions load this entry by URL. Mobile web-embed bundles the
// same entry through zcashSdkInline.worker.js for file-backed WKWebView pages.
//
// Protocol: { id, method, args } in; { id, ok, result | error } out. Errors
// cross as plain objects because structured clone keeps only name/message/
// stack on an Error -- the runtime's structured fields (code, params, payload)
// would silently vanish, and the UI would degrade to bare error names.

// Mirrors the host bridge serializer's field list (JsBridgeBase.toPlainError)
// plus the runtime's flat fields, so `readZcashRuntimeError` works unchanged
// on the far side.
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

const scope = globalThis as unknown as {
  onmessage: ((event: MessageEvent) => void) | null;
  postMessage: (message: unknown) => void;
};

const methodSet = new Set<string>(ZCASH_SDK_METHODS);

let apiPromise: Promise<IZcashSdkApi> | undefined;
let storageRequiresWorkerRestart = () => false;
async function getApi(): Promise<IZcashSdkApi> {
  if (!apiPromise) {
    // Eager bundling keeps the inline Worker self-contained. Initialization
    // remains deferred until the first call, and failed loads can be retried.
    apiPromise = import(/* webpackMode: "eager" */ '../impl')
      .then((m) => {
        storageRequiresWorkerRestart = m.storageRequiresWorkerRestart;
        return m.default.getZcashApi();
      })
      .catch((error) => {
        apiPromise = undefined;
        throw error;
      });
  }
  return apiPromise;
}

scope.onmessage = (event: MessageEvent) => {
  const { id, method, args } = event.data as {
    id: number;
    method: string;
    args: unknown[];
  };
  void (async () => {
    try {
      if (
        method === 'runRuntimeSelfTest' &&
        (args[0] as { stage?: string } | undefined)?.stage === 'worker'
      ) {
        scope.postMessage({ id, ok: true, result: { stage: 'worker' } });
        return;
      }
      if (method === 'ping') {
        scope.postMessage({ id, ok: true, result: 'pong' });
        return;
      }
      if (!methodSet.has(method)) {
        throw new OneKeyLocalError(`zcash worker: unknown method ${method}`);
      }
      const api = await getApi();
      if (storageRequiresWorkerRestart()) {
        throw new OneKeyLocalError('zcash worker: storage failed');
      }
      const fn = api[method as keyof IZcashSdkApi] as (
        ...a: unknown[]
      ) => unknown;
      const result = await fn(...args);
      scope.postMessage({
        id,
        ok: true,
        result,
        requiresWorkerRestart: storageRequiresWorkerRestart(),
      });
    } catch (e) {
      scope.postMessage({
        id,
        ok: false,
        error: toPlainError(e),
        requiresWorkerRestart: storageRequiresWorkerRestart(),
      });
    }
  })();
};
