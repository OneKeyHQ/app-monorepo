import { useFormContext } from 'react-hook-form';

import { Dialog, Form, Input, Stack } from '@onekeyhq/components';
import type { IDialogShowProps } from '@onekeyhq/components/src/composite/Dialog/type';

function DialogInput({
  value,
  onChange,
  description,
  placeholder,
}: {
  value?: string;
  onChange?: (val: string) => void;
  description?: string;
  placeholder?: string;
}) {
  return (
    <>
      <Stack>
        <Input
          placeholder={placeholder}
          size="large"
          $gtMd={{ size: 'medium' }}
          autoFocus
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
      <DialogInput placeholder="Password" />
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
      <DialogInput placeholder="Confirm password" />
    </Dialog.FormField>
  );
}

export const showCloudBackupPasswordDialog = ({
  title,
  onSubmit,
  ...dialogProps
}: IDialogShowProps & {
  title: string;
  onSubmit: (input: string) => Promise<void>;
}) =>
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
