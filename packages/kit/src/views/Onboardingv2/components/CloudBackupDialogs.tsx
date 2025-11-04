import { useFormContext } from 'react-hook-form';

import { Dialog, Form, Input, Stack, Toast } from '@onekeyhq/components';
import type { IDialogShowProps } from '@onekeyhq/components/src/composite/Dialog/type';
import { onboardingCloudBackupListRefreshAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';

import type { IAppNavigation } from '../../../hooks/useAppNavigation';

function DialogInput({
  value,
  onChange,
  description,
  placeholder,
  autoFocus,
}: {
  value?: string;
  onChange?: (val: string) => void;
  description?: string;
  placeholder?: string;
  autoFocus?: boolean;
}) {
  return (
    <>
      <Stack>
        <Input
          placeholder={placeholder}
          size="large"
          $gtMd={{ size: 'medium' }}
          autoFocus={autoFocus}
          secureTextEntry
          value={value}
          onChangeText={onChange}
          flex={1}
        />
      </Stack>
      {description ? (
        <Form.FieldDescription>{description}</Form.FieldDescription>
      ) : null}
    </>
  );
}

function PasswordField() {
  return (
    <Dialog.FormField
      name="password"
      rules={{
        required: {
          value: true,
          message: 'Password is required',
        },
        validate: (value: string) => {
          if (!value?.trim()) {
            // return appLocale.intl.formatMessage({
            //   id: ETranslations.form_rename_error_empty,
            // });
            return 'Password is required';
          }
          return true;
        },
      }}
    >
      <DialogInput placeholder="Password" autoFocus />
    </Dialog.FormField>
  );
}

function ConfirmPasswordField() {
  const { getValues } = useFormContext();
  return (
    <Dialog.FormField
      name="confirm"
      rules={{
        required: {
          value: true,
          message: 'Confirm password is required',
        },
        validate: (value: string) => {
          if (!value?.trim()) {
            return 'Confirm password is required';
          }
          if (value !== getValues().password) {
            return 'Passwords do not match';
          }
          return true;
        },
      }}
    >
      <DialogInput placeholder="Confirm password" autoFocus={false} />
    </Dialog.FormField>
  );
}

export const showCloudBackupPasswordDialog = ({
  onSubmit,
  ...dialogProps
}: IDialogShowProps & {
  onSubmit: (input: string) => Promise<void>;
}) => {
  // appLocale.intl.formatMessage
  const title = 'Enter your backup password';
  Dialog.show({
    title,
    renderContent: (
      <Dialog.Form formProps={{ values: { password: '', confirm: '' } }}>
        <PasswordField />
        <ConfirmPasswordField />
      </Dialog.Form>
    ),
    onConfirm: async ({ getForm, close }) => {
      const form = getForm();
      await onSubmit(form?.getValues().password);
      // fix toast dropped frames
      await close();
    },
    ...dialogProps,
  });
};

export const showCloudBackupDeleteDialog = ({
  recordID,
  navigation,
  ...dialogProps
}: IDialogShowProps & {
  recordID: string;
  navigation: IAppNavigation;
}) => {
  Dialog.show({
    icon: 'DeleteOutline',
    tone: 'destructive',
    title: 'Delete this backup?',
    description:
      "This file will be permanently deleted from iCloud. Make sure you have written down the Recovery phrases as you won't be able to restore the wallets otherwise.",
    onConfirmText: 'Delete',
    confirmButtonProps: {
      variant: 'destructive',
    },
    onCancelText: 'Cancel',
    onConfirm: async () => {
      await backgroundApiProxy.serviceCloudBackupV2.delete({
        recordId: recordID,
      });
      await onboardingCloudBackupListRefreshAtom.set((v) => v + 1);
      // Show success toast
      Toast.success({
        title: 'Backup deleted',
      });
      // Navigate back to iCloud backup list
      navigation.pop();
    },
    ...dialogProps,
  });
};
