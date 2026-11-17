/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import { IInjectedProviderNames } from '@onekeyfe/cross-inpage-provider-types';
import {
  isArray,
  isBoolean,
  isEmpty,
  isNil,
  isNull,
  isNumber,
  isPlainObject,
  isString,
  isUndefined,
} from 'lodash';

import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import { memoizee } from '@onekeyhq/shared/src/utils/cacheUtils';

import {
  IMPL_ADA,
  IMPL_ALGO,
  IMPL_ALPH,
  IMPL_APTOS,
  IMPL_BFC,
  IMPL_BTC,
  IMPL_CFX,
  IMPL_COSMOS,
  IMPL_DOT,
  IMPL_EVM,
  IMPL_LIGHTNING,
  IMPL_LIGHTNING_TESTNET,
  IMPL_NEAR,
  IMPL_NEO,
  IMPL_NOSTR,
  IMPL_SCDO,
  IMPL_SOL,
  IMPL_STELLAR,
  IMPL_SUI,
  IMPL_TBTC,
  IMPL_TON,
  IMPL_TRON,
} from '../engine/engineConsts';
import { NotAutoPrintError } from '../errors';
import errorUtils from '../errors/utils/errorUtils';
import platformEnv from '../platformEnv';

import type { OneKeyError } from '../errors';
import type { IInjectedProviderNamesStrings } from '@onekeyfe/cross-inpage-provider-types';
import type { Method } from 'axios';

export function throwCrossError(msg: string, ...args: any) {
  if (platformEnv.isNative) {
    // `throw new OneKeyLocalError()` won't print error object in iOS/Android,
    //    so we print it manually by `console.error()`
    console.error(msg, ...args);
  }
  throw new OneKeyLocalError(msg);
}

export function isSerializable(obj: any) {
  if (
    isUndefined(obj) ||
    isNull(obj) ||
    isBoolean(obj) ||
    isNumber(obj) ||
    isString(obj) ||
    obj instanceof Error
  ) {
    return true;
  }

  if (!isPlainObject(obj) && !isArray(obj)) {
    // like regex, date
    return false;
  }

  // eslint-disable-next-line no-restricted-syntax
  for (const key in obj) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    if (!isSerializable(obj[key])) {
      return false;
    }
  }

  return true;
}

export function throwMethodNotFound(...methods: string[]) {
  const msg = `DApp Provider or Background method not support (method=${methods.join(
    '.',
  )}), try to add method decorators @backgroundMethod() or @providerApiMethod()`;
  // @backgroundMethod() in background internal methods
  // @providerMethod() in background provider methods
  throwCrossError(msg);
}

export function warningIfNotRunInBackground({
  name = 'Object',
  target,
}: {
  name?: string;
  target: any;
}) {
  if (process.env.NODE_ENV !== 'production') {
    if (platformEnv.isNative) {
      // iOS/Android cannot get full source code error.stack
      return;
    }
    if (platformEnv.isWebEmbed) {
      // web-embed error.stack data is not reliable, missing background keywords
      return;
    }
    if (platformEnv.isWebMobileIOS || platformEnv.isWebSafari) {
      // iOS safari get wrong error.stack
      return;
    }
    if (globalThis.$onekeyIsInBackground === true) {
      return;
    }
    try {
      throw new NotAutoPrintError();
    } catch (error) {
      const err = error as Error;
      errorUtils.autoPrintErrorIgnore(err);

      const msg = `${name} should run in background`;

      console.error(
        '######',
        msg,
        '>>>>>>',
        target,
        '<<<<<<',
        err.stack,
        '@@@@@@',
      );

      throw new OneKeyLocalError(msg);
    }
  }
}

export function ensureBackgroundObject<T>(object: T): T {
  if (process.env.NODE_ENV !== 'production') {
    const methodCache: Record<string | symbol, any> = {};
    // @ts-ignore
    return new Proxy(object, {
      get: (target: any, prop): any => {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        const isMethod = typeof target[prop] === 'function';
        if (!isMethod) {
          return target[prop];
        }
        if (!methodCache[prop]) {
          methodCache[prop] = (...args: any) => {
            warningIfNotRunInBackground({
              // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
              name: `Object method [${target?.constructor?.name}.${
                prop as string
              }]`,
              target,
            });
            // eslint-disable-next-line @typescript-eslint/no-unsafe-call,@typescript-eslint/no-unsafe-return
            return target[prop](...args);
          };
        }
        return methodCache[prop];
      },
    });
  }
  return object;
}

