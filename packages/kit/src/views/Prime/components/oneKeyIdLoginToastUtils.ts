import { Toast } from '@onekeyhq/components';
import {
  EOneKeyErrorClassNames,
  type IOneKeyError,
} from '@onekeyhq/shared/src/errors/types/errorTypes';
import { ETranslations } from '@onekeyhq/shared/src/locale';

import type { IntlShape } from 'react-intl';

type IOneKeyIdLoginToastError = IOneKeyError & {
  $$autoToastErrorTriggered?: boolean;
};

function shouldSkipOneKeyIdLoginFailedToast(error: unknown) {
  const err = error as IOneKeyIdLoginToastError | undefined;

  return (
    err?.$$autoToastErrorTriggered ||
    err?.autoToast === false ||
    err?.className === EOneKeyErrorClassNames.OAuthLoginCancelError ||
    err?.className === EOneKeyErrorClassNames.PrimeLoginDialogCancelError
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
