import assert from 'assert';

import {
  isArray,
  isBoolean,
  isNull,
  isNumber,
  isPlainObject,
  isString,
  isUndefined,
} from 'lodash';

import platformEnv from '../platformEnv';

import { isPromiseObject } from './promiseUtils';

type IErrorType = undefined | string | Error;

export { assert };

export const check = (statement: any, orError?: IErrorType) => {
  if (!statement) {
    // eslint-disable-next-line no-param-reassign
    orError = orError || 'Invalid statement';
    // eslint-disable-next-line no-param-reassign
    orError = orError instanceof Error ? orError : new Error(orError);

    throw orError;
  }
};
export const checkIsDefined = <T>(something?: T, orError?: IErrorType): T => {
  check(
    typeof something !== 'undefined',
    orError || 'Expect defined but actually undefined',
  );
  return something as T;
};

export const checkIsUndefined = (something: any, orError?: IErrorType) => {
  check(
    typeof something === 'undefined',
    orError || `Expect undefined but actually ${something as string}`,
  );
};

export function throwCrossError(msg: string, ...args: any) {
  if (platformEnv.isNative) {
    // `throw new Error()` won't print error object in iOS/Android,
    //    so we print it manually by `console.error()`
    console.error(msg, ...args);
  }
  throw new Error(msg);
}

export function isSerializable(obj: any, keyPath?: string[]) {
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
    console.log('isSerializable false >>>>>> : ', keyPath, obj);
    return false;
  }

  // eslint-disable-next-line no-restricted-syntax
  for (const key in obj) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    if (!isSerializable(obj[key], [...(keyPath || []), key])) {
      return false;
    }
  }

  return true;
}

export function ensureSerializable(
  obj: any,
  stringify = false,
  info?: any,
): any {
  if (process.env.NODE_ENV !== 'production') {
    if (!isSerializable(obj)) {
      console.error('Object should be serializable >>>> ', obj, info);
      if (stringify) {
        return JSON.parse(
          // stringUtils.safeStringify(obj),
          JSON.stringify(obj),
        );
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
    // if (obj !== undefined && !(obj instanceof Promise)) {
    if (!isPromiseObject(obj)) {
      throwCrossError(
        `${
          serviceName ? `${serviceName}.` : ''
        }${methodName}() should be async or Promise method.`,
      );
    }
  }
}

export function ensureRunOnBackground() {
  // eslint-disable-next-line import/no-named-as-default-member
  if (!platformEnv.isJest && platformEnv.isExtensionUi) {
    throw new Error('this code can not run on UI');
  }
}

export function ensureRunOnNative() {
  if (!platformEnv.isJest && !platformEnv.isNative) {
    throw new Error('this code can not run on non-native');
  }
}
