import { isObject, isString, isUndefined, omitBy } from 'lodash';

import type { ETranslationsMock } from '@onekeyhq/shared/src/locale';
import { ETranslations } from '@onekeyhq/shared/src/locale';

import appGlobals from '../../appGlobals';
import { appLocale } from '../../locale/appLocale';
import platformEnv from '../../platformEnv';

import type {
  EOneKeyErrorClassNames,
  IOneKeyError,
  IOneKeyHardwareErrorPayload,
} from '../types/errorTypes';
import type { MessageDescriptor } from 'react-intl';

/**
 * Converts an error object into a plain object with specific properties.
 *
 * @param {Object} error - The error object to convert. It may have properties such as name, message, stack (js native Error), code, data (Web3RpcError), className, info, key (OneKeyError).
 * @returns {Object} A plain object with properties: name, message, code, data, className, info, key, stack. If the platform is Android hermes engine, the stack property will be a specific error message.
 */
export function toPlainErrorObject(error: IOneKeyError | undefined) {
  if (!error) {
    return {
      name: 'UnknownEmptyError',
      message: 'Unknown empty error',
    };
  }
  return omitBy(
    {
      // ****** also update JsBridgeBase.toPlainError
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
    defaultKey?: ETranslations | ETranslationsMock;
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

  if (key === ETranslations.auth_error_passcode_incorrect) {
    // console.log('IncorrectPasswordI18nKey before', key, msg);
  }

  if (!msg && key && appLocale.intl.formatMessage && !platformEnv.isJest) {
    msg = appLocale.intl.formatMessage(
      { id: key },
      (props as IOneKeyError)?.info,
    );
    if (key === ETranslations.auth_error_passcode_incorrect) {
      // console.log('IncorrectPasswordI18nKey', key, msg);
    }
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
    ...(isString(props) ? {} : props),
    message: msg,
    key,
    autoToast: (props as IOneKeyError)?.autoToast ?? config?.defaultAutoToast,
    requestId: (props as IOneKeyError)?.requestId,
  };
}

function autoPrintErrorIgnore(error: unknown | undefined) {
  const e = error as IOneKeyError | undefined;
  if (e) {
    // disable autoLogger Error in DEV
    e.$$autoPrintErrorIgnore = true;
  }
}

function isErrorByClassName({
  error,
  className,
}: {
  error: unknown;
  className: EOneKeyErrorClassNames | EOneKeyErrorClassNames[];
}): boolean {
  const classNames: EOneKeyErrorClassNames[] = (
    [] as EOneKeyErrorClassNames[]
  ).concat(className);
  const errorClassName = (error as IOneKeyError)?.className;
  return Boolean(errorClassName && classNames.includes(errorClassName));
}

function getCurrentCallStackV1() {
  try {
    // eslint-disable-next-line no-restricted-syntax
    throw new Error();
  } catch (e) {
    autoPrintErrorIgnore(e);
    return (e as IOneKeyError)?.stack;
  }
}

function getCurrentCallStack() {
  const e = new Error();
  const stack = e.stack;
  return stack;
}

function logCurrentCallStack(name?: string) {
  if (process.env.NODE_ENV !== 'production') {
    if (
      console &&
      console.groupCollapsed &&
      console.groupEnd &&
      console.trace
    ) {
      console.groupCollapsed(`[${name || ''}] logCurrentCallStack ↓↓↓ `);
      console.trace();
      console.log(getCurrentCallStack());
      console.log(getCurrentCallStackV1());
      console.groupEnd();
    }
  }
}

const errorUtils = {
  autoPrintErrorIgnore,
  normalizeErrorProps,
  safeConsoleLogError,
  toPlainErrorObject,
  interceptConsoleErrorWithExtraInfo,
  errorsIntlFormatter,
  getDeviceErrorPayloadMessage,
  isErrorByClassName,
  getCurrentCallStackV1,
  getCurrentCallStack,
  logCurrentCallStack,
};

appGlobals.$$errorUtils = errorUtils;

export default errorUtils;