export function waitAsync(timeout: number) {
  return new Promise((resolve) => {
    setTimeout(resolve, timeout);
  });
}

export function makeTimeoutPromise<T, TParams = undefined>({
  asyncFunc,
  timeout, // ms
  timeoutRejectError,
  onTimeout,
}: {
  asyncFunc: (params: TParams) => Promise<T>;
  timeout: number;
  timeoutRejectError: OneKeyError | Error;
  onTimeout?: (params: TParams) => void;
}) {
  return (params: TParams) =>
    new Promise<T>((resolve, reject) => {
      let isCompleted = false;
      const timer = setTimeout(() => {
        if (isCompleted) {
          return;
        }
        isCompleted = true;
        clearTimeout(timer);
        onTimeout?.(params);
        reject(timeoutRejectError);
        // console.log('makeTimeoutPromise timeout result >>>>> ', timeoutResult);
      }, timeout);

      const p = asyncFunc(params);
      void p
        .then((result) => {
          if (isCompleted) {
            return;
          }
          resolve(result);
          // console.log('makeTimeoutPromise correct result >>>>> ', result);
        })
        .catch((error) => {
          if (isCompleted) {
            return;
          }
          reject(error);
        })
        .finally(() => {
          isCompleted = true;
          clearTimeout(timer);
        });
    });
}

export async function waitForDataLoaded({
  data,
  wait = 600,
  logName,
  timeout = 0,
}: {
  data: (...args: any) => any;
  wait?: number;
  logName: string;
  timeout?: number;
}) {
  let timeoutReject = false;
  let timer: any = null;
  const getDataArrFunc = ([] as ((...args: any) => any)[]).concat(data);
  if (timeout) {
    timer = setTimeout(() => {
      timeoutReject = true;
    }, timeout);
  }
  // eslint-disable-next-line no-constant-condition
  while (true) {
    let isAllLoaded = true;

    await Promise.all(
      getDataArrFunc.map(async (getData) => {
        const d = await getData();
        if (d === false) {
          isAllLoaded = false;
          return;
        }

        if (isNil(d)) {
          isAllLoaded = false;
          return;
        }

        if (isEmpty(d)) {
          if (isPlainObject(d) || isArray(d)) {
            isAllLoaded = false;
          }
        }
      }),
    );

    if (isAllLoaded || timeoutReject) {
      break;
    }
    if (logName && __DEV__) {
      console.log(`waitForDataLoaded: ${logName}`);
    }
    await waitAsync(wait);
  }
  clearTimeout(timer);
  if (timeoutReject) {
    throw new OneKeyLocalError(`waitForDataLoaded: ${logName ?? ''} timeout`);
  }
}

export const MAX_LOG_LENGTH = 1000;

export const scopeNetworks: Record<
  IInjectedProviderNamesStrings,
  string[] | undefined
> = {
  'btc': [IMPL_BTC, IMPL_TBTC],
  'ethereum': [IMPL_EVM],
  'near': [IMPL_NEAR],
  'conflux': [IMPL_CFX],
  'solana': [IMPL_SOL],
  'sollet': [IMPL_SOL],
  'aptos': [IMPL_APTOS],
  'martian': [IMPL_APTOS],
  'tron': [IMPL_TRON],
  'algo': [IMPL_ALGO],
  'alephium': [IMPL_ALPH],
  'sui': [IMPL_SUI],
  'bfc': [IMPL_BFC],
  'ton': [IMPL_TON],
  'scdo': [IMPL_SCDO],
  'cardano': [IMPL_ADA],
  'cosmos': [IMPL_COSMOS],
  'polkadot': [IMPL_DOT],
  'webln': [IMPL_LIGHTNING, IMPL_LIGHTNING_TESTNET],
  'nostr': [IMPL_NOSTR],
  'neo': [IMPL_NEO],
  'stellar': [IMPL_STELLAR],
  '$hardware_sdk': undefined,
  '$private': undefined,
  '$walletConnect': undefined,
};

export const ENABLED_DAPP_SCOPE: IInjectedProviderNamesStrings[] = [
  IInjectedProviderNames.btc,
  IInjectedProviderNames.ethereum,
  IInjectedProviderNames.near,
  IInjectedProviderNames.solana,
  IInjectedProviderNames.aptos,
  IInjectedProviderNames.conflux,
  IInjectedProviderNames.tron,
  IInjectedProviderNames.algo,
  IInjectedProviderNames.alephium,
  IInjectedProviderNames.sui,
  IInjectedProviderNames.ton,
  IInjectedProviderNames.scdo,
  IInjectedProviderNames.cardano,
  IInjectedProviderNames.cosmos,
  IInjectedProviderNames.polkadot,
  IInjectedProviderNames.webln,
  IInjectedProviderNames.bfc,
  IInjectedProviderNames.neo,
];

