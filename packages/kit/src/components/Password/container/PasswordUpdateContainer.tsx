import { useCallback, useState } from 'react';

import { useIntl } from 'react-intl';

import { Toast } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';

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
          Toast.error({ title: 'password not match' });
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
        Toast.success({ title: 'password update success' });
      } catch (e) {
        console.error(e);
        Toast.error({ title: 'password set failed' });
      }
      setLoading(false);
    },
    [onUpdateRes, oldEncodedPassword],
  );
  return (
    <PasswordSetup
      loading={loading}
      onSetupPassword={onUpdatePassword}
      confirmBtnText={intl.formatMessage({ id: 'form__change_password' })}
    />
  );
};

export default PasswordUpdateContainer;
