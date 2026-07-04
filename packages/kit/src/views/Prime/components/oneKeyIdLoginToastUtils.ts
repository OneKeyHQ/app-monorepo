import { Toast } from '@onekeyhq/components';
import type { IOneKeyError } from '@onekeyhq/shared/src/errors/types/errorTypes';
import errorToastUtils from '@onekeyhq/shared/src/errors/utils/errorToastUtils';
import { ETranslations } from '@onekeyhq/shared/src/locale';

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

  Toast.error({
    title: intl.formatMessage({ id: ETranslations.id_login_failed }),
  });
}
