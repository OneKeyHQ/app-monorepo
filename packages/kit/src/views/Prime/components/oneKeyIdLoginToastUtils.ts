import { Toast } from '@onekeyhq/components';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import type { IOneKeyError } from '@onekeyhq/shared/src/errors/types/errorTypes';
import errorToastUtils from '@onekeyhq/shared/src/errors/utils/errorToastUtils';
import { toPlainErrorObject } from '@onekeyhq/shared/src/errors/utils/errorUtils';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';

import type { IntlShape } from 'react-intl';

const ONEKEY_ID_FAILURE_SERVER_LOGGED = '$$onekeyIdFailureServerLogged';

// Mark an error whose reason was ALREADY sent to @LogToServer at its source
// (e.g. persistKeylessOAuthSession's onekeyIdSessionPersistFailed), so the
// fallback toast below does not emit a second, duplicate server event for the
// same failure.
export function markOneKeyIdFailureServerLogged(error: unknown) {
  if (error && typeof error === 'object') {
    (error as Record<string, unknown>)[ONEKEY_ID_FAILURE_SERVER_LOGGED] = true;
  }
}

function wasOneKeyIdFailureServerLogged(error: unknown): boolean {
  if (!error || typeof error !== 'object') {
    return false;
  }
  return (
    (error as Record<string, unknown>)[ONEKEY_ID_FAILURE_SERVER_LOGGED] === true
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

function shouldSkipOneKeyIdLoginFailedToast(error: unknown) {
  const err = error as IOneKeyError | undefined;

  // Skip the manual login-failed toast when the global auto toast has already
  // been shown for this error, auto toast is explicitly disabled, or the user
  // canceled the login flow (dialog/OAuth cancel, aborted request, etc.)
  return (
    errorToastUtils.wasAutoToastShown(error) ||
    err?.autoToast === false ||
    errorToastUtils.isUserCancelStyleError(error)
  );
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
  if (shouldSkipOneKeyIdLoginFailedToast(error)) {
    return;
  }

  const err = error as IOneKeyError | undefined;
  // Keep the underlying reason in diagnostics without exposing raw SDK,
  // server, or platform error text in the client UI.
  const errorMessage = getLoginFailureReason(error);

  // Skip when the source already logged this reason to the server
  // (persistKeylessOAuthSession) to avoid a duplicate @LogToServer event.
  if (!wasOneKeyIdFailureServerLogged(error)) {
    defaultLogger.prime.subscription.onekeyIdLoginFailedToast({
      reason: scrubSensitiveErrorMessageText(
        errorMessage || err?.className || 'unknown',
      ),
    });
  }

  Toast.error({
    // NOTE: the dedicated `id_login_failed` key is not present in the current
    // auto-generated translations (dropped when merging the newer x i18n
    // generation), so use the existing generic error message instead of
    // hand-editing the generated locale files. Restore `id_login_failed` via
    // `yarn i18n:pull` when reconciling this branch.
    title: intl.formatMessage({
      id: ETranslations.global_unknown_error_retry_message,
    }),
  });

  // This fallback toast has now surfaced the error. Mark it so the global
  // unhandledrejection handler (autoToast errors flow there when a caller
  // rethrows into a `void`ed promise) does not show a second toast for it.
  // Objects only: writing a property on a string/primitive throwable would
  // itself throw in strict mode (same guard as markOneKeyIdFailureServerLogged).
  if (err && typeof err === 'object') {
    (
      err as IOneKeyError & { $$autoToastErrorTriggered?: boolean }
    ).$$autoToastErrorTriggered = true;
  }
}

const MAX_SANITIZED_ERROR_MESSAGE_LENGTH = 200;

// Redact secret-bearing content that auth SDK / server error text can embed
// (JWTs, bearer tokens, OAuth codes and tokens in URL params, whole URL
// query/hash payloads, email addresses) and cap the length. A field
// allowlist alone is not sanitization — `message` is free text.
export function scrubSensitiveErrorMessageText(text: string): string {
  let scrubbed = text;
  // JWTs: three dot-joined base64url segments starting with the {"...} header.
  scrubbed = scrubbed.replace(/eyJ[\w-]+\.[\w-]+\.[\w-]+/g, '[jwt]');
  // Bearer credentials.
  scrubbed = scrubbed.replace(/\bBearer\s+[\w.~+/-]+=*/gi, 'Bearer [token]');
  // URL query strings / fragments (OAuth callbacks carry code/state there).
  scrubbed = scrubbed.replace(/(https?:\/\/[^\s?#]+)[?#][^\s]*/gi, '$1');
  // Bare token params outside URLs (form bodies, plain error text). `code=`
  // and `state=` are intentionally NOT matched here: their leak vector is
  // URLs (already stripped above), while `code=<error-code>` is the stable
  // discriminator our own sanitized text must keep readable.
  scrubbed = scrubbed.replace(
    /\b(token|access_token|refresh_token|id_token)=[^&\s#]+/gi,
    '$1=[redacted]',
  );
  // Email addresses.
  scrubbed = scrubbed.replace(/[\w.+-]+@[\w-]+(\.[\w-]+)+/g, '[email]');
  if (scrubbed.length > MAX_SANITIZED_ERROR_MESSAGE_LENGTH) {
    scrubbed = `${scrubbed.slice(0, MAX_SANITIZED_ERROR_MESSAGE_LENGTH)}...`;
  }
  return scrubbed;
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
export function logOneKeyIdLoginFailureReason(reason: string) {
  const safeReason = scrubSensitiveErrorMessageText(reason);
  console.error(safeReason);
  defaultLogger.prime.subscription.onekeyIdLoginFailedReason({
    reason: safeReason,
  });
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
  logOneKeyIdLoginFailureReason(reason);
  throw new OneKeyLocalError({
    message: intl.formatMessage({ id: key }),
    key,
  });
}
