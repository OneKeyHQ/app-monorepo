import { format as fnsFormat } from 'date-fns';

import {
  PRIME_FREE_TRIAL_NOT_OPEN_CODE,
  PRIME_FREE_TRIAL_QUOTA_EXHAUSTED_CODE,
  isPrimeFreeTrialFeatureId,
} from '../../types/prime/primeFreeTrialTypes';
import { OneKeyLocalError } from '../errors';
import { DateLocaleMap } from '../locale/dateLocaleMap';

import type {
  IPrimeFreeTrialError,
  IPrimeFreeTrialFeatureId,
  IPrimeFreeTrialFeatureQuota,
  IPrimeFreeTrialQuota,
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

export function getPrimeFreeTrialFeatureQuota({
  quota,
  featureId,
}: {
  quota: IPrimeFreeTrialQuota | null | undefined;
  featureId: IPrimeFreeTrialFeatureId;
}): IPrimeFreeTrialFeatureQuota | undefined {
  return quota?.features?.find((item) => item.featureId === featureId);
}

// Free-trial times are shown in a fixed English format (the free-trial copy
// is hard-coded English), in the user's local time zone.
function formatPrimeFreeTrialTime(time: number | undefined, pattern: string) {
  if (!time || !Number.isFinite(time)) {
    return undefined;
  }
  try {
    return fnsFormat(new Date(time), pattern, {
      locale: DateLocaleMap['en-US'],
    });
  } catch {
    return undefined;
  }
}

export function formatPrimeFreeTrialResetDate(resetAt: number | undefined) {
  return formatPrimeFreeTrialTime(resetAt, 'MMM d, HH:mm');
}

// A reservation ends at most 30 minutes later, so the time alone is enough.
export function formatPrimeFreeTrialReservationEnd(end: number | undefined) {
  return formatPrimeFreeTrialTime(end, 'HH:mm');
}
