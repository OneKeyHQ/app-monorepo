import {
  createRef,
  forwardRef,
  useCallback,
  useImperativeHandle,
  useMemo,
  useState,
} from 'react';

import { useIntl } from 'react-intl';

import { Dialog, Input, SizableText } from '@onekeyhq/components';
import { getPasswordKeyboardType } from '@onekeyhq/kit/src/components/Password/utils';
import { ETranslations } from '@onekeyhq/shared/src/locale';

type IRestorePasswordVerifyRef = {
  getPassword: () => string;
  showError: () => void;
};

const RESTORE_PASSWORD_VERIFY_DIALOG_ESTIMATED_CONTENT_HEIGHT = 76;

const RestorePasswordVerify = forwardRef<IRestorePasswordVerifyRef>(
  function RestorePasswordVerify(_, ref) {
    const intl = useIntl();
    const [secureEntry, setSecureEntry] = useState(true);
    const [password, setPassword] = useState('');
    const [errorMessage, setErrorMessage] = useState<string | undefined>();

    useImperativeHandle(
      ref,
      () => ({
        getPassword: () => password,
        showError: () => {
          setErrorMessage(
            intl.formatMessage({
              id: ETranslations.auth_enter_your_passcode,
            }),
          );
        },
      }),
      [intl, password],
    );

    return (
      <>
        <Input
          testID="cloud-backup-intl-input"
          autoFocus
          size="large"
          placeholder={intl.formatMessage({
            id: ETranslations.auth_enter_your_passcode,
          })}
          flex={1}
          value={password}
          onChangeText={(nextPassword) => {
            setPassword(nextPassword);
            if (nextPassword.length > 0) {
              setErrorMessage(undefined);
            }
          }}
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
        {errorMessage ? (
          <SizableText size="$bodyMd" pt="$1.5" color="$textCritical">
            {errorMessage}
          </SizableText>
        ) : null}
      </>
    );
  },
);

export function useRestorePasswordVerifyDialog() {
  const intl = useIntl();
  const show = useCallback(
    () =>
      new Promise<string>((resolve, reject) => {
        const contentRef = createRef<IRestorePasswordVerifyRef>();

        Dialog.confirm({
          icon: 'InfoCircleOutline',
          title: intl.formatMessage({ id: ETranslations.backup_import_data }),
          description: intl.formatMessage({
            id: ETranslations.backup_verify_app_passcode_to_import_data,
          }),
          onConfirmText: intl.formatMessage({
            id: ETranslations.global_import,
          }),
          renderContent: <RestorePasswordVerify ref={contentRef} />,
          estimatedContentHeight:
            RESTORE_PASSWORD_VERIFY_DIALOG_ESTIMATED_CONTENT_HEIGHT,
          onConfirm: ({ preventClose }) => {
            const password = contentRef.current?.getPassword() ?? '';
            if (password.length <= 0) {
              preventClose();
              contentRef.current?.showError();
              return;
            }
            resolve(password);
          },
          onClose: () => {
            reject(intl.formatMessage({ id: ETranslations.global_cancel }));
          },
        });
      }),
    [intl],
  );
  return useMemo(() => ({ show }), [show]);
}
