import { useEffect, useRef } from 'react';

import { useIntl } from 'react-intl';

import { Dialog } from '@onekeyhq/components';
import { globalErrorHandler } from '@onekeyhq/shared/src/errors/globalErrorHandler';
import {
  EOneKeyErrorClassNames,
  type IOneKeyError,
  type IOneKeyHardwareErrorPayload,
} from '@onekeyhq/shared/src/errors/types/errorTypes';
import errorUtils from '@onekeyhq/shared/src/errors/utils/errorUtils';
import {
  EAppEventBusNames,
  HARDWARE_ERROR_DIALOG_TYPES,
  type IHardwareErrorDialogPayload,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import { ETranslations } from '@onekeyhq/shared/src/locale';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import {
  waitForDeviceStageExit,
  yieldDeviceStageToDialog,
} from '../DeviceStageContainer/waitForDeviceStageExit';

export function GlobalErrorHandlerContainer() {
  const intl = useIntl();
  const dialogOpenRef = useRef(false);
  useEffect(() => {
    const fn = async (error: IHardwareErrorDialogPayload) => {
      if (
        error.errorType ===
          HARDWARE_ERROR_DIALOG_TYPES.DEVICE_NOT_OPENED_PASSPHRASE &&
        !dialogOpenRef.current
      ) {
        const p = error.payload as IOneKeyHardwareErrorPayload | undefined;
        const walletId = p?.params?.walletId;
        dialogOpenRef.current = true;
        // The flow that hit this error may still hold the stage (the
        // hidden-wallet run releases its burst only in its own finally, a
        // round trip after this event). A sheet rising under the stage's
        // touch wall is unreachable, and one mounting in the same frame the
        // stage leaves gets its own backdrop stacked over it on iOS. The
        // stage yields first and its exit beat plays before the sheet rises
        // — the discipline every dialog over a live stage follows
        // (OK-62105, OK-62656).
        await yieldDeviceStageToDialog();
        await waitForDeviceStageExit();
        Dialog.show({
          isOverTopAllViews: true,
          onClose: () => {
            dialogOpenRef.current = false;
          },
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
    const handleUnhandledError = (error: IOneKeyError) => {
      if (
        errorUtils.isErrorByClassName({
          error,
          className: EOneKeyErrorClassNames.DeviceNotOpenedPassphrase,
        })
      ) {
        void fn({
          errorType: HARDWARE_ERROR_DIALOG_TYPES.DEVICE_NOT_OPENED_PASSPHRASE,
          payload: error.payload,
        });
      }
    };
    globalErrorHandler.addListener(handleUnhandledError);
    appEventBus.on(EAppEventBusNames.ShowHardwareErrorDialog, fn);
    return () => {
      globalErrorHandler.removeListener(handleUnhandledError);
      appEventBus.off(EAppEventBusNames.ShowHardwareErrorDialog, fn);
    };
  }, [intl]);
  return null;
}