export function getNetworkImplsFromDappScope(
  scope: IInjectedProviderNamesStrings,
) {
  return scopeNetworks[scope];
}

export const getScopeFromImpl = memoizee(
  ({ impl }: { impl: string }): IInjectedProviderNamesStrings[] => {
    const scopes: IInjectedProviderNamesStrings[] = [];
    Object.entries(scopeNetworks).forEach(([scope, impls]) => {
      if (impls?.includes(impl)) {
        scopes.push(scope as IInjectedProviderNamesStrings);
      }
    });
    return scopes;
  },
);

export const GLOBAL_STATES_SYNC_BROADCAST_METHOD_NAME =
  'globaStatesSyncBroadcast';
export type IGlobalStatesSyncBroadcastParams = {
  $$isFromBgStatesSyncBroadcast: true;
  name: string;
  payload: any;
};

export const GLOBAL_EVENT_BUS_SYNC_BROADCAST_METHOD_NAME =
  'globaEventBusSyncBroadcast';
export type IGlobalEventBusSyncBroadcastParams = {
  $$isFromBgEventBusSyncBroadcast: true;
  type: string;
  payload: any;
  /** appEventBus nodeId of the originating runtime; used to skip self-echo. */
  originNodeId?: string;
};

export const REPLACE_WHOLE_STATE = 'REPLACE_WHOLE_STATE';

export async function fetchData<T>(
  _path: string,
  // eslint-disable-next-line default-param-last, @typescript-eslint/default-param-last, @typescript-eslint/no-unused-vars
  query: Record<string, unknown> = {},
  _fallback: T,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  method: Method = 'GET',
): Promise<T> {
  throw new OneKeyLocalError('fetchData not support yet');
  // const endpoint = getFiatEndpoint();
  // const isPostBody = ['post', 'put'].includes(method.toLowerCase());
  // const apiUrl = `${endpoint}${path}${
  //   !isPostBody ? `?${qs.stringify(query)}` : ''
  // }`;
  // try {
  //   const postData = isPostBody ? query : undefined;
  //   const requestConfig = { url: apiUrl, method, data: postData };
  //   const { data } = await axios.request<T>(requestConfig);
  //   return data;
  // } catch (e) {
  //   debugLogger.http.error(
  //     `backgroundApi.fetchData ERROR: request api ${apiUrl}`,
  //     e,
  //   );
  //   return fallback;
  // }
}

export function getBackgroundServiceApi({
  serviceName,
  backgroundApi,
}: {
  serviceName: string;
  backgroundApi: any;
}) {
  let serviceApi: {
    [key: string]: (...args: any[]) => any;
  } = backgroundApi;
  if (serviceName) {
    if (serviceName.includes('@')) {
      const [nameSpace, name] = serviceName.split('@');
      if (!nameSpace) {
        throw new OneKeyLocalError(`service nameSpace not found: ${nameSpace}`);
      }
      if (!backgroundApi[nameSpace]) {
        throw new OneKeyLocalError(`service nameSpace not found: ${nameSpace}`);
      }
      serviceApi = backgroundApi[nameSpace][name];
    } else {
      serviceApi = backgroundApi[serviceName];
    }

    if (!serviceApi) {
      throw new OneKeyLocalError(`serviceApi not found: ${serviceName}`);
    }
  }
  return serviceApi;
}

export type IBridgePayloadGuardMode = 'off' | 'warn' | 'throw';

export interface IBridgePayloadViolation {
  kind: 'ping-pong-roundtrip' | 'oversized-main-to-bg-params';
  method: string;
  sourceMethod?: string;
  path?: string;
  itemCount?: number;
  estimatedBytes?: number;
  budgetBytes?: number;
  elapsedMs?: number;
  message: string;
}

export interface IBridgePayloadGuardConfig {
  mode: IBridgePayloadGuardMode;
  maxMainToBgParamBytes: number;
  pingPongWindowMs: number;
  minArrayItems: number;
  minMapKeys: number;
}

interface IRecordedResponseFingerprint {
  fingerprint: string;
  sourceMethod: string;
  path: string;
  itemCount: number;
  timestamp: number;
}

