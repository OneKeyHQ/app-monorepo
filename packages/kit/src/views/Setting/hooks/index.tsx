import { useCallback, useMemo } from 'react';

import { useIntl } from 'react-intl';

import { Dialog, Input, Portal } from '@onekeyhq/components';
import type { IDialogProps } from '@onekeyhq/components/src/composite/Dialog/type';
import { ETranslations, LOCALES_OPTION } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { RESET_OVERLAY_Z_INDEX } from '@onekeyhq/shared/src/utils/overlayUtils';
import resetUtils from '@onekeyhq/shared/src/utils/resetUtils';

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

const inAppStateLockStyle: {
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
export function useResetApp(params?: { inAppStateLock: boolean }) {
  const { inAppStateLock = false } = params || {};
  const intl = useIntl();
  return useCallback(() => {
    Dialog.show({
      ...(inAppStateLock ? inAppStateLockStyle : undefined),
      title: intl.formatMessage({ id: ETranslations.global_reset }),
      icon: 'ErrorOutline',
      tone: 'destructive',
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
        try {
          // disable setInterval on ext popup
          if (platformEnv.isExtensionUiPopup) {
            resetUtils.startResetting();
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
      },
    });
  }, [inAppStateLock, intl]);
}
