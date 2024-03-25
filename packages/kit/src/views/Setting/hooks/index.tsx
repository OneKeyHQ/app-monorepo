import { useCallback, useMemo } from 'react';

import { useIntl } from 'react-intl';

import { Dialog, Input } from '@onekeyhq/components';
import { LOCALES_OPTION } from '@onekeyhq/shared/src/locale';

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

export function useResetApp() {
  const intl = useIntl();
  return useCallback(() => {
    Dialog.show({
      title: intl.formatMessage({ id: 'action__reset' }),
      icon: 'ErrorOutline',
      tone: 'destructive',
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
              placeholder={intl.formatMessage({ id: 'action__reset' })}
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
  }, [intl]);
}
