import type { ILocaleIds } from '@onekeyhq/components/src/locale';

export enum EOneKeyErrorClassNames {
  OneKeyError = 'OneKeyError',
  OneKeyHardwareError = 'OneKeyHardwareError',
  OneKeyValidatorError = 'OneKeyValidatorError',
  OneKeyValidatorTip = 'OneKeyValidatorTip',
  OneKeyAbortError = 'OneKeyAbortError',
  OneKeyWalletConnectModalCloseError = 'OneKeyWalletConnectModalCloseError',
  OneKeyAlreadyExistWalletError = 'OneKeyAlreadyExistWalletError',
  OneKeyErrorInsufficientNativeBalance = 'OneKeyErrorInsufficientNativeBalance',
}

export type IOneKeyErrorInfo = Record<string | number, string | number>;

export type IOneKeyHardwareErrorData = {
  reconnect?: boolean | undefined;
  connectId?: string;
  deviceId?: string;
};

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
  InfoT = IOneKeyErrorInfo | any,
  DataT = IOneKeyJsError | any,
> extends IOneKeyJsError {
  // Web3RpcError props
  code?: number;
  data?: DataT;
  // OneKeyError props
  className?: EOneKeyErrorClassNames;
  info?: InfoT;
  key?: ILocaleIds;
  constructorName?: string;
  autoToast?: boolean;
}

export type IOneKeyHardwareErrorPayload = {
  code?: number;
  error?: string;
  message?: string;
  params?: any;
  connectId?: string;
  deviceId?: string;
};
export type IOneKeyErrorMeta = {
  defaultMessage?: string;
};
