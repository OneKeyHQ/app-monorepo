import { memo, useCallback, useEffect, useMemo, useState } from 'react';

import { AuthenticationType } from 'expo-local-authentication';
import { useIntl } from 'react-intl';
import { Keyboard } from 'react-native';

import { Stack } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { biologyAuthUtils } from '@onekeyhq/kit-bg/src/services/ServicePassword/biologyAuthUtils';
import { useSettingsPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import {
  usePasswordAtom,
  usePasswordBiologyAuthInfoAtom,
  usePasswordPersistAtom,
} from '@onekeyhq/kit-bg/src/states/jotai/atoms/password';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';
import { EPasswordVerifyStatus } from '@onekeyhq/shared/types/password';

import { useWebAuthActions } from '../../BiologyAuthComponent/hooks/useWebAuthActions';
import PasswordVerify from '../components/PasswordVerify';

import type { LayoutChangeEvent } from 'react-native';

interface IPasswordVerifyProps {
  onVerifyRes: (password: string) => void;
  onLayout?: (e: LayoutChangeEvent) => void;
}

interface IPasswordVerifyForm {
  password: string;
}

const PasswordVerifyContainer = ({
  onVerifyRes,
  onLayout,
}: IPasswordVerifyProps) => {
  const intl = useIntl();
  const [{ authType, isEnable }] = usePasswordBiologyAuthInfoAtom();
  const { verifiedPasswordWebAuth } = useWebAuthActions();
  const [{ webAuthCredentialId }] = usePasswordPersistAtom();
  const [{ isBiologyAuthSwitchOn }] = useSettingsPersistAtom();
  const [hasCachedPassword, setHasCachedPassword] = useState(false);
  const [hasSecurePassword, setHasSecurePassword] = useState(false);

  useEffect(() => {
    if (webAuthCredentialId && isBiologyAuthSwitchOn) {
      void (async () => {
        setHasCachedPassword(
          !!(await backgroundApiProxy.servicePassword.getCachedPassword()),
        );
      })();
    }
  }, [webAuthCredentialId, isBiologyAuthSwitchOn]);

  useEffect(() => {
    if (isEnable && isBiologyAuthSwitchOn) {
      void (async () => {
        try {
          const securePassword = await biologyAuthUtils.getPassword();
          setHasSecurePassword(!!securePassword);
        } catch (e) {
          setHasSecurePassword(false);
        }
      })();
    }
  }, [isEnable, isBiologyAuthSwitchOn]);

  const isBiologyAuthEnable = useMemo(
    // both webAuth or biologyAuth are enabled
    () =>
      isBiologyAuthSwitchOn &&
      ((isEnable && hasSecurePassword) ||
        (!!webAuthCredentialId && !!hasCachedPassword)),
    [
      hasCachedPassword,
      hasSecurePassword,
      isEnable,
      webAuthCredentialId,
      isBiologyAuthSwitchOn,
    ],
  );
  const [{ passwordVerifyStatus }, setPasswordAtom] = usePasswordAtom();
  useEffect(() => {
    setPasswordAtom((v) => ({
      ...v,
      passwordVerifyStatus: { value: EPasswordVerifyStatus.DEFAULT },
    }));
  }, [setPasswordAtom]);

  const onBiologyAuthenticate = useCallback(async () => {
    if (
      passwordVerifyStatus.value === EPasswordVerifyStatus.VERIFYING ||
      passwordVerifyStatus.value === EPasswordVerifyStatus.VERIFIED
    ) {
      return;
    }
    setPasswordAtom((v) => ({
      ...v,
      passwordVerifyStatus: { value: EPasswordVerifyStatus.VERIFYING },
    }));
    try {
      let biologyAuthRes;
      if (!isEnable && isBiologyAuthEnable) {
        // webAuth verify
        biologyAuthRes = await verifiedPasswordWebAuth();
      } else {
        biologyAuthRes =
          await backgroundApiProxy.servicePassword.verifyPassword({
            password: '',
            isBiologyAuth: true,
          });
      }
      if (biologyAuthRes) {
        setPasswordAtom((v) => ({
          ...v,
          passwordVerifyStatus: { value: EPasswordVerifyStatus.VERIFIED },
        }));
        onVerifyRes(biologyAuthRes);
      } else {
        setPasswordAtom((v) => ({
          ...v,
          passwordVerifyStatus: {
            value: EPasswordVerifyStatus.ERROR,
            message: intl.formatMessage({
              id: ETranslations.auth_error_password_incorrect,
            }),
          },
        }));
        throw new Error('biology auth verify error');
      }
    } catch (e) {
      setPasswordAtom((v) => ({
        ...v,
        passwordVerifyStatus: {
          value: EPasswordVerifyStatus.ERROR,
          message: intl.formatMessage({
            id: ETranslations.auth_error_password_incorrect,
          }),
        },
      }));
    }
  }, [
    intl,
    isBiologyAuthEnable,
    isEnable,
    onVerifyRes,
    passwordVerifyStatus.value,
    setPasswordAtom,
    verifiedPasswordWebAuth,
  ]);

  const onInputPasswordAuthenticate = useCallback(
    async (data: IPasswordVerifyForm) => {
      if (
        passwordVerifyStatus.value === EPasswordVerifyStatus.VERIFYING ||
        passwordVerifyStatus.value === EPasswordVerifyStatus.VERIFIED
      ) {
        return;
      }
      setPasswordAtom((v) => ({
        ...v,
        passwordVerifyStatus: { value: EPasswordVerifyStatus.VERIFYING },
      }));
      try {
        const encodePassword =
          await backgroundApiProxy.servicePassword.encodeSensitiveText({
            text: data.password,
          });
        const verifiedPassword =
          await backgroundApiProxy.servicePassword.verifyPassword({
            password: encodePassword,
          });
        setPasswordAtom((v) => ({
          ...v,
          passwordVerifyStatus: { value: EPasswordVerifyStatus.VERIFIED },
        }));
        if (platformEnv.isNativeAndroid) {
          Keyboard.dismiss();
          await timerUtils.wait(0);
        }
        onVerifyRes(verifiedPassword);
      } catch (e) {
        setPasswordAtom((v) => ({
          ...v,
          passwordVerifyStatus: {
            value: EPasswordVerifyStatus.ERROR,
            message: intl.formatMessage({
              id: ETranslations.auth_error_password_incorrect,
            }),
          },
        }));
      }
    },
    [intl, onVerifyRes, passwordVerifyStatus.value, setPasswordAtom],
  );

  return (
    <Stack onLayout={onLayout}>
      <PasswordVerify
        onPasswordChange={() => {
          setPasswordAtom((v) => ({
            ...v,
            passwordVerifyStatus: { value: EPasswordVerifyStatus.DEFAULT },
          }));
        }}
        status={passwordVerifyStatus}
        onBiologyAuth={onBiologyAuthenticate}
        onInputPasswordAuth={onInputPasswordAuthenticate}
        isEnable={isBiologyAuthEnable}
        authType={isEnable ? authType : [AuthenticationType.FINGERPRINT]}
      />
    </Stack>
  );
};
export default memo(PasswordVerifyContainer);
