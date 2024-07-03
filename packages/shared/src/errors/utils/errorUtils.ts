import { isObject, isPlainObject, isString, isUndefined, omitBy } from 'lodash';

import type { ETranslations } from '@onekeyhq/shared/src/locale';

import { appLocale } from '../../locale/appLocale';
import platformEnv from '../../platformEnv';

import type {
  IOneKeyError,
  IOneKeyHardwareErrorPayload,
} from '../types/errorTypes';
import type { MessageDescriptor } from 'react-intl';

// TODO also update JsBridgeBase.toPlainError
/**
 * Converts an error object into a plain object with specific properties.
 *
 * @param {Object} error - The error object to convert. It may have properties such as name, message, stack (js native Error), code, data (Web3RpcError), className, info, key (OneKeyError).
 * @returns {Object} A plain object with properties: name, message, code, data, className, info, key, stack. If the platform is Android hermes engine, the stack property will be a specific error message.
 */
export function toPlainErrorObject(error: IOneKeyError) {
  if (!error) {
    return error;
  }
  return omitBy(
    {
      name: error.name,
      constructorName: error.constructorName,
      className: error.className,
      key: error.key,
      code: error.code,
      message: error.message,
      autoToast: error.autoToast,
      requestId: error.requestId,
      data: error.data,
      info: error.info,
      payload: error.payload,
      // Crash in native hermes engine (error.stack serialize fail, only if Web3Errors object)
      stack: platformEnv.isNative
        ? 'Access error.stack failed in native hermes engine: unable to serialize, circular reference is too complex to analyze'
        : error.stack,
      reconnect: error.reconnect,
      // TODO Crash in Android hermes engine (error.stack serialize fail, only if Web3Errors object)
      // 'Access error.stack failed in Android hermes engine: unable to serialize, circular reference is too complex to analyze'
    },
    isUndefined,
  );
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
      .map((error) => ({
        name: error?.name,
        code: error?.code,
        className: error?.className,
        constructorName: error?.constructorName,
        key: error?.key,
      }));
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

export const errorsIntlFormatter: {
  formatMessage?: (
    descriptor: MessageDescriptor,
    values?: Record<string, any>,
  ) => string | undefined;
} = {
  formatMessage: undefined,
};

export function getDeviceErrorPayloadMessage(
  payload: IOneKeyHardwareErrorPayload,
) {
  return payload.error || payload.message || '';
}

export function normalizeErrorProps(
  props?: IOneKeyError | string,
  config?: {
    defaultMessage?: string | ETranslations;
    defaultKey?: ETranslations;
    defaultAutoToast?: boolean;
    alwaysAppendDefaultMessage?: boolean;
  },
): IOneKeyError {
  // props.message
  let msg: string | undefined = isString(props) ? props : props?.message;

  // i18n message
  const key =
    (isString(props) ? undefined : props?.key) ||
    config?.defaultKey ||
    undefined;
  if (!msg && key && appLocale.intl.formatMessage && !platformEnv.isJest) {
    msg = appLocale.intl.formatMessage(
      { id: key },
      (props as IOneKeyError)?.info,
    );
    if (msg === key) {
      msg = [config?.defaultMessage, key].filter(Boolean).join(' ');
    }
  }

  // device error message
  if (!msg && isObject(props) && props.payload) {
    msg = getDeviceErrorPayloadMessage(props.payload);
  }

  // fallback to default message
  if (!msg && config?.defaultMessage) {
    msg = config?.defaultMessage;
  }

  msg = msg || '';

  if (config?.alwaysAppendDefaultMessage) {
    if (config?.defaultMessage) {
      msg = `${msg} > ${config?.defaultMessage}`;
    }
  }

  return {
    message: msg,
    key,
    autoToast: (props as IOneKeyError)?.autoToast ?? config?.defaultAutoToast,
    requestId: (props as IOneKeyError)?.requestId,
    ...(isString(props) ? {} : props),
  };
}

function autoPrintErrorIgnore(error: unknown | undefined) {
  const e = error as IOneKeyError | undefined;
  if (e) {
    // disable autoLogger Error in DEV
    e.$$autoPrintErrorIgnore = true;
  }
}

function toastIfError(error: unknown) {
  // Some third-party libraries or external wallets return not an Error object, but a normal JSON object. Here we need to use isPlainObject to do a compatible processing.

  if (error instanceof Error || isPlainObject(error)) {
    const e = error as IOneKeyError | undefined;
    if (e) {
      // handle autoToast error by BackgroundApiProxyBase
      e.autoToast = true;
    }
  }
}

function toastIfErrorDisable(error: unknown) {
  // Some third-party libraries or external wallets return not an Error object, but a normal JSON object. Here we need to use isPlainObject to do a compatible processing.

  if (error instanceof Error || isPlainObject(error)) {
    const e = error as IOneKeyError | undefined;
    if (e) {
      e.autoToast = false;
    }
  }
}

export default {
  autoPrintErrorIgnore,
  normalizeErrorProps,
  safeConsoleLogError,
  toPlainErrorObject,
  interceptConsoleErrorWithExtraInfo,
  errorsIntlFormatter,
  getDeviceErrorPayloadMessage,
  toastIfError,
  toastIfErrorDisable,
};
