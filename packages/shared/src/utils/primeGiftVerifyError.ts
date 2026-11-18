import { HardwareErrorCode } from '@onekeyfe/hd-shared';

import {
  EOneKeyErrorClassNames,
  type IOneKeyError,
} from '../errors/types/errorTypes';
import { isHardwareErrorByCode } from '../errors/utils/deviceErrorUtils';
import errorToastUtils from '../errors/utils/errorToastUtils';

const PRIME_GIFT_DEVICE_CANCEL_CODES: Array<number | string> = [
  HardwareErrorCode.ActionCancelled,
  HardwareErrorCode.CallQueueActionCancelled,
  HardwareErrorCode.PinCancelled,
];

const ALLOWED_ERROR_NAMES = new Set<string>([
  ...Object.values(EOneKeyErrorClassNames),
  'Error',
]);

const HARDWARE_ERROR_CODE_VALUES = new Set<number>(
  Object.values(HardwareErrorCode),
);

export type IPrimeGiftVerifyFailureReason =
  | 'usbReadFailed'
  | 'firmwareVerificationFailed'
  | 'unknown';

export type IPrimeGiftVerifyFailureLogPayload = {
  reason: IPrimeGiftVerifyFailureReason;
  errorName?: string;
  errorCode?: number;
};

function asOneKeyError(error: unknown): IOneKeyError | undefined {
  if (!error || typeof error !== 'object') {
    return undefined;
  }
  return error as IOneKeyError;
}

export function isPrimeGiftVerifyCancellationError(error: unknown): boolean {
  if (errorToastUtils.isUserCancelStyleError(error)) {
    return true;
  }
  return Boolean(
    isHardwareErrorByCode({
      error: asOneKeyError(error),
      code: PRIME_GIFT_DEVICE_CANCEL_CODES,
    }),
  );
}

function readErrorTextForClassification(
  error: IOneKeyError | undefined,
): string {
  const cause =
    error?.cause && typeof error.cause === 'object'
      ? (error.cause as { message?: unknown })
      : undefined;
  return [
    error?.message,
    error?.payload?.message,
    error?.payload?.error,
    cause?.message,
  ]
    .filter((value): value is string => typeof value === 'string')
    .join(' ');
}

function getPrimeGiftVerifyFailureReason(
  error: IOneKeyError | undefined,
): IPrimeGiftVerifyFailureReason {
  const text = readErrorTextForClassification(error);
  if (/usb read failed/i.test(text)) {
    return 'usbReadFailed';
  }
  if (
    error?.className === EOneKeyErrorClassNames.OneKeyServerApiError ||
    error?.name === EOneKeyErrorClassNames.OneKeyServerApiError ||
    /firmware verification/i.test(text)
  ) {
    return 'firmwareVerificationFailed';
  }
  return 'unknown';
}

function getAllowlistedErrorName(
  error: IOneKeyError | undefined,
): string | undefined {
  if (error?.className && ALLOWED_ERROR_NAMES.has(error.className)) {
    return error.className;
  }
  if (error?.name && ALLOWED_ERROR_NAMES.has(error.name)) {
    return error.name;
  }
  return undefined;
}

function getSafeErrorCode(error: IOneKeyError | undefined): number | undefined {
  const candidates = [error?.code, error?.payload?.code];
  const hardwareCode = candidates.find(
    (candidate): candidate is number =>
      typeof candidate === 'number' &&
      HARDWARE_ERROR_CODE_VALUES.has(candidate),
  );
  if (hardwareCode !== undefined) {
    return hardwareCode;
  }
  for (const candidate of candidates) {
    if (
      typeof candidate === 'number' &&
      Number.isSafeInteger(candidate) &&
      // OneKeyError uses -99999 when the caller omitted a real code.
      candidate !== -99_999
    ) {
      return candidate;
    }
  }
  return undefined;
}

export function getPrimeGiftVerifyFailureLogPayload(
  error: unknown,
): IPrimeGiftVerifyFailureLogPayload {
  const oneKeyError = asOneKeyError(error);
  const payload: IPrimeGiftVerifyFailureLogPayload = {
    reason: getPrimeGiftVerifyFailureReason(oneKeyError),
  };
  const errorName = getAllowlistedErrorName(oneKeyError);
  if (errorName) {
    payload.errorName = errorName;
  }
  const errorCode = getSafeErrorCode(oneKeyError);
  if (errorCode !== undefined) {
    payload.errorCode = errorCode;
  }
  return payload;
}
