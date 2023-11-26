/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import { IInjectedProviderNames } from '@onekeyfe/cross-inpage-provider-types';
import axios from 'axios';
import {
  isArray,
  isBoolean,
  isEmpty,
  isFunction,
  isNil,
  isNull,
  isNumber,
  isPlainObject,
  isString,
  isUndefined,
} from 'lodash';
import qs from 'qs';
import { batch } from 'react-redux';

import { getFiatEndpoint } from '@onekeyhq/engine/src/endpoint';

import {
  IMPL_ADA,
  IMPL_ALGO,
  IMPL_APTOS,
  IMPL_BTC,
  IMPL_CFX,
  IMPL_COSMOS,
  IMPL_DOT,
  IMPL_EVM,
  IMPL_LIGHTNING,
  IMPL_NEAR,
  IMPL_SOL,
  IMPL_STC,
  IMPL_SUI,
  IMPL_TRON,
} from '../engine/engineConsts';
import { NotAutoPrintError } from '../errors/common-errors';
import debugLogger from '../logger/debugLogger';
import platformEnv from '../platformEnv';

import type { IInjectedProviderNamesStrings } from '@onekeyfe/cross-inpage-provider-types';
import type { PayloadAction } from '@reduxjs/toolkit';
import type { Method } from 'axios';
import type { AnyAction } from 'redux';

