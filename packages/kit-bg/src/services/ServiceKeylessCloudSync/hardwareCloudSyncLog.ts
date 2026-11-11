import { EDeviceType, EFirmwareType } from '@onekeyfe/hd-shared';

import {
  HARDWARE_CLOUD_SYNC_AUTH_MESSAGE_PREFIX,
  HARDWARE_CLOUD_SYNC_KEY_ENVELOPE_DATA_TYPE,
  HARDWARE_CLOUD_SYNC_MESSAGE_PREFIX,
  assertHardwareCloudSyncAuthMessage,
} from '@onekeyhq/shared/src/consts/hardwareCloudSyncConsts';
import { OneKeyError, OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import { OneKeyHardwareError } from '@onekeyhq/shared/src/errors/errors/hardwareErrors';
import { EOneKeyErrorClassNames } from '@onekeyhq/shared/src/errors/types/errorTypes';
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
import stringUtils from '@onekeyhq/shared/src/utils/stringUtils';
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
  } else if (
    typeof raw?.errorCode === 'number' ||
    typeof raw?.code === 'number'
  ) {
    converted = convertDeviceError(
      {
        code: raw.errorCode ?? raw.code,
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

// Only aggregate state may cross this logging boundary. Never add an ID, hash,
// message, request, response, or cryptographic value to this allowlist.
const DIAGNOSTIC_BOOLEAN_FIELDS = [
  'transportFailure',
  'timeout',
  'hasServerDataArray',
  'existingSigningPublicKeyEmpty',
  'currentSigningPublicKeyEmpty',
  'force',
  'unauthorized',
  'clockRetry',
  'hasLock',
  'historyCompleteKnown',
  'previousCurrentEnvelopeIncluded',
  'existingHashKnown',
  'signingPublicKeyMatches',
  'rebuildsLocalItemsNow',
  'localHashesKnown',
  'hasCredential',
  'sessionMatches',
  'hasRefreshToken',
  'expired',
  'refreshNeeded',
  'isCurrent',
  'rebuildsLocalItems',
  'hasExistingCredential',
  'localItemsMismatch',
  'existingPwdHashMismatch',
  'existingSigningPublicKeyMismatch',
  'forceRequested',
  'sessionEnding',
  'refreshInFlight',
  'hasSession',
  'refreshedSession',
  'deletionAllowed',
  'currentSession',
  'retryAllowed',
  'hasPushedPwdHash',
  'pwdHashMatches',
  'hasPushedSessionId',
] as const;
const DIAGNOSTIC_COUNT_FIELDS = [
  'generation',
  'minGeneration',
  'previousGeneration',
  'nextGeneration',
  'returnedCount',
  'requestedLimit',
  'start',
  'page',
  'totalCount',
  'envelopeCount',
  'validEnvelopeCount',
  'invalidEnvelopeCount',
  'missingEnvelopeCount',
  'currentEnvelopeCount',
  'previousEnvelopeCount',
  'uniquePreviousCount',
  'inputEnvelopeCount',
  'outputEnvelopeCount',
  'localItemCount',
  'recoveredLocalItemCount',
  'unknownLocalHashCount',
  'knownHashCount',
  'ignoredLegacyLockCount',
  'attempt',
  'httpStatus',
  'businessCode',
  'mismatchedItemCount',
  'mismatchedDeletedCount',
  'mismatchedLiveCount',
  'mismatchedLockCount',
  'mismatchedDeletedLockCount',
  'mismatchedEnvelopeCount',
  'mismatchedDeletedEnvelopeCount',
  'mismatchedWalletCount',
  'mismatchedDeletedWalletCount',
  'mismatchedAccountCount',
  'mismatchedDeletedAccountCount',
  'mismatchedOtherCount',
  'mismatchedDeletedOtherCount',
  'invalidJsonCount',
  'invalidShapeCount',
  'invalidVersionCount',
  'invalidIdCount',
  'invalidSaltCount',
  'invalidGenerationCount',
  'missingWrappedKeyCount',
] as const;

const DIAGNOSTIC_STAGES = new Set([
  'bootstrap_derive_kek_started',
  'bootstrap_existing_lock',
  'bootstrap_unwrap_started',
  'bootstrap_unwrap_succeeded',
  'business_unauthorized_response_refresh_requested',
  'business_unauthorized_response_retry_decision',
  'credential_refresh_failed',
  'credential_refresh_joined_shared_promise',
  'credential_refresh_precheck',
  'credential_refresh_result',
  'credential_refresh_reused_stored_session',
  'credential_storage_decrypt_failed',
  'credential_storage_parse_failed',
  'credential_storage_read_failed',
  'delete_credential_after_disabling_sync',
  'delete_credential_after_incomplete_key_commit',
  'flush_push_precheck',
  'history_download_received',
  'history_received_completeness_unknown',
  'lock_parsed',
  'lock_received',
  'request_challenge',
  'request_check',
  'request_clock_retry',
  'request_clock_retry_failed',
  'request_clock_retry_skipped',
  'request_clock_retry_success',
  'request_download',
  'request_failed',
  'request_flush',
  'request_lock',
  'request_other',
  'request_refresh',
  'request_revoke',
  'request_upload',
  'request_verify',
  'reset_download_received',
  'restore_key_compatibility_guard',
  'revoke_session_completed',
  'revoke_session_failed',
  'revoke_session_precheck',
  'rotation_flush_accepted',
  'rotation_prepared',
  'session_revoked_push_precheck',
  'sign_in_credential_deleted',
  'sign_in_credential_deletion_guard',
  'sign_in_required_after_server_data_key_changed',
  'sign_in_required_after_unauthorized_refresh',
]);

type IDiagnosticFields =
  | Record<string, unknown>
  | (() => Record<string, unknown>);

function writeHardwareCloudSyncDiagnostic(
  stage: string,
  input: IDiagnosticFields,
  operationId?: string,
) {
  try {
    // Stages are code-owned literals, never external error descriptions.
    if (!DIAGNOSTIC_STAGES.has(stage)) return;
    const fields = typeof input === 'function' ? input() : input;
    const safe: Record<string, boolean | number | string> = {};
    for (const key of DIAGNOSTIC_BOOLEAN_FIELDS) {
      if (typeof fields[key] === 'boolean') safe[key] = fields[key];
    }
    for (const key of DIAGNOSTIC_COUNT_FIELDS) {
      const value = fields[key];
      if (
        typeof value === 'number' &&
        Number.isSafeInteger(value) &&
        value >= 0
      ) {
        safe[key] = value;
      }
    }
    // Generated per operation, never derived from a wallet/device/session.
    if (operationId) safe.operationId = operationId;
    defaultLogger.app.error.log(
      `[HardwareCloudSyncDiagnostic] ${stage} ${JSON.stringify(safe)}`,
    );
  } catch {
    // Logging must not change authentication, storage, or recovery behavior.
  }
}

export function logHardwareCloudSyncDiagnostic(
  stage: string,
  fields: IDiagnosticFields = {},
) {
  writeHardwareCloudSyncDiagnostic(stage, fields);
}

export function createHardwareCloudSyncDiagnostic() {
  let operationId: string | undefined;
  try {
    operationId = stringUtils.randomString(12);
  } catch {
    // Randomness unavailable must never block the real operation.
  }
  return (stage: string, fields: IDiagnosticFields = {}) =>
    writeHardwareCloudSyncDiagnostic(stage, fields, operationId);
}

// Server messages and Axios config may contain secrets. Classify only known
// codes and HTTP status; a 90700 never proves which server auth check failed.
export function getHardwareCloudSyncErrorDiagnostics(
  error: unknown,
): Record<string, unknown> {
  try {
    const value = error as
      | {
          code?: unknown;
          className?: unknown;
          httpStatusCode?: unknown;
          response?: { status?: unknown };
        }
      | undefined;
    const code = value?.code;
    const normalizedStatus = value?.httpStatusCode;
    const status =
      typeof normalizedStatus === 'number' &&
      Number.isInteger(normalizedStatus) &&
      normalizedStatus >= 100 &&
      normalizedStatus <= 599
        ? normalizedStatus
        : value?.response?.status;
    return {
      businessCode:
        typeof code === 'number' && code >= 90_700 && code <= 90_706
          ? code
          : undefined,
      httpStatus:
        typeof status === 'number' && status >= 100 && status <= 599
          ? status
          : undefined,
      transportFailure:
        code === 'ERR_NETWORK' ||
        value?.className === EOneKeyErrorClassNames.AxiosNetworkError,
      timeout: code === 'ECONNABORTED' || code === 'ETIMEDOUT',
    };
  } catch {
    return {};
  }
}

function getRestoreDiagnosticCategory(dataType?: string) {
  switch (dataType) {
    case 'Lock':
      return 'Lock';
    case HARDWARE_CLOUD_SYNC_KEY_ENVELOPE_DATA_TYPE:
      return 'Envelope';
    case 'Wallet':
      return 'Wallet';
    case 'IndexedAccount':
    case 'Account':
      return 'Account';
    default:
      return 'Other';
  }
}

// The allowlisted categories describe schema types, not user-provided data.
// Unknown types collapse to Other and never become log keys or text.
export function summarizeHardwareCloudSyncRestoreItems(
  items: ReadonlyArray<{
    pwdHash?: string;
    dataType?: string;
    isDeleted?: boolean;
  }>,
  knownPwdHashes: ReadonlySet<string>,
): Record<string, number> {
  const counts = {
    mismatchedItemCount: 0,
    mismatchedDeletedCount: 0,
    mismatchedLiveCount: 0,
    mismatchedLockCount: 0,
    mismatchedDeletedLockCount: 0,
    mismatchedEnvelopeCount: 0,
    mismatchedDeletedEnvelopeCount: 0,
    mismatchedWalletCount: 0,
    mismatchedDeletedWalletCount: 0,
    mismatchedAccountCount: 0,
    mismatchedDeletedAccountCount: 0,
    mismatchedOtherCount: 0,
    mismatchedDeletedOtherCount: 0,
  };
  for (const item of items) {
    if (item.pwdHash && !knownPwdHashes.has(item.pwdHash)) {
      counts.mismatchedItemCount += 1;
      if (item.isDeleted) counts.mismatchedDeletedCount += 1;
      else counts.mismatchedLiveCount += 1;
      const category = getRestoreDiagnosticCategory(item.dataType);
      counts[`mismatched${category}Count`] += 1;
      if (item.isDeleted) counts[`mismatchedDeleted${category}Count`] += 1;
    }
  }
  return counts;
}
