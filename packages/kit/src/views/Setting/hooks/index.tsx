import { useCallback, useMemo } from 'react';

import { useIntl } from 'react-intl';

import { Dialog, Input, Portal } from '@onekeyhq/components';
import type { IDialogProps } from '@onekeyhq/components/src/composite/Dialog/type';
import { LOCALES_OPTION } from '@onekeyhq/shared/src/locale';
import { RESET_OVERLAY_Z_INDEX } from '@onekeyhq/shared/src/utils/overlayUtils';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';

export function useLocaleOptions() {
  const intl = useIntl();
  const localeOptions = useMemo(
    () =>
      [
        {
          label: intl.formatMessage({
            id: 'form__auto',
            defaultMessage: 'System',
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
      title: intl.formatMessage({ id: 'action__reset' }),
      icon: 'ErrorOutline',
      tone: 'destructive',
      portalContainer: inAppStateLock
        ? Portal.Constant.APP_STATE_LOCK_CONTAINER_OVERLAY
        : undefined,
      description:
        'This will delete all the data you have created on OneKey. After making sure that you have a proper backup, enter "RESET" to reset the App',
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
      onConfirm() {
        void backgroundApiProxy.serviceApp.resetApp();
      },
    });
  }, [inAppStateLock, intl]);
}
