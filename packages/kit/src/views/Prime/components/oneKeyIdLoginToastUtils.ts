import { Toast } from '@onekeyhq/components';
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
  // Surface the underlying failure reason as the toast body: this manual
  // toast is the fallback for errors the global auto toast did NOT handle,
  // and collapsing them all into a bare "unknown error" hides actionable
  // causes (e.g. a rejected Supabase GET /auth/v1/user) from users and from
  // exported bug-report logs.
  const errorMessage = getLoginFailureReason(error);

  // Mirror the toast body into exported logs — toast content is otherwise
  // unrecoverable after the fact. Skip when the source already logged this
  // reason to the server (persistKeylessOAuthSession) to avoid a duplicate
  // @LogToServer event for a single failure.
  if (!wasOneKeyIdFailureServerLogged(error)) {
    defaultLogger.prime.subscription.onekeyIdLoginFailedToast({
      reason: errorMessage || err?.className || 'unknown',
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
    message: errorMessage,
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
