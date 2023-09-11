import { isString } from 'lodash';

import type { LocaleIds } from '@onekeyhq/components/src/locale';

import platformEnv from '../../platformEnv';

import type { IOneKeyError } from '../types/errorTypes';

/**
 * Converts an error object into a plain object with specific properties.
 *
 * @param {Object} error - The error object to convert. It may have properties such as name, message, stack (js native Error), code, data (Web3RpcError), className, info, key (OneKeyError).
 * @returns {Object} A plain object with properties: name, message, code, data, className, info, key, stack. If the platform is Android hermes engine, the stack property will be a specific error message.
 */
export function toPlainErrorObject(
  error: IOneKeyError,
  { removeStack }: { removeStack?: boolean } = {},
) {
  if (!error) {
    return error;
  }
  const result = {
    name: error.name,
    constructorName: error.constructorName,
    className: error.className,
    key: error.key,
    code: error.code,
    message: error.message,
    data: error.data,
    info: error.info,
    // Crash in Android hermes engine (error.stack serialize fail, only if Web3Errors object)
    stack: platformEnv.isNativeAndroid
      ? 'Access error.stack failed in Android hermes engine: unable to serialize, circular reference is too complex to analyze'
      : error.stack,
  };
  if (removeStack) {
    delete result.stack;
  }
  return result;
}

// 生成 jsdoc 文档, 包含一个 example
export function safeConsoleLogError(error: Error | unknown) {
  if (platformEnv.isNativeAndroid) {
    // sometimes error.stack cause Android hermes engine crash
    delete (error as Error).stack;
  }
  console.error(error);
}

export function interceptConsoleErrorWithExtraInfo() {
  // @ts-ignore
  if (console.error.$isIntercepted) {
    return;
  }
  const oldConsoleError = console.error;
  // @ts-ignore
  console.logErrorOriginal = oldConsoleError;
  console.error = function (...errors: IOneKeyError[]) {
    const extraInfoErrors = errors
      .filter((e) => e?.constructorName)
      .map((error) => toPlainErrorObject(error, { removeStack: true }));
    if (extraInfoErrors?.length) {
      oldConsoleError(
        '********* ERROR EXTRA INFO *********',
        ...extraInfoErrors,
      );
    }
    oldConsoleError(...errors);
  };
  // @ts-ignore
  console.error.$isIntercepted = true;
}

export function normalizeErrorProps(
  props?: IOneKeyError | string,
  config?: {
    defaultMessage?: string;
    defaultKey?: LocaleIds;
  },
) {
  const msg: string =
    (isString(props) ? props : props?.message) || config?.defaultMessage || '';
  const key =
    (isString(props) ? undefined : props?.key) ||
    config?.defaultKey ||
    undefined;
  return {
    message: msg,
    key,
    ...(isString(props) ? {} : props),
  };
}
