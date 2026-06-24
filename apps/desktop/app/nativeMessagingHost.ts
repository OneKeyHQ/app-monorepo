import { app } from 'electron';

import {
  DesktopSafeStorageNativeError,
  decryptDesktopSafeStorageString,
  encryptDesktopSafeStorageString,
  isDesktopSafeStorageAvailable,
} from '@onekeyhq/kit-bg/src/desktopApis/DesktopApiSafeStorageNative';
import {
  ONEKEY_DESKTOP_NATIVE_MESSAGING_EXTENSION_IDS_ENV,
  getDesktopNativeMessagingAllowedExtensionIds,
  parseDesktopNativeMessagingExtensionOrigin,
} from '@onekeyhq/shared/src/consts/desktopNativeMessaging';
import type {
  IDesktopNativeMessagingErrorCode,
  IDesktopNativeMessagingRequest,
  IDesktopNativeMessagingResponse,
  IDesktopNativeSafeStorageDecryptStringParams,
  IDesktopNativeSafeStorageEncryptStringParams,
} from '@onekeyhq/shared/src/desktopNativeMessaging/types';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';

type IDesktopNativeMessagingResponseError = Extract<
  IDesktopNativeMessagingResponse,
  { success: false }
>['error'];

type IDesktopNativeMessagingContext = {
  callerExtensionId: string;
};

const MAX_NATIVE_MESSAGE_BYTES = 1024 * 1024;

const STANDARD_ERROR_MESSAGES: Record<
  IDesktopNativeMessagingErrorCode,
  string
> = {
  BAD_REQUEST: 'Bad request',
  INTERNAL_ERROR: 'Internal error',
  NATIVE_HOST_FORBIDDEN: 'Native host forbidden',
  NATIVE_HOST_NO_RESPONSE: 'Native host did not respond',
  NATIVE_HOST_UNAVAILABLE: 'Native host is unavailable',
  NATIVE_MESSAGING_API_UNAVAILABLE: 'Native Messaging API is unavailable',
  OWNER_AUTH_FAILED: 'Owner authentication failed',
  SAFE_STORAGE_DECRYPT_FAILED: 'Safe storage decrypt failed',
  SAFE_STORAGE_UNAVAILABLE: 'Safe storage is unavailable',
  SAFE_STORAGE_VALUE_TOO_LARGE: 'Safe storage value is too large',
  UNSUPPORTED: 'Unsupported',
};

// Native Messaging intentionally exposes only owner-bound safeStorage crypto:
// each encrypted blob records the extension public key that owns it, and
// decrypt requires a signature from the matching non-extractable browser
// CryptoKey. Generic keychain or secureStorage read/write APIs must not be
// added here without a pairing/session design and a security review.

class DesktopNativeMessagingError extends OneKeyLocalError {
  readonly errorCode: IDesktopNativeMessagingErrorCode;

  constructor(errorCode: IDesktopNativeMessagingErrorCode) {
    super(errorCode);
    this.errorCode = errorCode;
  }
}

function writeNativeMessage(message: IDesktopNativeMessagingResponse) {
  try {
    const body = Buffer.from(JSON.stringify(message), 'utf8');
    const header = Buffer.alloc(4);
    header.writeUInt32LE(body.length, 0);
    process.stdout.write(Buffer.concat([header, body]));
  } catch {
    // Chrome may have closed the stdout pipe (EPIPE); nothing more to do.
  }
}

function getRecordParam(params: unknown): Record<string, unknown> {
  if (!params || typeof params !== 'object' || Array.isArray(params)) {
    throw new DesktopNativeMessagingError('BAD_REQUEST');
  }
  return params as Record<string, unknown>;
}

function getStringParam(params: Record<string, unknown>, name: string): string {
  const value = params[name];
  if (typeof value !== 'string') {
    throw new DesktopNativeMessagingError('BAD_REQUEST');
  }
  return value;
}

function getRequiredStringParam(
  params: Record<string, unknown>,
  name: string,
): string {
  const value = getStringParam(params, name);
  if (!value) {
    throw new DesktopNativeMessagingError('BAD_REQUEST');
  }
  return value;
}

function getSafeStorageEncryptStringParams(
  params: unknown,
): IDesktopNativeSafeStorageEncryptStringParams {
  const record = getRecordParam(params);
  return {
    ...record,
    purpose: getRequiredStringParam(record, 'purpose'),
    value: getStringParam(record, 'value'),
  } as IDesktopNativeSafeStorageEncryptStringParams;
}

function getSafeStorageDecryptStringParams(
  params: unknown,
): IDesktopNativeSafeStorageDecryptStringParams {
  const record = getRecordParam(params);
  return {
    ...record,
    purpose: getRequiredStringParam(record, 'purpose'),
    encryptedText: getRequiredStringParam(record, 'encryptedText'),
  } as IDesktopNativeSafeStorageDecryptStringParams;
}

function ensureDesktopSafeStorageSupported() {
  if (!isDesktopSafeStorageAvailable()) {
    throw new DesktopNativeMessagingError('SAFE_STORAGE_UNAVAILABLE');
  }
}

// OneKey's dev desktop reports app.isPackaged === true even when running
// unpackaged via `electron <script>`, so app.isPackaged is NOT a reliable dev
// signal here. process.defaultApp is true only for an unpackaged/dev run.
function isDesktopDevRuntime(): boolean {
  return process.defaultApp === true;
}