const DEFAULT_GUARD_CONFIG: IBridgePayloadGuardConfig = {
  mode: 'off',
  maxMainToBgParamBytes: 64 * 1024,
  pingPongWindowMs: 5000,
  minArrayItems: 8,
  minMapKeys: 16,
};

let guardConfig: IBridgePayloadGuardConfig = { ...DEFAULT_GUARD_CONFIG };
const recentResponseFingerprints = new Map<
  string,
  IRecordedResponseFingerprint
>();
const recordedViolations: IBridgePayloadViolation[] = [];

function getEffectiveGuardMode(): IBridgePayloadGuardMode {
  const globalOverride = (
    globalThis as typeof globalThis & {
      __ONEKEY_BRIDGE_PAYLOAD_GUARD_MODE__?: IBridgePayloadGuardMode;
    }
  ).__ONEKEY_BRIDGE_PAYLOAD_GUARD_MODE__;
  if (globalOverride) {
    return globalOverride;
  }
  if (guardConfig.mode !== 'off') {
    return guardConfig.mode;
  }
  const isJest =
    typeof process !== 'undefined' && Boolean(process.env?.JEST_WORKER_ID);
  if (!isJest && platformEnv.isDev) {
    return 'warn';
  }
  return 'off';
}

function extractItemSampleIdentity(item: unknown): string | undefined {
  if (!item || typeof item !== 'object' || Array.isArray(item)) {
    return undefined;
  }
  const record = item as Record<string, unknown>;
  const idCandidate =
    record.$key ??
    record.accountId ??
    record.id ??
    record.contractAddress ??
    record.address ??
    record.txid ??
    record.networkId;
  return typeof idCandidate === 'string' && idCandidate.length > 0
    ? idCandidate
    : undefined;
}

export function computeBridgeCollectionFingerprint(
  value: unknown,
  config: Pick<
    IBridgePayloadGuardConfig,
    'minArrayItems' | 'minMapKeys'
  > = guardConfig,
): { fingerprint: string; itemCount: number } | undefined {
  if (Array.isArray(value)) {
    if (value.length < config.minArrayItems) {
      return undefined;
    }
    const first = extractItemSampleIdentity(value[0]);
    const middle = extractItemSampleIdentity(
      value[Math.floor(value.length / 2)],
    );
    const last = extractItemSampleIdentity(value[value.length - 1]);
    if (!first && !middle && !last) {
      return undefined;
    }
    return {
      fingerprint: `arr:${value.length}:${first ?? ''}|${middle ?? ''}|${
        last ?? ''
      }`,
      itemCount: value.length,
    };
  }
  if (isPlainObject(value)) {
    const record = value as Record<string, unknown>;
    const keys = Object.keys(record);
    if (keys.length < config.minMapKeys) {
      return undefined;
    }
    const firstKey = keys[0] ?? '';
    const midKey = keys[Math.floor(keys.length / 2)] ?? '';
    const lastKey = keys[keys.length - 1] ?? '';
    return {
      fingerprint: `map:${keys.length}:${firstKey}|${midKey}|${lastKey}`,
      itemCount: keys.length,
    };
  }
  return undefined;
}

function collectFingerprintsFromValue(
  value: unknown,
  basePath: string,
  depth = 0,
  out: Array<{ fingerprint: string; path: string; itemCount: number }> = [],
): Array<{ fingerprint: string; path: string; itemCount: number }> {
  if (!value || typeof value !== 'object' || depth > 2) {
    return out;
  }
  const direct = computeBridgeCollectionFingerprint(value);
  if (direct) {
    out.push({
      fingerprint: direct.fingerprint,
      path: basePath,
      itemCount: direct.itemCount,
    });
  }
  if (Array.isArray(value)) {
    if (depth === 0) {
      value.forEach((entry, index) => {
        collectFingerprintsFromValue(
          entry,
          `${basePath}[${index}]`,
          depth + 1,
          out,
        );
      });
    }
    return out;
  }
  if (isPlainObject(value)) {
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (v && typeof v === 'object') {
        collectFingerprintsFromValue(
          v,
          basePath ? `${basePath}.${k}` : k,
          depth + 1,
          out,
        );
      }
    }
  }
  return out;
}

