import { useState } from 'react';

import { Dialog, SizableText } from '@onekeyhq/components';

import { PasswordKeyboard } from '../components/PasswordKeyboard';

export function PasswordKeyboardDescription({
  description,
  shouldConfirmPassword,
}: {
  description?: string;
  shouldConfirmPassword?: string;
}) {
  const [password, setPassword] = useState('');
  const showError =
    shouldConfirmPassword &&
    password.length === shouldConfirmPassword.length &&
    shouldConfirmPassword !== password;
  return (
    <Dialog.Form
      formProps={{
        defaultValues: {},
      }}
    >
      <SizableText size="$bodyLg" color={showError ? '$textCritical' : '$text'}>
        {showError
          ? 'The entered PINs do not match. Please reconfirm.'
          : description}
      </SizableText>
      <Dialog.FormField name="password">
        <PasswordKeyboard
          onChange={(value) => {
            setPassword(value);
            return value;
          }}
        />
      </Dialog.FormField>
    </Dialog.Form>
  );
}

export function showPINFormDialog(
  isSetNewPassword?: boolean,
  shouldConfirmPassword?: string,
) {
  const config = {
    title: 'Enter OneKey Lite PIN',
    description:
      'OneKey Lite PIN is a 6-digit number and cannot be retrieved if forgotten, as we do not store any user information.',
  };
  if (isSetNewPassword) {
    config.title = 'Set OneKey Lite PIN';
    config.description = 'Set a 6-digit PIN for your OneKey Lite. ';
    if (shouldConfirmPassword) {
      config.title = 'Confirm OneKey Lite PIN';
      config.description = 'Please re-enter the OneKey Lite LIN you just set. ';
    }
  }
  return new Promise<string>((resolve) => {
    Dialog.confirm({
      icon: 'GiroCardOutline',
      title: config.title,
      renderContent: (
        <PasswordKeyboardDescription
          shouldConfirmPassword={shouldConfirmPassword}
          description={config.description}
        />
      ),
      confirmButtonProps: {
        disabledOn: (dialogInstance) => {
          const value = dialogInstance.getForm()?.getValues()
            .password as string;
          const disable = !(value?.length >= 6);
          if (!disable && shouldConfirmPassword) {
            return shouldConfirmPassword !== value;
          }
          return disable;
        },
      },
      onConfirm: (dialogInstance) => {
        const pin = dialogInstance.getForm()?.getValues().password;
        resolve(pin);
      },
    });
  });
}