export function throwCrossError(msg: string, ...args: any) {
  if (platformEnv.isNative) {
    // `throw new Error()` won't print error object in iOS/Android,
    //    so we print it manually by `console.error()`
    console.error(msg, ...args);
  }
  throw new Error(msg);
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

export function ensureSerializable(obj: any, stringify = false): any {
  if (process.env.NODE_ENV !== 'production') {
    if (!isSerializable(obj)) {
      console.error('Object should be serializable >>>> ', obj);
      if (stringify) {
        return JSON.parse(JSON.stringify(obj));
      }

      throw new Error('Object should be serializable');
    }
  }
  return obj;
}

export function ensurePromiseObject(
  obj: any,
  {
    serviceName,
    methodName,
  }: {
    serviceName: string;
    methodName: string;
  },
) {
  if (process.env.NODE_ENV !== 'production') {
    if (obj !== undefined && !(obj instanceof Promise)) {
      throwCrossError(
        `${
          serviceName ? `${serviceName}.` : ''
        }${methodName}() should be async or Promise method.`,
      );
    }
  }
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
    try {
      throw new NotAutoPrintError();
    } catch (error) {
      const err = error as Error;
      if (
        err.stack &&
        !err.stack.includes('backgroundApiInit') &&
        !err.stack.includes('BackgroundApiBase') &&
        !err.stack.includes('BackgroundApi') &&
        !err.stack.includes('background.bundle.js') &&
        !err.stack.includes('background.')
      ) {
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

        throw new Error(msg);
      }
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

export function makeTimeoutPromise<T>({
  asyncFunc,
  timeout,
  timeoutResult,
}: {
  asyncFunc: () => Promise<T>;
  timeout: number;
  timeoutResult: T;
}) {
  return new Promise<T>((resolve) => {
    let isResolved = false;
    const timer = setTimeout(() => {
      if (isResolved) {
        return;
      }
      isResolved = true;
      resolve(timeoutResult);
      // console.log('makeTimeoutPromise timeout result >>>>> ', timeoutResult);
    }, timeout);

    const p = asyncFunc();
    p.then((result) => {
      if (isResolved) {
        return;
      }
      isResolved = true;
      clearTimeout(timer);
      resolve(result);
      // console.log('makeTimeoutPromise correct result >>>>> ', result);
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

    if (logName && __DEV__) {
      console.log(`waitForDataLoaded: ${logName}`);
    }
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
    await waitAsync(wait);
  }
  clearTimeout(timer);
  if (timeoutReject) {
    throw new Error(`waitForDataLoaded: ${logName ?? ''} timeout`);
  }
}

export const MAX_LOG_LENGTH = 1000;

const scopeNetwork: Record<IInjectedProviderNamesStrings, string | undefined> =
  {
    'btc': IMPL_BTC,
    'ethereum': IMPL_EVM,
    'near': IMPL_NEAR,
    'conflux': IMPL_CFX,
    'solana': IMPL_SOL,
    'sollet': IMPL_SOL,
    'starcoin': IMPL_STC,
    'aptos': IMPL_APTOS,
    'martian': IMPL_APTOS,
    'tron': IMPL_TRON,
    'algo': IMPL_ALGO,
    'sui': IMPL_SUI,
    'cardano': IMPL_ADA,
    'cosmos': IMPL_COSMOS,
    'polkadot': IMPL_DOT,
    'webln': IMPL_LIGHTNING,
    'nostr': undefined,
    '$hardware_sdk': undefined,
    '$private': undefined,
  };

export const ENABLED_DAPP_SCOPE: IInjectedProviderNamesStrings[] = [
  IInjectedProviderNames.btc,
  IInjectedProviderNames.ethereum,
  IInjectedProviderNames.starcoin,
  IInjectedProviderNames.near,
  IInjectedProviderNames.solana,
  IInjectedProviderNames.aptos,
  IInjectedProviderNames.conflux,
  IInjectedProviderNames.tron,
  IInjectedProviderNames.algo,
  IInjectedProviderNames.sui,
  IInjectedProviderNames.cardano,
  IInjectedProviderNames.cosmos,
  IInjectedProviderNames.polkadot,
  IInjectedProviderNames.webln,
];

export function getNetworkImplFromDappScope(
  scope: IInjectedProviderNamesStrings,
) {
  return scopeNetwork[scope];
}

export const isDappScopeMatchNetwork = (
  scope?: IInjectedProviderNamesStrings,
  impl?: string,
) => {
  if (scope && impl) {
    return scopeNetwork[scope] === impl;
  }
  return true;
};

export const DISPATCH_ACTION_BROADCAST_METHOD_NAME = 'dispatchActionBroadcast';
export const REPLACE_WHOLE_STATE = 'REPLACE_WHOLE_STATE';
export type IDispatchActionBroadcastParams = {
  actions?: PayloadAction[];
  $isDispatchFromBackground: boolean;
};
export function buildReduxBatchAction(...actions: AnyAction[]) {
  if (!actions || !actions.length) {
    return undefined;
  }
  if (actions && actions.length > 1) {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const batchAction = (dispatch: (p: any) => void, getState: any) => {
      // should only result in one combined re-render, not two
      batch(() => {
        actions.forEach((action) => {
          if (isFunction(action)) {
            throw new Error(
              'backgroundApi.dispatch ERROR:  async action is NOT allowed.',
            );
          }
          if (action) {
            action.$isDispatchFromBackground = true;
          }

          dispatch(action);
          ensureSerializable(action);
        });
      });
    };
    return batchAction;
  }

  const singleAction: AnyAction | undefined = actions?.[0];
  if (singleAction) {
    singleAction.$isDispatchFromBackground = true;
  }

  return singleAction;
}

export async function fetchData<T>(
  path: string,
  // eslint-disable-next-line default-param-last, @typescript-eslint/default-param-last
  query: Record<string, unknown> = {},
  fallback: T,
  method: Method = 'GET',
): Promise<T> {
  const endpoint = getFiatEndpoint();
  const isPostBody = ['post', 'put'].includes(method.toLowerCase());
  const apiUrl = `${endpoint}${path}${
    !isPostBody ? `?${qs.stringify(query)}` : ''
  }`;
  try {
    const postData = isPostBody ? query : undefined;
    const requestConfig = { url: apiUrl, method, data: postData };
    const { data } = await axios.request<T>(requestConfig);
    return data;
  } catch (e) {
    debugLogger.http.error(
      `backgroundApi.fetchData ERROR: request api ${apiUrl}`,
      e,
    );
    return fallback;
  }
}
