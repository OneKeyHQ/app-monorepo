import {
  HARDWARE_CLOUD_SYNC_AUTH_MESSAGE_PREFIX,
  HARDWARE_CLOUD_SYNC_MESSAGE_PREFIX,
  assertHardwareCloudSyncAuthMessage,
} from '@onekeyhq/shared/src/consts/hardwareCloudSyncConsts';
import { OneKeyError, OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import { OneKeyHardwareError } from '@onekeyhq/shared/src/errors/errors/hardwareErrors';
import type { IOneKeyError } from '@onekeyhq/shared/src/errors/types/errorTypes';
import {
  convertDeviceError,
  isOneKeyHardwareError,
} from '@onekeyhq/shared/src/errors/utils/deviceErrorUtils';
import { HardwareCloudSyncDataError } from '@onekeyhq/shared/src/hardware/hardwareCloudSyncError';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import { scrubSensitiveErrorMessageText } from '@onekeyhq/shared/src/utils/sensitiveErrorMessageUtils';

const MAX_REASON_LENGTH = 200;

function safeDeviceErrorText(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  if (
    value.includes(HARDWARE_CLOUD_SYNC_MESSAGE_PREFIX) ||
    value.includes(HARDWARE_CLOUD_SYNC_AUTH_MESSAGE_PREFIX)
  )
    return '[redacted]';
  return scrubSensitiveErrorMessageText(
    value.replace(/[a-z0-9+/=_-]{32,}/gi, '[redacted]'),
  );
}

// Keep the common hardware error's class, code and translated presentation.
// Only SDK boundaries use this: server and business errors are left untouched.
export function sanitizeHardwareCloudSyncDeviceError(
  error: unknown,
): IOneKeyError {
  const raw = error as
    | { errorCode?: number; code?: number; message?: string }
    | undefined;
  let converted: IOneKeyError;
  if (error instanceof OneKeyError || isOneKeyHardwareError(error)) {
    converted = error;
  } else if (typeof raw?.errorCode === 'number') {
    converted = convertDeviceError({
      code: raw.errorCode,
      error: safeDeviceErrorText(raw.message),
    });
  } else {
    converted = new OneKeyHardwareError({
      code: raw?.code,
      message: safeDeviceErrorText(
        typeof error === 'string' ? error : raw?.message,
      ),
    });
  }
  const info = Object.fromEntries(
    Object.entries((converted.info ?? {}) as Record<string, unknown>)
      .filter(
        ([, value]) => typeof value === 'string' || typeof value === 'number',
      )
      .map(([key, value]) => [
        key,
        typeof value === 'string' ? safeDeviceErrorText(value) : value,
      ]),
  );
  const safe = Object.create(Object.getPrototypeOf(converted)) as IOneKeyError;
  return Object.assign(safe, {
    name: converted.name,
    className: converted.className,
    key: converted.key,
    code: converted.code,
    message: safeDeviceErrorText(converted.message),
    autoToast: converted.autoToast,
    reconnect: converted.reconnect,
    $isHardwareError: converted.$isHardwareError,
    disableFallbackMessage: converted.disableFallbackMessage,
    info: converted.info === undefined ? undefined : info,
    payload: converted.payload
      ? {
          code: converted.payload.code,
          error: safeDeviceErrorText(converted.payload.error),
          message: safeDeviceErrorText(converted.payload.message),
          connectId: converted.payload.connectId,
          deviceId: converted.payload.deviceId,
          appName: converted.payload.appName,
          recovery: converted.payload.recovery
            ? { scope: converted.payload.recovery.scope }
            : undefined,
        }
      : undefined,
  });
}

// An internal check of ours failed. Callers turn it into a generic message for
// the user; its reason is safe to log.
export class HardwareCloudSyncCheckError extends OneKeyLocalError {
  readonly reason: string;

  constructor(reason: string) {
    super(reason);
    this.reason = reason;
  }
}

function describeFailure(reason: unknown): string {
  if (typeof reason === 'string') return reason;
  if (
    reason instanceof HardwareCloudSyncDataError ||
    reason instanceof HardwareCloudSyncCheckError
  ) {
    return reason.reason;
  }
  // Anything else may come from the SDK, whose messages and fields can carry
  // request or response data: log only its type and code.
  const error = reason as Partial<IOneKeyError> | undefined;
  return (
    [error?.className ?? error?.name, error?.code]
      .filter((part) => part !== undefined && part !== '')
      .join(' | ') || 'unknown error'
  );
}

// Users see a plain message; the specific reason goes only to the local log.
export function logHardwareCloudSyncFailure(stage: string, reason: unknown) {
  defaultLogger.app.error.log(
    `[HardwareCloudSync] ${stage}: ${describeFailure(reason).slice(
      0,
      MAX_REASON_LENGTH,
    )}`,
  );
}

export function createHardwareCloudSyncDataError(
  reason: string,
): HardwareCloudSyncDataError {
  logHardwareCloudSyncFailure('Data check failed', reason);
  return new HardwareCloudSyncDataError(reason);
}

// Validate the fixed sign-in template before it can reach the device.
export function assertHardwareCloudSyncAuthTemplate(message: string): void {
  try {
    assertHardwareCloudSyncAuthMessage(message);
  } catch {
    throw createHardwareCloudSyncDataError(
      'Invalid Cloud sync sign-in challenge: template mismatch',
    );
  }
}
