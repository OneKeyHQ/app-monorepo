import { Toast } from '@onekeyhq/components';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import type { IOneKeyError } from '@onekeyhq/shared/src/errors/types/errorTypes';
import errorToastUtils from '@onekeyhq/shared/src/errors/utils/errorToastUtils';
import {
  markOneKeyIdFailureServerLogged as markOneKeyIdFailureServerLoggedSerializable,
  toPlainErrorObject,
  wasOneKeyIdFailureServerLogged as wasOneKeyIdFailureServerLoggedSerializable,
} from '@onekeyhq/shared/src/errors/utils/errorUtils';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';

import { scrubSensitiveErrorMessageText } from '../../../utils/sensitiveErrorMessageUtils';

import type { IntlShape } from 'react-intl';

export { scrubSensitiveErrorMessageText } from '../../../utils/sensitiveErrorMessageUtils';

const oneKeyIdFailureServerLoggedErrors = new WeakSet<object>();
const oneKeyIdFailureReasonLoggedErrors = new WeakSet<object>();

// Mark an error whose reason was ALREADY sent to @LogToServer at its source
// (e.g. persistKeylessOAuthSession's onekeyIdSessionPersistFailed), so the
// fallback toast below does not emit a second, duplicate server event for the
// same failure.
export function markOneKeyIdFailureServerLogged(error: unknown) {
  if (error && typeof error === 'object') {
    oneKeyIdFailureServerLoggedErrors.add(error);
    markOneKeyIdFailureServerLoggedSerializable(error);
  }
}

export function wasOneKeyIdFailureServerLogged(error: unknown): boolean {
  if (!error || typeof error !== 'object') {
    return false;
  }
  return (
    oneKeyIdFailureServerLoggedErrors.has(error) ||
    wasOneKeyIdFailureServerLoggedSerializable(error)
  );
}

// Extract a human-readable reason from any throwable — Error/OneKeyError via
// the shared toPlainErrorObject, plain strings verbatim — so unstructured
// throws (the ones most needing diagnosis) do not collapse to 'unknown'.
function getLoginFailureReason(error: unknown): string | undefined {
  const message = toPlainErrorObject(error as IOneKeyError)?.message;
  if (typeof message === 'string' && message) {
    return message;
  }
  if (typeof error === 'string' && error) {
    return error;
  }
  return undefined;
}

export function showOneKeyIdLoginSuccessToast(intl: IntlShape) {
  Toast.success({
    title: intl.formatMessage({ id: ETranslations.id_login_success }),
  });
}

export function showOneKeyIdLoginFailedToast({
  error,
  intl,
}: {
  error: unknown;
  intl: IntlShape;
}) {
  const err = error as IOneKeyError | undefined;
  if (errorToastUtils.isUserCancelStyleError(error)) {
    return;
  }

  const errorMessage = getLoginFailureReason(error);
  const safeErrorMessage = errorMessage
    ? scrubSensitiveErrorMessageText(errorMessage)
    : undefined;

  // The global auto-toast path only emits UI state. Preserve the underlying
  // reason before skipping this fallback toast, unless the source already
  // wrote an equivalent server event.
  if (errorToastUtils.wasAutoToastShown(error) || err?.autoToast === false) {
    if (!wasOneKeyIdFailureServerLogged(error)) {
      logOneKeyIdLoginFailureReason(
        `OneKey ID fallback toast skipped: ${
          safeErrorMessage ||
          scrubSensitiveErrorMessageText(err?.className || 'unknown')
        }`,
        error,
      );
    }
    return;
  }

  // Skip when the source already logged this reason to the server
  // (persistKeylessOAuthSession) to avoid a duplicate @LogToServer event.
  if (!wasOneKeyIdFailureServerLogged(error)) {
    defaultLogger.prime.subscription.onekeyIdLoginFailedToast({
      reason:
        safeErrorMessage ||
        scrubSensitiveErrorMessageText(err?.className || 'unknown'),
    });
  }

  Toast.error({
    title:
      safeErrorMessage ||
      intl.formatMessage({
        id: ETranslations.global_unknown_error_retry_message,
      }),
  });

  // This fallback toast has now surfaced the error. Mark it so the global
  // unhandledrejection handler (autoToast errors flow there when a caller
  // rethrows into a `void`ed promise) does not show a second toast for it.
  // Objects only: writing a property on a string/primitive throwable would
  // itself throw in strict mode (same guard as markOneKeyIdFailureServerLogged).
  if (err && typeof err === 'object') {
    try {
      (
        err as IOneKeyError & { $$autoToastErrorTriggered?: boolean }
      ).$$autoToastErrorTriggered = true;
    } catch {
      // Some third-party errors are frozen; the fallback toast already won.
    }
  }
}

// Shared sanitizer for auth/OAuth SDK errors: bounds what reaches logs to a
// fixed field allowlist, with free-text `message` additionally scrubbed of
// secrets (see scrubSensitiveErrorMessageText).
export function getSanitizedAuthErrorLogFields(error: unknown) {
  const safeError = error as {
    name?: unknown;
    message?: unknown;
    code?: unknown;
    status?: unknown;
    httpStatusCode?: unknown;
    requestId?: unknown;
  };
  return {
    name: String(safeError?.name || ''),
    message: scrubSensitiveErrorMessageText(
      String(safeError?.message || 'unknown'),
    ),
    code: String(safeError?.code || ''),
    status: String(safeError?.status || safeError?.httpStatusCode || ''),
    requestId: String(safeError?.requestId || ''),
  };
}

export function getSanitizedAuthErrorText(error: unknown): string {
  const fields = getSanitizedAuthErrorLogFields(error);
  return `name=${fields.name} message=${fields.message} code=${fields.code} status=${fields.status} requestId=${fields.requestId}`;
}

// Record the stable English failure reason to its dedicated server event
// (the localized user-facing copy varies per locale and collapses distinct
// failure classes into one string). Deliberately does NOT touch the
// onekeyIdLoginFailedToast event or its dedupe mark: that event strictly
// means "the fallback toast was shown" and keeps firing on its own terms.
export function logOneKeyIdLoginFailureReason(reason: string, error?: unknown) {
  if (
    error &&
    typeof error === 'object' &&
    oneKeyIdFailureReasonLoggedErrors.has(error)
  ) {
    return;
  }
  const safeReason = scrubSensitiveErrorMessageText(reason);
  console.error(safeReason);
  defaultLogger.prime.subscription.onekeyIdLoginFailedReason({
    reason: safeReason,
  });
  if (error && typeof error === 'object') {
    oneKeyIdFailureReasonLoggedErrors.add(error);
  }
}

// Standard shape for "hide the raw cause from the UI, keep it in
// diagnostics": server-log the stable English reason, then throw a localized
// error for toasts and dialogs.
export function throwLocalizedOneKeyIdLoginError({
  intl,
  reason,
  key = ETranslations.global_unknown_error_retry_message,
}: {
  intl: IntlShape;
  reason: string;
  key?: ETranslations;
}): never {
  const error = new OneKeyLocalError({
    message: intl.formatMessage({ id: key }),
    key,
  });
  logOneKeyIdLoginFailureReason(reason, error);
  throw error;
}
