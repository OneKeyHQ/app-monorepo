import { useCallback, useState } from 'react';

import { useIntl } from 'react-intl';

import { Toast } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
// eslint-disable-next-line @typescript-eslint/no-restricted-imports
import { biologyAuthUtils } from '@onekeyhq/kit-bg/src/services/ServicePassword/biologyAuthUtils';
import {
  usePasswordModeAtom,
  usePasswordPersistAtom,
  useSettingsPersistAtom,
} from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
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
  const [{ webAuthCredentialId }, setPasswordPersist] =
    usePasswordPersistAtom();
  const [{ isBiologyAuthSwitchOn }] = useSettingsPersistAtom();
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
        // Save new password to secure storage for biometric unlock on extension.
        // Clear skipPrfCache to avoid an unexpected WebAuthn prompt if this
        // dialog was opened within a promptPasswordVerify flow.
        if (platformEnv.isExtension && isBiologyAuthSwitchOn) {
          try {
            await backgroundApiProxy.servicePassword.setSkipPrfCache(false);
            const prfCredentialId =
              await biologyAuthUtils.savePasswordForPasskey(updatedPassword, {
                repairBrokenState: true,
              });
            if (prfCredentialId && prfCredentialId !== webAuthCredentialId) {
              setPasswordPersist((v) => ({
                ...v,
                webAuthCredentialId: prfCredentialId,
              }));
            }
          } catch (e) {
            console.error('Failed to save new password to secure storage:', e);
          }
        }
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
    [
      oldEncodedPassword,
      onUpdateRes,
      intl,
      isBiologyAuthSwitchOn,
      setPasswordPersist,
      webAuthCredentialId,
    ],
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
