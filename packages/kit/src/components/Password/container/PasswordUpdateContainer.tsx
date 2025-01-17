import { useCallback, useState } from 'react';

import { useIntl } from 'react-intl';

import { Toast } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { usePasswordModeAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { EPasswordMode } from '@onekeyhq/shared/types/password';

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
  const [passwordMode] = usePasswordModeAtom();
  const onUpdatePassword = useCallback(
    async (data: IPasswordSetupForm) => {
      const { confirmPassword, confirmPassCode, passwordMode: mode } = data;
      const finalPassword =
        mode === EPasswordMode.PASSCODE ? confirmPassCode : confirmPassword;
      setLoading(true);
      try {
        const encodeNewPassword =
          await backgroundApiProxy.servicePassword.encodeSensitiveText({
            text: finalPassword,
          });
        const updatedPassword =
          await backgroundApiProxy.servicePassword.updatePassword(
            oldEncodedPassword,
            encodeNewPassword,
            mode,
          );
        onUpdateRes(updatedPassword);
        Toast.success({
          title: intl.formatMessage({ id: ETranslations.auth_passcode_set }),
        });
      } catch (e) {
        console.error(e);
        Toast.error({
          title: intl.formatMessage({
            id: ETranslations.auth_new_passcode_same_as_old,
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
      passwordMode={passwordMode}
      onSetupPassword={onUpdatePassword}
      confirmBtnText={intl.formatMessage({ id: ETranslations.global_confirm })}
    />
  );
};

export default PasswordUpdateContainer;
