import type { ILocaleIds } from '@onekeyhq/components/src/locale';

export enum ECustomOneKeyHardwareError {
  NeedOneKeyBridge = 3030,
  // TODO: remove this error code
  NeedFirmwareUpgrade = 4030,
}

export enum EOneKeyErrorClassNames {
  OneKeyError = 'OneKeyError',
  OneKeyHardwareError = 'OneKeyHardwareError',
  UnknownHardwareError = 'UnknownHardwareError',
  OneKeyValidatorError = 'OneKeyValidatorError',
  OneKeyValidatorTip = 'OneKeyValidatorTip',
  OneKeyAbortError = 'OneKeyAbortError',
  OneKeyWalletConnectModalCloseError = 'OneKeyWalletConnectModalCloseError',
  OneKeyAlreadyExistWalletError = 'OneKeyAlreadyExistWalletError',
  OneKeyErrorInsufficientNativeBalance = 'OneKeyErrorInsufficientNativeBalance',
}

export type IOneKeyErrorI18nInfo = Record<string | number, string | number>;

// @ts-ignore
export interface IOneKeyJsError extends Error {
  // ES5 Error props
  message?: string;
  name?: string;
  stack?: string;
  // ES2022 Error props
  cause?: unknown;
}

export interface IOneKeyError<
  InfoT = IOneKeyErrorI18nInfo | any,
  DataT = IOneKeyJsError | any,
> extends IOneKeyJsError {
  // ---- Web3RpcError props
  code?: number;
  data?: DataT;
  // ---- OneKeyError props
  className?: EOneKeyErrorClassNames;
  key?: ILocaleIds; // i18n key
  info?: InfoT; // i18n params
  constructorName?: string;
  autoToast?: boolean; // TODO move to $$config: { autoToast, reconnect }
  // ---- hardwareError props
  payload?: IOneKeyHardwareErrorPayload; // raw payload from hardware sdk error response
  reconnect?: boolean;
}

export type IOneKeyHardwareErrorPayload = {
  code?: number | string;
  error?: string;
  message?: string;
  params?: any;
  connectId?: string;
  deviceId?: string;
};

export type IOneKeyHardwareErrorData = {
  reconnect?: boolean | undefined;
  connectId?: string;
  deviceId?: string;
};

export type IOneKeyErrorMeta = {
  defaultMessage?: string;
};
