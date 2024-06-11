import { useCallback, useState } from 'react';

import { useIntl } from 'react-intl';

import { Toast } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { ETranslations } from '@onekeyhq/shared/src/locale';

import PasswordSetup from '../components/PasswordSetup';

import type { IPasswordSetupForm } from '../components/PasswordSetup';

interface IPasswordUpdateContainerProps {
  oldEncodedPassword: string;
  onUpdateRes: (newPassword: string) => void;
}
const PasswordUpdateContainer = ({
  oldEncodedPassword,
  onUpdateRes,
}: IPasswordUpdateContainerProps) => {
  const [loading, setLoading] = useState(false);
  const intl = useIntl();
  const onUpdatePassword = useCallback(
    async (data: IPasswordSetupForm) => {
      setLoading(true);
      try {
        if (data.confirmPassword !== data.password) {
          Toast.error({
            title: intl.formatMessage({
              id: ETranslations.auth_error_password_not_match,
            }),
          });
          return;
        }
        const encodeNewPassword =
          await backgroundApiProxy.servicePassword.encodeSensitiveText({
            text: data.password,
          });
        const updatedPassword =
          await backgroundApiProxy.servicePassword.updatePassword(
            oldEncodedPassword,
            encodeNewPassword,
          );
        onUpdateRes(updatedPassword);
        Toast.success({
          title: intl.formatMessage({ id: ETranslations.auth_password_set }),
        });
      } catch (e) {
        console.error(e);
        Toast.error({
          title: intl.formatMessage({
            id: ETranslations.auth_new_password_same_as_old,
          }),
        });
      }
      setLoading(false);
    },
    [oldEncodedPassword, onUpdateRes, intl],
  );
  return (
    <PasswordSetup
      loading={loading}
      onSetupPassword={onUpdatePassword}
      confirmBtnText={intl.formatMessage({ id: ETranslations.global_confirm })}
    />
  );
};

export default PasswordUpdateContainer;
