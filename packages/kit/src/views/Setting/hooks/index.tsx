import { useCallback, useMemo } from 'react';

import { useIntl } from 'react-intl';

import { Dialog, Input, Portal } from '@onekeyhq/components';
import type { IDialogProps } from '@onekeyhq/components/src/composite/Dialog/type';
import { usePrimeAuthV2 } from '@onekeyhq/kit/src/views/Prime/hooks/usePrimeAuthV2';
import { ETranslations, LOCALES_OPTION } from '@onekeyhq/shared/src/locale';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { RESET_OVERLAY_Z_INDEX } from '@onekeyhq/shared/src/utils/overlayUtils';
import resetUtils from '@onekeyhq/shared/src/utils/resetUtils';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';

export function useLocaleOptions() {
  const intl = useIntl();
  const localeOptions = useMemo(
    () =>
      [
        {
          label: intl.formatMessage({
            id: ETranslations.global_auto,
          }),
          value: 'system',
        },
      ].concat(LOCALES_OPTION),
    [intl],
  );
  return localeOptions;
}

export const inAppStateLockStyle: {
  sheetProps: IDialogProps['sheetProps'];
  floatingPanelProps: IDialogProps['floatingPanelProps'];
} = {
  sheetProps: {
    zIndex: RESET_OVERLAY_Z_INDEX,
  },
  floatingPanelProps: {
    zIndex: RESET_OVERLAY_Z_INDEX,
  },
};
export function useResetApp(
  params: {
    inAppStateLock?: boolean;
    silentReset?: boolean;
  } = {},
) {
  const { inAppStateLock = false, silentReset = false } = params || {};
  const intl = useIntl();
  const { logout: logoutOnekeyID } = usePrimeAuthV2();

  const doReset = useCallback(async () => {
    // reset app
    try {
      // disable setInterval on ext popup
      if (platformEnv.isExtensionUiPopup) {
        resetUtils.startResetting();
      }
      try {
        void logoutOnekeyID();
        await timerUtils.wait(1000);
      } catch (error) {
        console.error('failed to logoutPrivy', error);
      }
      await backgroundApiProxy.serviceApp.resetApp();
    } catch (e) {
      console.error('failed to reset app with error', e);
    } finally {
      // able setInterval on ext popup
      if (platformEnv.isExtensionUiPopup) {
        resetUtils.endResetting();
      }
    }
  }, [logoutOnekeyID]);

  return useCallback(async () => {
    await timerUtils.wait(50);

    if (silentReset) {
      await doReset();
      return;
    }

    if (inAppStateLock) {
      const isLock = await backgroundApiProxy.serviceApp.isAppLocked();
      if (!isLock) {
        return;
      }
    }
    Dialog.show({
      ...(inAppStateLock ? inAppStateLockStyle : undefined),
      title: intl.formatMessage({ id: ETranslations.global_reset }),
      icon: 'ErrorOutline',
      tone: 'destructive',
      isOverTopAllViews: true,
      portalContainer: inAppStateLock
        ? Portal.Constant.APP_STATE_LOCK_CONTAINER_OVERLAY
        : undefined,
      description: intl.formatMessage({ id: ETranslations.reset_app_desc }),
      renderContent: (
        <Dialog.Form
          formProps={{
            defaultValues: { text: '' },
          }}
        >
          <Dialog.FormField name="text">
            <Input
              autoFocus
              flex={1}
              testID="erase-data-input"
              placeholder="RESET"
            />
          </Dialog.FormField>
        </Dialog.Form>
      ),
      confirmButtonProps: {
        disabledOn: ({ getForm }) => {
          const { getValues } = getForm() || {};
          if (getValues) {
            const { text } = getValues() as { text: string };
            return text.trim().toUpperCase() !== 'RESET';
          }
          return true;
        },
        testID: 'erase-data-confirm',
      },
      onConfirm: async () => {
        defaultLogger.setting.page.resetApp({
          reason: 'ManualResetFromSettings',
        });
        await doReset();
      },
    });
  }, [doReset, inAppStateLock, intl, silentReset]);
}
