import { useEffect } from 'react';

import { Dialog } from '@onekeyhq/components';
import { globalErrorHandler } from '@onekeyhq/shared/src/errors/globalErrorHandler';
import {
  EOneKeyErrorClassNames,
  type IOneKeyError,
} from '@onekeyhq/shared/src/errors/types/errorTypes';
import errorUtils from '@onekeyhq/shared/src/errors/utils/errorUtils';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { appLocale } from '@onekeyhq/shared/src/locale/appLocale';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';

export function GlobalErrorHandlerContainer() {
  useEffect(() => {
    const fn = (error: IOneKeyError) => {
      if (
        errorUtils.isErrorByClassName({
          error,
          className: EOneKeyErrorClassNames.DeviceNotOpenedPassphrase,
        })
      ) {
        const p = error.payload as
          | {
              connectId: string;
              deviceId: string;
            }
          | undefined;
        Dialog.show({
          title: appLocale.intl.formatMessage({
            id: ETranslations.passphrase_disabled_dialog_title,
          }),
          description: appLocale.intl.formatMessage({
            id: ETranslations.passphrase_disabled_dialog_desc,
          }),
          onConfirmText: appLocale.intl.formatMessage({
            id: ETranslations.global_enable,
          }),
          onConfirm: async () => {
            await backgroundApiProxy.serviceHardware.setPassphraseEnabled({
              walletId: '',
              connectId: p?.connectId,
              featuresDeviceId: p?.deviceId,
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
  }, []);
  return null;
}
