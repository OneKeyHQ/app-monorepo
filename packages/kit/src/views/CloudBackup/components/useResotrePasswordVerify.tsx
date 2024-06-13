import { useCallback, useMemo, useState } from 'react';

import { useIntl } from 'react-intl';

import { Dialog, Input } from '@onekeyhq/components';
import { getPasswordKeyboardType } from '@onekeyhq/kit/src/components/Password/utils';
import { ETranslations } from '@onekeyhq/shared/src/locale';

function RestorePasswordVerify() {
  const intl = useIntl();
  const [secureEntry, setSecureEntry] = useState(true);
  return (
    <Dialog.Form formProps={{ values: { password: '' } }}>
      <Dialog.FormField
        name="password"
        rules={{
          required: {
            value: true,
            message: intl.formatMessage({
              id: ETranslations.auth_enter_your_password,
            }),
          },
          onChange: () => {},
        }}
      >
        <Input
          autoFocus
          size="large"
          placeholder={intl.formatMessage({
            id: ETranslations.auth_enter_your_password,
          })}
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

export function useRestorePasswordVerifyDialog() {
  const intl = useIntl();
  const show = useCallback(
    () =>
      new Promise<string>((resolve) =>
        Dialog.confirm({
          icon: 'PlaceholderOutline',
          title: intl.formatMessage({ id: ETranslations.backup_import_data }),
          description: intl.formatMessage({
            id: ETranslations.backup_verify_app_password_to_import_data,
          }),
          renderContent: <RestorePasswordVerify />,
          onConfirmText: intl.formatMessage({
            id: ETranslations.global_import,
          }),
          onConfirm: (dialogInstance) => {
            const valueList = dialogInstance.getForm()?.getValues();
            const password = (valueList?.password as string) ?? '';
            if (password.length <= 0) {
              return;
            }
            resolve(password);
          },
        }),
      ),
    [intl],
  );
  return useMemo(() => ({ show }), [show]);
}