export function estimateBridgePayloadBytes(
  value: unknown,
  budgetCap = 512 * 1024,
): number {
  let bytes = 0;
  const stack: unknown[] = [value];
  let visited = 0;
  while (stack.length > 0 && bytes < budgetCap && visited < 15_000) {
    const current = stack.pop();
    visited += 1;
    if (current === null || current === undefined) {
      bytes += 4;
    } else if (typeof current === 'boolean') {
      bytes += 5;
    } else if (typeof current === 'number') {
      bytes += 8;
    } else if (typeof current === 'string') {
      bytes += current.length * 2 + 2;
    } else if (Array.isArray(current)) {
      bytes += 2;
      for (let i = 0; i < current.length; i += 1) {
        stack.push(current[i]);
      }
    } else if (typeof current === 'object') {
      bytes += 2;
      for (const [k, v] of Object.entries(current as Record<string, unknown>)) {
        bytes += k.length * 2 + 3;
        stack.push(v);
      }
    }
  }
  return bytes;
}

function handleViolation(
  violation: IBridgePayloadViolation,
  mode: IBridgePayloadGuardMode,
): void {
  recordedViolations.push(violation);
  if (recordedViolations.length > 100) {
    recordedViolations.shift();
  }
  if (mode === 'warn') {
    console.warn(violation.message);
  } else if (mode === 'throw') {
    throw new OneKeyLocalError(violation.message);
  }
}

export const bridgePayloadGuard = {
  isEnabled(): boolean {
    return getEffectiveGuardMode() !== 'off';
  },
  configure(partial: Partial<IBridgePayloadGuardConfig>): void {
    guardConfig = { ...guardConfig, ...partial };
  },
  reset(): void {
    guardConfig = { ...DEFAULT_GUARD_CONFIG };
    recentResponseFingerprints.clear();
    recordedViolations.length = 0;
  },
  getViolations(): ReadonlyArray<IBridgePayloadViolation> {
    return recordedViolations;
  },
  recordResponse({
    method,
    result,
    now = Date.now(),
  }: {
    method: string;
    result: unknown;
    now?: number;
  }): void {
    if (!this.isEnabled() || !result || typeof result !== 'object') {
      return;
    }
    const items = collectFingerprintsFromValue(result, 'result');
    for (const item of items) {
      recentResponseFingerprints.delete(item.fingerprint);
      recentResponseFingerprints.set(item.fingerprint, {
        fingerprint: item.fingerprint,
        sourceMethod: method,
        path: item.path,
        itemCount: item.itemCount,
        timestamp: now,
      });
    }
    while (recentResponseFingerprints.size > 64) {
      const oldest = recentResponseFingerprints.keys().next().value;
      if (!oldest) {
        break;
      }
      recentResponseFingerprints.delete(oldest);
    }
  },
  inspectRequest({
    method,
    params,
    now = Date.now(),
  }: {
    method: string;
    params: unknown[];
    now?: number;
  }): IBridgePayloadViolation[] {
    const mode = getEffectiveGuardMode();
    if (mode === 'off') {
      return [];
    }
    for (const [key, entry] of recentResponseFingerprints.entries()) {
      if (now - entry.timestamp > guardConfig.pingPongWindowMs) {
        recentResponseFingerprints.delete(key);
      }
    }
    const found: IBridgePayloadViolation[] = [];
    const paramFingerprints = collectFingerprintsFromValue(params, 'params');
    for (const pf of paramFingerprints) {
      const matched = recentResponseFingerprints.get(pf.fingerprint);
      if (matched && matched.sourceMethod !== method) {
        const elapsedMs = Math.max(0, now - matched.timestamp);
        const violation: IBridgePayloadViolation = {
          kind: 'ping-pong-roundtrip',
          method,
          sourceMethod: matched.sourceMethod,
          path: pf.path,
          itemCount: pf.itemCount,
          elapsedMs,
          message: `[BridgePayloadGuard] Ping-Pong round-trip detected: collection (${pf.itemCount} items) returned by "${matched.sourceMethod}" (${matched.path}) was sent back across the bridge to "${method}" (${pf.path}) within ${elapsedMs}ms.`,
        };
        found.push(violation);
        handleViolation(violation, mode);
      }
    }
    const estimatedBytes = estimateBridgePayloadBytes(
      params,
      guardConfig.maxMainToBgParamBytes * 2,
    );
    if (estimatedBytes > guardConfig.maxMainToBgParamBytes) {
      const violation: IBridgePayloadViolation = {
        kind: 'oversized-main-to-bg-params',
        method,
        estimatedBytes,
        budgetBytes: guardConfig.maxMainToBgParamBytes,
        message: `[BridgePayloadGuard] Oversized Main->BG RPC payload for "${method}": ~${estimatedBytes} bytes exceeds budget of ${guardConfig.maxMainToBgParamBytes} bytes.`,
      };
      found.push(violation);
      handleViolation(violation, mode);
    }
    return found;
  },
};
