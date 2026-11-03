import { assertHardwareCloudSyncAuthMessage } from '@onekeyhq/shared/src/consts/hardwareCloudSyncConsts';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import {
  PinCancelled,
  UserCancel,
} from '@onekeyhq/shared/src/errors/errors/hardwareErrors';
import type { IOneKeyError } from '@onekeyhq/shared/src/errors/types/errorTypes';
import errorToastUtils from '@onekeyhq/shared/src/errors/utils/errorToastUtils';
import { HardwareCloudKeyDeviceRejectedError } from '@onekeyhq/shared/src/hardware/hardwareCloudKeyDeviceRejectedError';
import {
  HardwareCloudSyncCancelledError,
  HardwareCloudSyncDataError,
  HardwareCloudSyncUnlockError,
} from '@onekeyhq/shared/src/hardware/hardwareCloudSyncError';
import { HardwareCloudKeyPrerequisiteError } from '@onekeyhq/shared/src/hardware/hardwareCloudSyncErrors';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';

const MAX_REASON_LENGTH = 200;

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

// Errors that already tell the user what happened, so they pass through the
// generic unlock error unchanged.
export function isHardwareCloudSyncUserFacingError(error: unknown): boolean {
  return (
    error instanceof UserCancel ||
    error instanceof PinCancelled ||
    error instanceof HardwareCloudSyncCancelledError ||
    error instanceof HardwareCloudSyncDataError ||
    errorToastUtils.isUserCancelStyleError(error)
  );
}

// The one place that decides what a device-step failure shows: errors that
// already say what happened (including an unlock error logged further down)
// pass through; anything else is logged once and becomes the unlock error,
// so SDK request or response data never travels with it.
export function rethrowAsHardwareCloudSyncUnlockError(
  stage: string,
  error: unknown,
): never {
  if (
    isHardwareCloudSyncUserFacingError(error) ||
    error instanceof HardwareCloudSyncUnlockError ||
    error instanceof HardwareCloudKeyDeviceRejectedError ||
    error instanceof HardwareCloudKeyPrerequisiteError
  ) {
    throw error;
  }
  logHardwareCloudSyncFailure(stage, error);
  throw new HardwareCloudSyncUnlockError();
}