function getAllowedNativeMessagingExtensionIds() {
  const isDevRuntime = isDesktopDevRuntime();
  const envExtensionIds = isDevRuntime
    ? process.env[ONEKEY_DESKTOP_NATIVE_MESSAGING_EXTENSION_IDS_ENV]
    : undefined;
  return getDesktopNativeMessagingAllowedExtensionIds({
    includeDevExtensionIds: isDevRuntime,
    envExtensionIds,
  });
}

function getCallerExtensionId() {
  for (const arg of process.argv) {
    const extensionId = parseDesktopNativeMessagingExtensionOrigin(arg);
    if (extensionId) {
      return extensionId;
    }
  }
  return undefined;
}

function getAllowedNativeMessagingCallerExtensionId() {
  const callerExtensionId = getCallerExtensionId();
  if (
    !callerExtensionId ||
    !getAllowedNativeMessagingExtensionIds().includes(callerExtensionId)
  ) {
    throw new DesktopNativeMessagingError('NATIVE_HOST_FORBIDDEN');
  }
  return callerExtensionId;
}

async function handleNativeMessagingRequest(
  request: IDesktopNativeMessagingRequest,
  context: IDesktopNativeMessagingContext,
): Promise<unknown> {
  switch (request.method) {
    case 'ping':
      return {
        pong: true,
        host: 'desktop-native-messaging',
      };
    case 'safeStorageIsAvailable':
      return isDesktopSafeStorageAvailable();
    case 'safeStorageEncryptString':
      ensureDesktopSafeStorageSupported();
      return encryptDesktopSafeStorageString(
        getSafeStorageEncryptStringParams(request.params),
        {
          callerExtensionId: context.callerExtensionId,
        },
      );
    case 'safeStorageDecryptString':
      ensureDesktopSafeStorageSupported();
      return decryptDesktopSafeStorageString(
        getSafeStorageDecryptStringParams(request.params),
        {
          callerExtensionId: context.callerExtensionId,
        },
      );
    default:
      throw new DesktopNativeMessagingError('BAD_REQUEST');
  }
}

function normalizeError(error: unknown): IDesktopNativeMessagingResponseError {
  if (error instanceof DesktopNativeMessagingError) {
    return {
      code: error.errorCode,
      message: STANDARD_ERROR_MESSAGES[error.errorCode],
      unsupported:
        error.errorCode === 'UNSUPPORTED' ||
        error.errorCode === 'SAFE_STORAGE_UNAVAILABLE',
    };
  }
  if (error instanceof DesktopSafeStorageNativeError) {
    return {
      code: error.errorCode,
      message: STANDARD_ERROR_MESSAGES[error.errorCode],
      unsupported: error.errorCode === 'SAFE_STORAGE_UNAVAILABLE',
    };
  }
  if (error instanceof SyntaxError) {
    return {
      code: 'BAD_REQUEST',
      message: STANDARD_ERROR_MESSAGES.BAD_REQUEST,
    };
  }
  return {
    code: 'INTERNAL_ERROR',
    message: STANDARD_ERROR_MESSAGES.INTERNAL_ERROR,
  };
}

async function handleAndReply(
  request: IDesktopNativeMessagingRequest,
  context: IDesktopNativeMessagingContext,
) {
  try {
    const payload = await handleNativeMessagingRequest(request, context);
    writeNativeMessage({
      id: request.id,
      success: true,
      payload,
    });
  } catch (error) {
    writeNativeMessage({
      id: request.id,
      success: false,
      error: normalizeError(error),
    });
  }
}

export async function runDesktopNativeMessagingHost() {
  // Dev-only for now: refuse to serve safeStorage over Native Messaging in
  // packaged/production builds, even if a stale dev manifest spawned us. See the
  // header of @onekeyhq/shared/src/consts/desktopNativeMessaging for the security
  // model (same-user host impersonation risk) and the production checklist.
  if (!isDesktopDevRuntime()) {
    app.exit(0);
    return;
  }

  let callerExtensionId: string;
  try {
    callerExtensionId = getAllowedNativeMessagingCallerExtensionId();
  } catch (error) {
    writeNativeMessage({
      success: false,
      error: normalizeError(error),
    });
    app.exit(1);
    return;
  }

  const context: IDesktopNativeMessagingContext = {
    callerExtensionId,
  };

  await app.whenReady();
  if (process.platform === 'darwin') {
    app.dock?.hide();
  }

  let inputBuffer = Buffer.alloc(0);
  let processingQueue = Promise.resolve();

  process.stdin.on('data', (chunk: Buffer) => {
    inputBuffer = Buffer.concat([inputBuffer, chunk]);
    while (inputBuffer.length >= 4) {
      const messageLength = inputBuffer.readUInt32LE(0);
      if (messageLength > MAX_NATIVE_MESSAGE_BYTES) {
        writeNativeMessage({
          success: false,
          error: normalizeError(new DesktopNativeMessagingError('BAD_REQUEST')),
        });
        app.exit(1);
        return;
      }
      if (inputBuffer.length < messageLength + 4) {
        return;
      }

      const body = inputBuffer.subarray(4, messageLength + 4).toString('utf8');
      inputBuffer = inputBuffer.subarray(messageLength + 4);

      processingQueue = processingQueue.then(async () => {
        try {
          const request = JSON.parse(body) as IDesktopNativeMessagingRequest;
          await handleAndReply(request, context);
        } catch (error) {
          writeNativeMessage({
            success: false,
            error: normalizeError(error),
          });
        }
      });
    }
  });

  process.stdin.on('end', () => {
    void processingQueue.finally(() => app.exit(0));
  });

  process.stdin.resume();
}
