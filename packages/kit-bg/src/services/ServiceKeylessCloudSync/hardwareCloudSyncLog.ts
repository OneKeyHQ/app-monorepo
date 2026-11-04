import { assertHardwareCloudSyncAuthMessage } from '@onekeyhq/shared/src/consts/hardwareCloudSyncConsts';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import type { IOneKeyError } from '@onekeyhq/shared/src/errors/types/errorTypes';
import { HardwareCloudSyncDataError } from '@onekeyhq/shared/src/hardware/hardwareCloudSyncError';
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
