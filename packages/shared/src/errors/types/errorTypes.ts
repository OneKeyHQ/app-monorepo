import type {
  ETranslations,
  ETranslationsMock,
} from '@onekeyhq/shared/src/locale';

export enum ECustomOneKeyHardwareError {
  NeedOneKeyBridge = 3030,
  // TODO: remove this error code
  NeedFirmwareUpgrade = 4030,
  NeedOneKeyBridgeUpgrade = 4031,
  NeedFirmwareUpgradeFromWeb = 4032,
  DeviceMethodCallTimeout = 4080,
  FirmwareUpdateBatteryTooLow = 4081,
}

export enum EOneKeyErrorClassNames {
  OneKeyError = 'OneKeyError',
  OneKeyHardwareError = 'OneKeyHardwareError',
  UnknownHardwareError = 'UnknownHardwareError',
  OneKeyServerApiError = 'OneKeyServerApiError',
  OneKeyValidatorError = 'OneKeyValidatorError',
  OneKeyValidatorTip = 'OneKeyValidatorTip',
  OneKeyAbortError = 'OneKeyAbortError',
  OneKeyWalletConnectModalCloseError = 'OneKeyWalletConnectModalCloseError',
  OneKeyAlreadyExistWalletError = 'OneKeyAlreadyExistWalletError',
  PasswordPromptDialogCancel = 'PasswordPromptDialogCancel',
  OneKeyErrorInsufficientNativeBalance = 'OneKeyErrorInsufficientNativeBalance',
  OneKeyErrorNotImplemented = 'OneKeyErrorNotImplemented',
  OneKeyErrorAirGapAccountNotFound = 'OneKeyErrorAirGapAccountNotFound',
  OneKeyErrorScanQrCodeCancel = 'OneKeyErrorScanQrCodeCancel',
  SecureQRCodeDialogCancel = 'SecureQRCodeDialogCancel',
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
  key?: ETranslations | ETranslationsMock; // i18n key
  info?: InfoT; // i18n params
  constructorName?: string;
  /*
  error.autoToast workflow:
    UI -> BackgroundApiProxyBase.constructor -> globalErrorHandler.addListener -> error.autoToast===true -> appEventBus.emit(EAppEventBusNames.ShowToast) -> ErrorToastContainer -> appEventBus.on('ShowToast') -> Toast.show

  example: 
    ErrorToastGallery.tsx
  */
  autoToast?: boolean; // TODO move to $$config: { autoToast, reconnect }
  // ---- hardwareError props
  payload?: IOneKeyHardwareErrorPayload; // raw payload from hardware sdk error response
  reconnect?: boolean;
  $isHardwareError?: boolean;

  // ---server props
  requestId?: string;
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

export type IOneKeyRpcError = {
  req: {
    method: string;
    params: [any];
  };
  res: {
    id: number;
    jsonrpc: string;
    error: {
      code: number;
      message: string;
      data: string;
    };
  };
};
