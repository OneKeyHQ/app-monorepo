import {
  isArray,
  isBoolean,
  isNull,
  isNumber,
  isPlainObject,
  isString,
  isUndefined,
} from 'lodash';

import platformEnv from '@onekeyhq/shared/src/platformEnv';

export function isSerializable(obj: any) {
  if (
    isUndefined(obj) ||
    isNull(obj) ||
    isBoolean(obj) ||
    isNumber(obj) ||
    isString(obj)
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

export function ensureSerializable(obj: any) {
  if (platformEnv.isDev && !isSerializable(obj)) {
    console.error('Object should be serializable >>>> ', obj);
    throw new Error('Object should be serializable');
  }
}
