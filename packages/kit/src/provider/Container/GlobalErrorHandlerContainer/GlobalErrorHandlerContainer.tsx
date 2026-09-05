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

export function GlobalErrorHandlerContainer() {
  const intl = useIntl();
  useEffect(() => {
    const fn = (error: IOneKeyError) => {
      if (
        errorUtils.isErrorByClassName({
          error,
          className: EOneKeyErrorClassNames.DeviceNotOpenedPassphrase,
        })
      ) {
        const p = error.payload;
        const walletId = p?.params?.walletId;
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
              walletId: walletId || '',
              connectId: walletId ? undefined : p?.connectId,
              featuresDeviceId: walletId ? undefined : p?.deviceId,
              passphraseEnabled: true,
            });
          },
        });
      }
    };
    globalErrorHandler.addListener(fn);
    return () => {
      globalErrorHandler.removeListener(fn);
    };
  }, [intl]);
  return null;
}
