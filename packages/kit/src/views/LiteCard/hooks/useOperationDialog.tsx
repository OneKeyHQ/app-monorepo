import { useCallback, useMemo } from 'react';

import { Checkbox, Dialog, Input } from '@onekeyhq/components';

export default function useOperationDialog() {
  const showBackupOverwrittenDialog = useCallback(
    () =>
      new Promise<void>((resolve) => {
        Dialog.show({
          icon: 'ErrorOutline',
          tone: 'destructive',
          title: 'This Device Contains Backup',
          description:
            'If you continue, your previous backup will be fully overwritten and will be lost forever.',
          onConfirmText: 'Overwritten',
          renderContent: (
            <Dialog.Form
              formProps={{
                defaultValues: {},
              }}
            >
              <Dialog.FormField name="agree">
                <Checkbox label="I understand" />
              </Dialog.FormField>
            </Dialog.Form>
          ),
          confirmButtonProps: {
            disabledOn: (params) => {
              const value = params.getForm()?.getValues().agree;
              return !value;
            },
          },
          onConfirm: () => resolve(),
        });
      }),
    [],
  );
  const showResetWarningDialog = useCallback(
    () =>
      new Promise<void>((resolve) => {
        Dialog.show({
          icon: 'GiroCardOutline',
          title: 'Reset OneKey Lite',
          description:
            'Please ensure that you have backed up the recovery phrase before entering "RESET" to confirm, as it will be erased from this OneKey Lite device.',
          renderContent: (
            <Dialog.Form
              formProps={{
                defaultValues: {},
              }}
            >
              <Dialog.FormField name="reset">
                <Input autoFocus flex={1} placeholder="RESET" />
              </Dialog.FormField>
            </Dialog.Form>
          ),
          onConfirmText: 'Reset',
          confirmButtonProps: {
            variant: 'destructive',
            disabledOn: (params) => {
              const value = params.getForm()?.getValues().reset;
              return !/^RESET$/i.test(value);
            },
          },
          onConfirm: () => resolve(),
        });
      }),
    [],
  );
  const showBackupSuccessDialog = useCallback(() => {
    Dialog.confirm({
      icon: 'CheckRadioOutline',
      tone: 'success',
      title: 'Backup Completed!',
      description:
        'You can recover your wallet using this card and PIN at all times. Remember this PIN as it cannot be recovered if lost, as we do not store any user information.',
      onConfirmText: 'I Got It',
    });
  }, []);
  const showChangePINOnNewCardDialog = useCallback(() => {
    Dialog.show({
      icon: 'ErrorOutline',
      tone: 'destructive',
      title: 'PIN Change Failed',
      description:
        'No need to change the PIN code on this new OneKey Lite card.',
      onConfirmText: 'I Got it',
    });
  }, []);
  const showChangePINSuccessDialog = useCallback(() => {
    Dialog.confirm({
      icon: 'CheckRadioOutline',
      tone: 'success',
      title: 'OneKey Lite PIN Changed!',
      description:
        "This OneKey Lite's PIN has been changed. Remember this PIN as it cannot be recovered if lost, as we do not store any user information.",
      onConfirmText: 'I Got it',
    });
  }, []);
  const showResetSuccessDialog = useCallback(() => {
    Dialog.confirm({
      icon: 'CheckRadioOutline',
      tone: 'success',
      title: 'OneKey Lite has been Reset!',
      description:
        'The data on this OneKey Lite has been completely erased, and you can use it as a new OneKey Lite.',
      onConfirmText: 'I Got it',
    });
  }, []);
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
