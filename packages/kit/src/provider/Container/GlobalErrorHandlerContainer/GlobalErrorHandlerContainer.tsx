import { useEffect } from 'react';

import { useIntl } from 'react-intl';

import { Dialog } from '@onekeyhq/components';
import { globalErrorHandler } from '@onekeyhq/shared/src/errors/globalErrorHandler';
import {
  EOneKeyErrorClassNames,
  type IOneKeyError,
} from '@onekeyhq/shared/src/errors/types/errorTypes';
import errorUtils from '@onekeyhq/shared/src/errors/utils/errorUtils';
import { ETranslations } from '@onekeyhq/shared/src/locale';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';

import type { IntlShape } from 'react-intl';

const passphraseDialogErrors = new WeakSet<object>();

export function showPassphraseDisabledDialog({
  error,
  intl,
  walletId,
}: {
  error: unknown;
  intl: Pick<IntlShape, 'formatMessage'>;
  walletId?: string;
}) {
  if (
    !error ||
    typeof error !== 'object' ||
    !errorUtils.isErrorByClassName({
      error,
      className: EOneKeyErrorClassNames.DeviceNotOpenedPassphrase,
    }) ||
    passphraseDialogErrors.has(error)
  ) {
    return;
  }

  const p = (error as IOneKeyError).payload;
  const targetWalletId = walletId || p?.params?.walletId;
  Dialog.show({
    title: intl.formatMessage({
      id: ETranslations.passphrase_disabled_dialog_title,
    }),
    description: intl.formatMessage({
      id: ETranslations.passphrase_disabled_dialog_desc,
    }),
    onConfirmText: intl.formatMessage({
      id: ETranslations.global_enable,
    }),
    onConfirm: async () => {
      await backgroundApiProxy.serviceHardware.setPassphraseEnabled({
        walletId: targetWalletId || '',
        connectId: targetWalletId ? undefined : p?.connectId,
        featuresDeviceId: targetWalletId ? undefined : p?.deviceId,
        passphraseEnabled: true,
      });
    },
  });
  // The caller rethrows this error, so the global listener may see it again.
  passphraseDialogErrors.add(error);
}

export function GlobalErrorHandlerContainer() {
  const intl = useIntl();
  useEffect(() => {
    const fn = (error: IOneKeyError) => {
      showPassphraseDisabledDialog({ error, intl });
    };
    globalErrorHandler.addListener(fn);
    return () => {
      globalErrorHandler.removeListener(fn);
    };
  }, [intl]);
  return null;
}
