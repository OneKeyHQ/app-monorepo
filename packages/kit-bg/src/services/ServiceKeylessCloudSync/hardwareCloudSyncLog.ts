import { EDeviceType, EFirmwareType } from '@onekeyfe/hd-shared';

import {
  HARDWARE_CLOUD_SYNC_AUTH_MESSAGE_PREFIX,
  HARDWARE_CLOUD_SYNC_MESSAGE_PREFIX,
  assertHardwareCloudSyncAuthMessage,
} from '@onekeyhq/shared/src/consts/hardwareCloudSyncConsts';
import { OneKeyError, OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import { OneKeyHardwareError } from '@onekeyhq/shared/src/errors/errors/hardwareErrors';
import type {
  IOneKeyError,
  IOneKeyHardwareErrorPayload,
} from '@onekeyhq/shared/src/errors/types/errorTypes';
import {
  convertDeviceError,
  isOneKeyHardwareError,
} from '@onekeyhq/shared/src/errors/utils/deviceErrorUtils';
import type { IConvertDeviceErrorOptions } from '@onekeyhq/shared/src/errors/utils/deviceErrorUtils';
import { normalizeThirdPartyHardwareRecoveryHint } from '@onekeyhq/shared/src/errors/utils/thirdPartyDeviceErrorUtils';
import { HardwareCloudSyncDataError } from '@onekeyhq/shared/src/hardware/hardwareCloudSyncError';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import { scrubSensitiveErrorMessageText } from '@onekeyhq/shared/src/utils/sensitiveErrorMessageUtils';
import type { IDeviceResponseResult } from '@onekeyhq/shared/types/device';

const MAX_REASON_LENGTH = 200;

export type IHardwareCloudSyncDiagnosticContext = {
  deviceType?: string;
  firmwareVersion?: string | null;
  protocol?: string;
  walletType?: string;
  hasPassphraseState?: boolean;
  hasDeviceId?: boolean;
  unlocked?: boolean | null;
  passphraseProtection?: boolean | null;
  attachToPinEnabled?: boolean | null;
  unlockedAttachPin?: boolean | null;
  deviceIdMatches?: boolean;
};

function safeDiagnosticContext(context: IHardwareCloudSyncDiagnosticContext) {
  const safe: Record<string, string | boolean | null> = {};
  const deviceType = Object.values(EDeviceType).find(
    (value) => value === context.deviceType,
  );
  if (deviceType) safe.deviceType = deviceType;
  if (
    typeof context.firmwareVersion === 'string' &&
    /^v?\d{1,4}\.\d{1,4}\.\d{1,4}(?:-[a-z0-9.]{1,20})?$/i.test(
      context.firmwareVersion,
    )
  ) {
    safe.firmwareVersion = context.firmwareVersion;
  }
  if (context.protocol === 'V1' || context.protocol === 'V2') {
    safe.protocol = context.protocol;
  }
  if (context.walletType === 'standard' || context.walletType === 'hidden') {
    safe.walletType = context.walletType;
  }
  for (const key of [
    'unlocked',
    'passphraseProtection',
    'attachToPinEnabled',
    'unlockedAttachPin',
    'deviceIdMatches',
    'hasPassphraseState',
    'hasDeviceId',
  ] as const) {
    const value = context[key];
    if (typeof value === 'boolean' || value === null) safe[key] = value;
  }
  return Object.keys(safe).length ? ` | ${JSON.stringify(safe)}` : '';
}

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

function safeDeviceErrorPayload(
  payload: IOneKeyHardwareErrorPayload,
  connectId?: string,
): IOneKeyHardwareErrorPayload {
  return {
    code: payload.code,
    error: safeDeviceErrorText(payload.error),
    message: safeDeviceErrorText(payload.message),
    // Only the operation's selected/resolved ID may drive recovery actions.
    connectId,
    recovery: normalizeThirdPartyHardwareRecoveryHint(payload.recovery),
  };
}

function safeDeviceErrorParams(value: unknown) {
  const params = value as
    | { require?: unknown; firmwareType?: unknown }
    | undefined;
  return {
    require:
      typeof params?.require === 'string' &&
      /^v?\d{1,4}\.\d{1,4}\.\d{1,4}(?:-[a-z0-9.]{1,20})?$/i.test(params.require)
        ? params.require
        : undefined,
    firmwareType:
      params?.firmwareType === EFirmwareType.BitcoinOnly
        ? EFirmwareType.BitcoinOnly
        : undefined,
  };
}

export function convertHardwareCloudSyncDeviceError(
  payload: IOneKeyHardwareErrorPayload,
  connectId?: string,
  options?: IConvertDeviceErrorOptions,
): IOneKeyError {
  return sanitizeHardwareCloudSyncDeviceError(
    convertDeviceError(
      {
        ...safeDeviceErrorPayload(payload, connectId),
        params: safeDeviceErrorParams(payload.params),
      },
      options,
    ),
    connectId,
  );
}

// Convert before logging or returning across RPC. The shared response wrapper
// logs thrown SDK objects before conversion, so it cannot guard this boundary.
export async function callHardwareCloudSyncDevice<T>(
  operation: () => Promise<IDeviceResponseResult<T>>,
  connectId?: string,
  options?: IConvertDeviceErrorOptions,
): Promise<T> {
  let response: IDeviceResponseResult<T>;
  try {
    response = await operation();
  } catch (error) {
    throw sanitizeHardwareCloudSyncDeviceError(error, connectId, options);
  }
  if (!response.success) {
    throw convertHardwareCloudSyncDeviceError(
      response.payload,
      connectId,
      options,
    );
  }
  return response.payload;
}

// Keep the common hardware error's class, code and translated presentation.
// Only SDK boundaries use this: server and business errors are left untouched.
export function sanitizeHardwareCloudSyncDeviceError(
  error: unknown,
  connectId?: string,
  options?: IConvertDeviceErrorOptions,
): IOneKeyError {
  const raw = error as
    | { errorCode?: number; code?: number; message?: string; params?: unknown }
    | undefined;
  let converted: IOneKeyError;
  if (error instanceof OneKeyError || isOneKeyHardwareError(error)) {
    converted = error;
  } else if (typeof raw?.errorCode === 'number') {
    converted = convertDeviceError(
      {
        code: raw.errorCode,
        error: safeDeviceErrorText(raw.message),
        params: safeDeviceErrorParams(raw.params),
        connectId,
      },
      options,
    );
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
      ? safeDeviceErrorPayload(converted.payload, connectId)
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
    [
      error?.className ?? error?.name,
      error?.code,
      typeof error?.payload?.code === 'number' &&
      Number.isFinite(error.payload.code)
        ? `sdkCode=${error.payload.code}`
        : undefined,
      error?.payload?.error === 'Failure_DataError,Forbidden key path'
        ? 'Forbidden key path'
        : undefined,
    ]
      .filter((part) => part !== undefined && part !== '')
      .join(' | ') || 'unknown error'
  );
}

// Users see a plain message; the specific reason goes only to the local log.
export function logHardwareCloudSyncFailure(
  stage: string,
  reason: unknown,
  context?: IHardwareCloudSyncDiagnosticContext,
) {
  try {
    defaultLogger.app.error.log(
      `[HardwareCloudSync] ${stage}: ${describeFailure(reason).slice(
        0,
        MAX_REASON_LENGTH,
      )}${context ? safeDiagnosticContext(context) : ''}`,
    );
  } catch {
    // Diagnostics must never replace the original operation failure.
  }
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
