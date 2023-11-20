/* eslint-disable max-classes-per-file */

import { Web3RpcError } from '@onekeyfe/cross-inpage-provider-errors';
import { isPlainObject, isString } from 'lodash';

import type { ILocaleIds } from '@onekeyhq/components/src/locale';

import type {
  EOneKeyErrorClassNames,
  IOneKeyError,
  IOneKeyErrorInfo,
  IOneKeyJsError,
} from '../types/errorTypes';

// const fakeMessage = 'FAKE_MESSAGE:F43E2460-AB7F-4EA5-9651-7D38C189AB45';

export class OneKeyWeb3RpcError<T = IOneKeyJsError> extends Web3RpcError<T> {}

export class OneKeyError<
    InfoT = IOneKeyErrorInfo | any,
    DataT = IOneKeyJsError | any,
  >
  extends OneKeyWeb3RpcError<DataT>
  implements IOneKeyError<InfoT, DataT>
{
  className?: EOneKeyErrorClassNames;

  // i18n key
  readonly key?: ILocaleIds = 'onekey_error' as ILocaleIds;

  // i18n params
  readonly info?: InfoT;

  constructor(errorProps?: IOneKeyError<InfoT, DataT> | string, info?: InfoT) {
    let msg;
    let code;
    let data;
    let key;
    let infoData: InfoT | undefined;
    if (!isString(errorProps) && errorProps && isPlainObject(errorProps)) {
      ({ message: msg, code, data, info: infoData, key } = errorProps);
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
  }

  // this is not stable, do not use it. may be different in compressed code
  get constructorName() {
    return this?.constructor?.name;
  }
}
