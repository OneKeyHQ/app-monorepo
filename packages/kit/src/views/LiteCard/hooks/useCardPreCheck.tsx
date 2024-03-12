import { useCallback, useMemo } from 'react';

import { Checkbox, Dialog, Input } from '@onekeyhq/components';

export default function useCardPreCheck() {
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
              return value !== 'RESET';
            },
          },
          onConfirm: () => resolve(),
        });
      }),
    [],
  );
  return useMemo(
    () => ({ showBackupOverwrittenDialog, showResetWarningDialog }),
    [showBackupOverwrittenDialog, showResetWarningDialog],
  );
}
