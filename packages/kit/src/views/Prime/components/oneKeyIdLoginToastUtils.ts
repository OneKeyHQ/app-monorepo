import { Toast } from '@onekeyhq/components';
import type { IOneKeyError } from '@onekeyhq/shared/src/errors/types/errorTypes';
import errorToastUtils from '@onekeyhq/shared/src/errors/utils/errorToastUtils';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';

import type { IntlShape } from 'react-intl';

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
  const errorMessage =
    typeof err?.message === 'string' && err.message ? err.message : undefined;

  // Mirror the toast body into exported logs — toast content is otherwise
  // unrecoverable after the fact.
  defaultLogger.prime.subscription.onekeyIdLoginFailedToast({
    reason: errorMessage || err?.className || 'unknown',
  });

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
}
