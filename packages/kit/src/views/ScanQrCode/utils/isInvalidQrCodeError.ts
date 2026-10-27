import type { IOneKeyError } from '@onekeyhq/shared/src/errors/types/errorTypes';
import { ETranslations } from '@onekeyhq/shared/src/locale';

// The class name does not survive minification across the bg bridge; its key does.
export function isInvalidQrCodeError(error: unknown): boolean {
  return (
    (error as IOneKeyError | undefined)?.key ===
    ETranslations.feedback_invalid_qr_code
  );
}

// Parse failures a scanner may retry on the same frame. An error from the action run after a
// successful parse is never added, so a retry cannot run that action twice.
const retryableParseFailures = new WeakSet<object>();

export function markRetryableQrParseFailure(error: unknown): void {
  if (error && typeof error === 'object') retryableParseFailures.add(error);
}

export function isRetryableQrParseFailure(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    retryableParseFailures.has(error)
  );
}
