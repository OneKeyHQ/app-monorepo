import { useState } from 'react';

import { Dialog, Input } from '@onekeyhq/components';
import { getPasswordKeyboardType } from '@onekeyhq/kit/src/components/Password/utils';

function RestorePasswordVerify() {
  const [secureEntry, setSecureEntry] = useState(true);
  return (
    <Dialog.Form formProps={{ values: { password: '' } }}>
      <Dialog.FormField
        name="password"
        rules={{
          required: {
            value: true,
            message: 'Please enter the password ',
          },
          onChange: () => {},
        }}
      >
        <Input
          autoFocus
          size="large"
          placeholder="Enter your password"
          flex={1}
          keyboardType={getPasswordKeyboardType(!secureEntry)}
          secureTextEntry={secureEntry}
          addOns={[
            {
              iconName: secureEntry ? 'EyeOffOutline' : 'EyeOutline',
              onPress: () => {
                setSecureEntry(!secureEntry);
              },
              testID: `password-eye-${secureEntry ? 'off' : 'on'}`,
            },
          ]}
        />
      </Dialog.FormField>
    </Dialog.Form>
  );
}

export function showRestorePasswordVerifyDialog() {
  return new Promise<string>((resolve) =>
    Dialog.confirm({
      icon: 'PlaceholderOutline',
      title: 'Import Data',
      description:
        'Verify the App password at the time of backup to import data.',
      renderContent: <RestorePasswordVerify />,
      onConfirmText: 'Import',
      onConfirm: (dialogInstance) => {
        const valueList = dialogInstance.getForm()?.getValues();
        const password = (valueList?.password as string) ?? '';
        if (password.length <= 0) {
          return;
        }
        resolve(password);
      },
    }),
  );
}
