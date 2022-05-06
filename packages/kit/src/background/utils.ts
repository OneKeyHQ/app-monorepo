/* eslint-disable @typescript-eslint/no-unsafe-member-access */
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

import platformEnv from '@onekeyhq/shared/src/platformEnv';

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
  )})`;
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
    try {
      throw new Error();
    } catch (error) {
      const err = error as Error;
      if (
        err.stack &&
        !err.stack.includes('backgroundApiInit') &&
        !err.stack.includes('BackgroundApiBase') &&
        !err.stack.includes('BackgroundApi') &&
        !err.stack.includes('background.bundle.js')
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

export function delay(timeout: number) {
  return new Promise((resolve) => {
    setTimeout(resolve, timeout);
  });
}

export async function waitForDataLoaded({
  data,
  wait = 600,
  logName,
}: {
  data: (...args: any) => any;
  wait?: number;
  logName: string;
}) {
  const getDataArrFunc = ([] as ((...args: any) => any)[]).concat(data);
  // TODO timeout break
  // eslint-disable-next-line no-constant-condition
  while (true) {
    let isAllLoaded = true;

    if (logName) {
      console.log(`waitForDataLoaded: ${logName}`);
    }

    await Promise.all(
      getDataArrFunc.map(async (getData) => {
        const d = await getData();
        if (d === false) {
          isAllLoaded = false;
        }

        if (isNil(d)) {
          isAllLoaded = false;
        }

        if (isEmpty(d)) {
          if (isPlainObject(d) || isArray(d)) {
            isAllLoaded = false;
          }
        }
      }),
    );

    if (isAllLoaded) {
      break;
    }
    await delay(wait);
  }
}
