import { useCallback, useEffect, useMemo, useRef } from 'react';

import { useIntl } from 'react-intl';

import { Checkbox, Dialog, Input } from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';

export default function useOperationDialog() {
  const intl = useIntl();
  const pendingCancels = useRef(new Set<() => void>());
  useEffect(
    () => () => {
      for (const cancel of pendingCancels.current) cancel();
      pendingCancels.current.clear();
    },
    [],
  );
  const showBackupOverwrittenDialog = useCallback(
    () =>
      new Promise<void>((resolve, reject) => {
        const dialog: { current?: ReturnType<typeof Dialog.confirm> } = {};
        let confirmed = false;
        const cancel = () => {
          pendingCancels.current.delete(cancel);
          if (!confirmed) {
            confirmed = true;
            reject(new Error('Lite operation cancelled'));
            void dialog.current?.close();
          }
        };
        pendingCancels.current.add(cancel);
        dialog.current = Dialog.show({
          onClose: cancel,
          icon: 'ErrorOutline',
          tone: 'destructive',
          title: intl.formatMessage({
            id: ETranslations.hardware_device_contains_backup,
          }),
          description: intl.formatMessage({
            id: ETranslations.hardware_device_contains_backup_desc,
          }),
          onConfirmText: intl.formatMessage({
            id: ETranslations.global_overwritten,
          }),
          renderContent: (
            <Dialog.Form
              formProps={{
                defaultValues: {},
              }}
            >
              <Dialog.FormField name="agree">
                <Checkbox
                  testID="lite-card-show-backup-overwritten-dialog-checkbox"
                  label={intl.formatMessage({
                    id: ETranslations.global_i_understand,
                  })}
                />
              </Dialog.FormField>
            </Dialog.Form>
          ),
          confirmButtonProps: {
            disabledOn: (params) => {
              const value = params.getForm()?.getValues().agree;
              return !value;
            },
          },
          onConfirm: () => {
            if (confirmed) return;
            confirmed = true;
            pendingCancels.current.delete(cancel);
            resolve();
          },
        });
      }),
    [intl],
  );
  const showResetWarningDialog = useCallback(
    () =>
      new Promise<void>((resolve, reject) => {
        const dialog: { current?: ReturnType<typeof Dialog.confirm> } = {};
        let confirmed = false;
        const cancel = () => {
          pendingCancels.current.delete(cancel);
          if (!confirmed) {
            confirmed = true;
            reject(new Error('Lite operation cancelled'));
            void dialog.current?.close();
          }
        };
        pendingCancels.current.add(cancel);
        dialog.current = Dialog.show({
          onClose: cancel,
          icon: 'GiroCardOutline',
          title: intl.formatMessage({
            id: ETranslations.hardware_reset_onekey_lite,
          }),
          description: intl.formatMessage({
            id: ETranslations.hardware_reset_onekey_lite_desc,
          }),
          renderContent: (
            <Dialog.Form
              formProps={{
                defaultValues: {},
              }}
            >
              <Dialog.FormField name="reset">
                <Input
                  autoFocus
                  flex={1}
                  placeholder="RESET"
                  testID="lite-card-show-reset-warning-dialog-input"
                />
              </Dialog.FormField>
            </Dialog.Form>
          ),
          onConfirmText: intl.formatMessage({ id: ETranslations.global_reset }),
          confirmButtonProps: {
            variant: 'destructive',
            disabledOn: (params) => {
              const value = params.getForm()?.getValues().reset;
              return !/^RESET$/i.test(value);
            },
          },
          onConfirm: () => {
            if (confirmed) return;
            confirmed = true;
            pendingCancels.current.delete(cancel);
            resolve();
          },
        });
      }),
    [intl],
  );
  const showBackupSuccessDialog = useCallback(() => {
    Dialog.confirm({
      icon: 'CheckRadioOutline',
      tone: 'success',
      title: intl.formatMessage({
        id: ETranslations.hardware_backup_completed,
      }),
      description: intl.formatMessage({
        id: ETranslations.hardware_recover_wallet_with_card_and_pin,
      }),
      onConfirmText: intl.formatMessage({
        id: ETranslations.global_i_got_it,
      }),
    });
  }, [intl]);
  const showChangePINOnNewCardDialog = useCallback(() => {
    Dialog.show({
      icon: 'ErrorOutline',
      tone: 'destructive',
      title: intl.formatMessage({
        id: ETranslations.hardware_pin_change_failed,
      }),
      description: intl.formatMessage({
        id: ETranslations.hardware_no_pin_change_needed,
      }),
      onConfirmText: intl.formatMessage({
        id: ETranslations.global_i_got_it,
      }),
    });
  }, [intl]);
  const showChangePINSuccessDialog = useCallback(() => {
    Dialog.confirm({
      icon: 'CheckRadioOutline',
      tone: 'success',
      title: intl.formatMessage({
        id: ETranslations.hardware_onekey_lite_pin_changed,
      }),
      description: intl.formatMessage({
        id: ETranslations.hardware_onekey_lite_pin_changed_desc,
      }),
      onConfirmText: intl.formatMessage({
        id: ETranslations.global_i_got_it,
      }),
    });
  }, [intl]);
  const showResetSuccessDialog = useCallback(() => {
    Dialog.confirm({
      icon: 'CheckRadioOutline',
      tone: 'success',
      title: intl.formatMessage({
        id: ETranslations.hardware_onekey_lite_reset,
      }),
      description: intl.formatMessage({
        id: ETranslations.hardware_data_erased_use_as_new,
      }),
      onConfirmText: intl.formatMessage({
        id: ETranslations.global_i_got_it,
      }),
    });
  }, [intl]);
  return useMemo(
    () => ({
      showBackupOverwrittenDialog,
      showResetWarningDialog,
      showBackupSuccessDialog,
      showChangePINOnNewCardDialog,
      showChangePINSuccessDialog,
      showResetSuccessDialog,
    }),
    [
      showBackupOverwrittenDialog,
      showResetWarningDialog,
      showBackupSuccessDialog,
      showChangePINOnNewCardDialog,
      showChangePINSuccessDialog,
      showResetSuccessDialog,
    ],
  );
}
