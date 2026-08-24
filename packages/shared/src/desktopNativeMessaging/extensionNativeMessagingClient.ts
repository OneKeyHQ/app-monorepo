import { ONEKEY_DESKTOP_NATIVE_MESSAGING_HOST_NAME } from '../consts/desktopNativeMessaging';

import {
  buildSafeStorageDecryptStringParams,
  buildSafeStorageDecryptStringParamsWithEphemeralIdentityForDevSettings,
  buildSafeStorageEncryptStringParams,
} from './safeStorageOwnerAuth';

import type {
  IDesktopNativeMessagingCallResult,
  IDesktopNativeMessagingErrorCode,
  IDesktopNativeMessagingRequest,
  IDesktopNativeMessagingResponse,
} from './types';

type IChromeRuntimeWithNativeMessaging = {
  id?: string;
  lastError?: {
    message?: string;
  };
  sendNativeMessage?: (
    application: string,
    message: unknown,
    responseCallback: (
      response?: IDesktopNativeMessagingResponse<unknown>,
    ) => void,
  ) => void;
};

type IChromeGlobalWithNativeMessaging = {
  runtime?: IChromeRuntimeWithNativeMessaging;
};

let nextRequestId = 0;

function getChromeRuntime(): IChromeRuntimeWithNativeMessaging | undefined {
  return (
    globalThis as typeof globalThis & {
      chrome?: IChromeGlobalWithNativeMessaging;
    }
  ).chrome?.runtime;
}

function getChromeRuntimeExtensionId(): string | undefined {
  return getChromeRuntime()?.id;
}

function getUnsupportedResult<T>(
  reason?: string,
  code: IDesktopNativeMessagingErrorCode | string = 'UNSUPPORTED',
): IDesktopNativeMessagingCallResult<T> {
  return {
    supported: false,
    reason,
    code,
  };
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function tamperEncryptedText(encryptedText: string): string {
  if (encryptedText.length < 2) {
    return `${encryptedText}00`;
  }
  const currentSuffix = encryptedText.slice(-2).toLowerCase();
  const replacementSuffix = currentSuffix === '00' ? 'ff' : '00';
  return `${encryptedText.slice(0, -2)}${replacementSuffix}`;
}

async function sendDesktopNativeMessage<T>(
  method: IDesktopNativeMessagingRequest['method'],
  params?: unknown,
): Promise<IDesktopNativeMessagingCallResult<T>> {
  const runtime = getChromeRuntime();
  if (!runtime?.sendNativeMessage) {
    return getUnsupportedResult(
      'nativeMessaging API is unavailable',
      'NATIVE_MESSAGING_API_UNAVAILABLE',
    );
  }
  const sendNativeMessage = runtime.sendNativeMessage.bind(runtime);

  const request: IDesktopNativeMessagingRequest = {
    id: `${Date.now()}-${nextRequestId}`,
    method,
    params,
  };
  nextRequestId += 1;

  return new Promise((resolve) => {
    try {
      sendNativeMessage(
        ONEKEY_DESKTOP_NATIVE_MESSAGING_HOST_NAME,
        request,
        (response) => {
          const lastErrorMessage = runtime.lastError?.message;
          if (lastErrorMessage) {
            resolve(
              getUnsupportedResult(lastErrorMessage, 'NATIVE_HOST_UNAVAILABLE'),
            );
            return;
          }

          if (!response) {
            resolve(
              getUnsupportedResult(
                'empty native messaging response',
                'NATIVE_HOST_NO_RESPONSE',
              ),
            );
            return;
          }

          if (response.success) {
            resolve({
              supported: true,
              payload: response.payload as T,
            });
            return;
          }

          resolve(
            getUnsupportedResult(response.error.message, response.error.code),
          );
        },
      );
    } catch (error) {
      resolve(getUnsupportedResult(getErrorMessage(error), 'UNSUPPORTED'));
    }
  });
}

async function callSafeStorageMethod<T>(
  method: 'safeStorageEncryptString' | 'safeStorageDecryptString',
  buildParams: (extensionId: string) => Promise<unknown>,
): Promise<IDesktopNativeMessagingCallResult<T>> {
  try {
    const extensionId = getChromeRuntimeExtensionId();
    if (!extensionId) {
      return getUnsupportedResult<T>(
        'extension id is unavailable',
        'NATIVE_MESSAGING_API_UNAVAILABLE',
      );
    }
    return await sendDesktopNativeMessage<T>(
      method,
      await buildParams(extensionId),
    );
  } catch (error) {
    return getUnsupportedResult<T>(getErrorMessage(error), 'UNSUPPORTED');
  }
}

const desktopNativeMessaging = {
  async ping() {
    return sendDesktopNativeMessage<{ pong: true; host: string }>('ping');
  },

  safeStorage: {
    async isAvailable() {
      return sendDesktopNativeMessage<boolean>('safeStorageIsAvailable');
    },

    async encryptString(params: { value: string; purpose?: string }) {
      return callSafeStorageMethod<string>(
        'safeStorageEncryptString',
        (extensionId) =>
          buildSafeStorageEncryptStringParams({
            extensionId,
            value: params.value,
            purpose: params.purpose,
          }),
      );
    },

    async decryptString(params: { encryptedText: string; purpose?: string }) {
      return callSafeStorageMethod<string>(
        'safeStorageDecryptString',
        (extensionId) =>
          buildSafeStorageDecryptStringParams({
            extensionId,
            encryptedText: params.encryptedText,
            purpose: params.purpose,
          }),
      );
    },

    // Dev Settings-only helper. This is not a Native Messaging host method; it
    // only composes the public safeStorage encrypt/decrypt methods for negative
    // protocol checks.
    async runDevSettingsFailureCases() {
      try {
        const extensionId = getChromeRuntimeExtensionId();
        if (!extensionId) {
          return getUnsupportedResult(
            'extension id is unavailable',
            'NATIVE_MESSAGING_API_UNAVAILABLE',
          );
        }

        const value = `safe-storage-negative-case-${Date.now()}`;
        const encryptResult = await sendDesktopNativeMessage<string>(
          'safeStorageEncryptString',
          await buildSafeStorageEncryptStringParams({
            extensionId,
            value,
          }),
        );
        if (!encryptResult.supported) {
          return encryptResult;
        }

        const tamperedEncryptedText = tamperEncryptedText(
          encryptResult.payload,
        );
        const tamperedDecryptResult = await sendDesktopNativeMessage<string>(
          'safeStorageDecryptString',
          await buildSafeStorageDecryptStringParams({
            extensionId,
            encryptedText: tamperedEncryptedText,
          }),
        );
        const ownerMismatchResult = await sendDesktopNativeMessage<string>(
          'safeStorageDecryptString',
          await buildSafeStorageDecryptStringParamsWithEphemeralIdentityForDevSettings(
            {
              extensionId,
              encryptedText: encryptResult.payload,
            },
          ),
        );

        return {
          supported: true,
          payload: {
            encryptedTextLength: encryptResult.payload.length,
            tamperedDecryptResult,
            tamperedDecryptPassed:
              !tamperedDecryptResult.supported &&
              tamperedDecryptResult.code === 'SAFE_STORAGE_DECRYPT_FAILED',
            ownerMismatchResult,
            ownerMismatchPassed:
              !ownerMismatchResult.supported &&
              ownerMismatchResult.code === 'OWNER_AUTH_FAILED',
          },
        };
      } catch (error) {
        return getUnsupportedResult(getErrorMessage(error), 'UNSUPPORTED');
      }
    },
  },
};

export default desktopNativeMessaging;
