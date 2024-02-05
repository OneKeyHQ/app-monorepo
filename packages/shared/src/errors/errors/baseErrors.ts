/* eslint-disable max-classes-per-file */

import { Web3RpcError } from '@onekeyfe/cross-inpage-provider-errors';
import { isPlainObject, isString } from 'lodash';

import type { ILocaleIds } from '@onekeyhq/components/src/locale';

import type {
  EOneKeyErrorClassNames,
  IOneKeyError,
  IOneKeyErrorI18nInfo,
  IOneKeyHardwareErrorPayload,
  IOneKeyJsError,
} from '../types/errorTypes';

// const fakeMessage = 'FAKE_MESSAGE:F43E2460-AB7F-4EA5-9651-7D38C189AB45';

export class OneKeyWeb3RpcError<T = IOneKeyJsError> extends Web3RpcError<T> {}

export class OneKeyError<
    I18nInfoT = IOneKeyErrorI18nInfo | any,
    DataT = IOneKeyJsError | any,
  >
  extends OneKeyWeb3RpcError<DataT>
  implements IOneKeyError<I18nInfoT, DataT>
{
  className?: EOneKeyErrorClassNames;

  // i18n key
  readonly key?: ILocaleIds = 'onekey_error' as ILocaleIds;

  // i18n params
  readonly info?: I18nInfoT;

  // raw payload from hardware sdk error response
  payload: IOneKeyHardwareErrorPayload | undefined;

  autoToast?: boolean | undefined;

  constructor(
    errorProps?: IOneKeyError<I18nInfoT, DataT> | string,
    info?: I18nInfoT,
  ) {
    let msg;
    let code;
    let data;
    let key;
    let infoData: I18nInfoT | undefined;
    let hardwareErrorPayload: IOneKeyHardwareErrorPayload | undefined;
    let autoToast: boolean | undefined;
    if (!isString(errorProps) && errorProps && isPlainObject(errorProps)) {
      ({
        message: msg,
        code,
        data,
        info: infoData,
        key,
        autoToast,
        payload: hardwareErrorPayload,
      } = errorProps);
    } else {
      msg = isString(errorProps) ? errorProps : '';
      code = -99999;
      infoData = info;
    }
    super(
      code ?? -99999,
      // * empty string not allowed in Web3RpcError, give a fakeMessage by default
      // * can not access this.key before constructor
      msg ||
        `Unknown Onekey Internal Error. ${[key].filter(Boolean).join(':')}`,
      data,
    );

    if (key) {
      this.key = key;
    }
    if (infoData) {
      this.info = infoData;
    }
    if (hardwareErrorPayload) {
      this.payload = hardwareErrorPayload;
    }
    this.autoToast = autoToast;
  }

  // for jest only: this is not stable, do not use it. may be different in compressed code
  get constructorName() {
    return this?.constructor?.name;
  }

  override serialize() {
    const serialized: {
      code: number;
      message: string;
      data?: DataT;
      stack?: string;
    } = {
      code: this.code,
      message: this.message,
    };
    if (this.data !== undefined) {
      serialized.data = this.data;
    }
    // TODO read error.stack cause app crash
    // if (this.stack) {
    //   // serialized.stack = this.stack;
    // }
    // TODO Crash in Android hermes engine (error.stack serialize fail, only if Web3Errors object)

    return serialized;
  }
}
