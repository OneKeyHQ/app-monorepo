import { ensureWebembedApiProxyAvailable } from '@onekeyhq/shared/src/utils/assertUtils';

import { ZCASH_SDK_METHODS } from '../types/methods';

import { createZcashSdkProxy } from './createSdkProxy';

import type {
  IEnsureSDKReady,
  IGetZcashApi,
  IZcashSdk,
  IZcashSdkApi,
} from '../types/sdk';

// iOS/Android: the background is Hermes and cannot run wasm, so calls go to the
// web-embed WebView, which hosts the same implementation as every other carrier.
//
// Sync used to be a no-op here because WebZjs needed a thread pool and a system
// WebView is never crossOriginIsolated. This runtime is single-threaded; a run
// on a real Pixel 4 scanned with crossOriginIsolated false.
//
// The remaining mobile constraint is the origin, not the capability: under
// file:// the WebView refuses to import ES modules at all, so the web-embed has
// to be served from a virtual https origin for this to work.
const ensureSDKReady: IEnsureSDKReady = async () => Promise.resolve(true);

// ---- temporary debug logging: every wasm call that crosses to the WebView ----
//
// Logs on the bg side because the WebView console is invisible on iOS. A call
// logged as started but never as finished is the one in flight when the
// process died. Never logs argument or result values: keys, lengths, and a
// few non-secret scalars only.
const LOG_PREFIX = '[ZEC-WASM]';
const SAFE_SCALAR_KEYS = new Set([
  'hdIndex',
  'network',
  'chainTip',
  'birthdayHeight',
  'synced',
  'stateChanged',
  'fullyScanned',
  'backfillRemaining',
  'transparentCurrent',
  'enabled',
  'scan',
  'balance',
  'history',
  'spend',
]);

function stringifyLogValue(value: unknown) {
  try {
    return JSON.stringify(value);
  } catch (error) {
    return JSON.stringify({
      stringifyError: error instanceof Error ? error.message : String(error),
    });
  }
}

function summarizeValue(value: unknown): unknown {
  if (value === null || value === undefined) return value;
  if (typeof value === 'number' || typeof value === 'boolean') return value;
  if (typeof value === 'string') return `str(${value.length})`;
  if (Array.isArray(value)) return `array(${value.length})`;
  if (typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (SAFE_SCALAR_KEYS.has(k) && (typeof v !== 'object' || v === null)) {
        out[k] = v;
      } else {
        out[k] = Array.isArray(v) ? `array(${v.length})` : typeof v;
      }
    }
    return out;
  }
  return typeof value;
}

function debugZcashWasmLog(label: string, value?: unknown) {
  if (process.env.NODE_ENV === 'production') {
    return;
  }
  const valueText = value === undefined ? '' : ` ${stringifyLogValue(value)}`;
  // eslint-disable-next-line no-console
  console.log(`${LOG_PREFIX} ${label}${valueText}`);
}

let callSeq = 0;
let inFlight = 0;

function wrapWithCallLogging(target: IZcashSdkApi, method: string) {
  return async (...args: unknown[]) => {
    callSeq += 1;
    const id = callSeq;
    inFlight += 1;
    const startedAt = Date.now();
    debugZcashWasmLog(`-> #${id} ${method}`, {
      inFlight,
      args: args.map(summarizeValue),
    });
    try {
      const result = await (
        (target as unknown as Record<string, unknown>)[method] as (
          ...a: unknown[]
        ) => Promise<unknown>
      )(...args);
      debugZcashWasmLog(`<- #${id} ${method} ok`, {
        ms: Date.now() - startedAt,
        result: summarizeValue(result),
      });
      return result;
    } catch (error) {
      debugZcashWasmLog(`xx #${id} ${method} error`, {
        ms: Date.now() - startedAt,
        message: error instanceof Error ? error.message : String(error),
        code:
          typeof error === 'object' && error !== null && 'code' in error
            ? (error as { code: unknown }).code
            : undefined,
      });
      throw error;
    } finally {
      inFlight -= 1;
    }
  };
}

function withCallLogging(target: IZcashSdkApi): IZcashSdkApi {
  const wrapped = {} as Record<string, unknown>;
  for (const method of ZCASH_SDK_METHODS) {
    wrapped[method] = wrapWithCallLogging(target, method);
  }
  return wrapped as IZcashSdkApi;
}

const api = withCallLogging(
  createZcashSdkProxy(() => ensureWebembedApiProxyAvailable().chainZcash),
);

const getZcashApi: IGetZcashApi = async () => Promise.resolve(api);

const sdk: IZcashSdk = { getZcashApi, ensureSDKReady };
export default sdk;
