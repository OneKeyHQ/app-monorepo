import { useCallback, useState } from 'react';

import { Toast } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';

import PasswordUpdate from '../components/PasswordUpdate';

import type { IPasswordUpdateForm } from '../components/PasswordUpdate';

interface IPasswordUpdateContainerProps {
  onUpdateRes: (newPassword: string) => void;
}
const PasswordUpdateContainer = ({
  onUpdateRes,
}: IPasswordUpdateContainerProps) => {
  const [loading, setLoading] = useState(false);
  const onUpdatePassword = useCallback(
    async (data: IPasswordUpdateForm) => {
      setLoading(true);
      try {
        const encodeNewPassword =
          await backgroundApiProxy.servicePassword.encodeSensitiveText({
            text: data.newPassword,
          });
        const encodeOldPassword =
          await backgroundApiProxy.servicePassword.encodeSensitiveText({
            text: data.oldPassword,
          });
        const updatedPassword =
          await backgroundApiProxy.servicePassword.updatePassword(
            encodeOldPassword,
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
    [onUpdateRes],
  );
  return (
    <PasswordUpdate loading={loading} onUpdatePassword={onUpdatePassword} />
  );
};

export default PasswordUpdateContainer;
