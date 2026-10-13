import {
  PRIME_FREE_TRIAL_NOT_OPEN_CODE,
  PRIME_FREE_TRIAL_QUOTA_EXHAUSTED_CODE,
  isPrimeFreeTrialFeatureId,
} from '../../types/prime/primeFreeTrialTypes';
import { OneKeyLocalError } from '../errors';

import { formatDateFns } from './dateUtils';

import type {
  IPrimeFreeTrialError,
  IPrimeFreeTrialFeatureId,
  IPrimeFreeTrialFeatureQuota,
  IPrimeFreeTrialQuota,
  IPrimeFreeTrialReservation,
} from '../../types/prime/primeFreeTrialTypes';

// Reads a normalized free-trial error from anything that crossed the
// background bridge. Only `code` and `data` survive serialization on
// iOS / Android / extension, so never rely on instanceof here.
export function getPrimeFreeTrialError(
  error: unknown,
): IPrimeFreeTrialError | undefined {
  const e = error as { code?: unknown; data?: unknown } | undefined;
  const code = Number(e?.code);
  if (
    code !== PRIME_FREE_TRIAL_QUOTA_EXHAUSTED_CODE &&
    code !== PRIME_FREE_TRIAL_NOT_OPEN_CODE
  ) {
    return undefined;
  }
  const data = e?.data as { featureId?: unknown } | undefined;
  if (!isPrimeFreeTrialFeatureId(data?.featureId)) {
    return undefined;
  }
  return { code, data } as IPrimeFreeTrialError;
}

// Error thrown by the background towards the UI. autoToast is off: the
// unified free-trial UI owns the feedback.
export function buildPrimeFreeTrialLocalError(
  freeTrialError: IPrimeFreeTrialError,
) {
  return new OneKeyLocalError({
    message:
      freeTrialError.code === PRIME_FREE_TRIAL_QUOTA_EXHAUSTED_CODE
        ? 'Prime free trial quota exhausted'
        : 'Prime free trial is not available',
    code: freeTrialError.code,
    data: freeTrialError.data,
    autoToast: false,
  });
}

// Whether the server said anything about reservations. Older servers omit
// the fields, and then only this device's own records can tell.
export function hasPrimeFreeTrialReservationInfo(
  reservation: IPrimeFreeTrialReservation | undefined,
) {
  return typeof reservation?.reserved === 'number';
}

// End of a live reservation that holds the quota, from the server's fields:
// undefined when nothing is held or the end has already passed.
export function getPrimeFreeTrialHeldReservationEnd(
  reservation: IPrimeFreeTrialReservation | undefined,
  now = Date.now(),
): number | undefined {
  const end = Number(reservation?.reservationExpiresAt);
  return Number(reservation?.reserved) > 0 && Number.isFinite(end) && end > now
    ? end
    : undefined;
}

export function getPrimeFreeTrialFeatureQuota({
  quota,
  featureId,
}: {
  quota: IPrimeFreeTrialQuota | null | undefined;
  featureId: IPrimeFreeTrialFeatureId;
}): IPrimeFreeTrialFeatureQuota | undefined {
  return quota?.features?.find((item) => item.featureId === featureId);
}

// Free-trial times follow the app language (date-fns localized patterns, as
// the Prime expiry date does), in the user's local time zone.
function formatPrimeFreeTrialTime(time: number | undefined, pattern: string) {
  if (!time || !Number.isFinite(time)) {
    return undefined;
  }
  const text = formatDateFns(new Date(time), pattern);
  // formatDateFns returns '-' when formatting fails.
  return text === '-' ? undefined : text;
}

export function formatPrimeFreeTrialResetDate(resetAt: number | undefined) {
  return formatPrimeFreeTrialTime(resetAt, 'PPp');
}

// A reservation ends at most 30 minutes later, so the time alone is enough.
export function formatPrimeFreeTrialReservationEnd(end: number | undefined) {
  return formatPrimeFreeTrialTime(end, 'p');
}
