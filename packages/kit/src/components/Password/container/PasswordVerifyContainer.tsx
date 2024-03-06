import { memo, useCallback, useEffect, useMemo, useState } from 'react';

import { AuthenticationType } from 'expo-local-authentication';
import { useIntl } from 'react-intl';

import { Stack } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import {
  usePasswordBiologyAuthInfoAtom,
  usePasswordPersistAtom,
} from '@onekeyhq/kit-bg/src/states/jotai/atoms/password';
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
  const [hasCachedPassword, setHasCachedPassword] = useState(false);

  useEffect(() => {
    if (webAuthCredentialId) {
      void (async () => {
        setHasCachedPassword(
          !!(await backgroundApiProxy.servicePassword.getCachedPassword()),
        );
      })();
    }
  }, [webAuthCredentialId]);

  const isBiologyAuthEnable = useMemo(
    // both webAuth or biologyAuth are enabled
    () => isEnable || (!!webAuthCredentialId && !!hasCachedPassword),
    [hasCachedPassword, isEnable, webAuthCredentialId],
  );
  const [status, setStatues] = useState<{
    value: EPasswordVerifyStatus;
    message?: string;
  }>({ value: EPasswordVerifyStatus.DEFAULT });

  const onBiologyAuthenticate = useCallback(async () => {
    if (status.value === EPasswordVerifyStatus.VERIFYING) {
      return;
    }
    setStatues({ value: EPasswordVerifyStatus.VERIFYING });
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
        onVerifyRes(biologyAuthRes);
        setStatues({ value: EPasswordVerifyStatus.VERIFIED });
      } else {
        throw new Error('biology auth verify error');
      }
    } catch (e) {
      setStatues({
        value: EPasswordVerifyStatus.ERROR,
        message: intl.formatMessage({ id: 'msg__verification_failure' }),
      });
    }
  }, [
    intl,
    isBiologyAuthEnable,
    isEnable,
    onVerifyRes,
    status.value,
    verifiedPasswordWebAuth,
  ]);

  const onInputPasswordAuthenticate = useCallback(
    async (data: IPasswordVerifyForm) => {
      setStatues({ value: EPasswordVerifyStatus.VERIFYING });
      try {
        const encodePassword =
          await backgroundApiProxy.servicePassword.encodeSensitiveText({
            text: data.password,
          });
        const verifiedPassword =
          await backgroundApiProxy.servicePassword.verifyPassword({
            password: encodePassword,
          });
        onVerifyRes(verifiedPassword);
        setStatues({ value: EPasswordVerifyStatus.VERIFIED });
      } catch (e) {
        setStatues({
          value: EPasswordVerifyStatus.ERROR,
          message: 'password verify error',
        });
      }
    },
    [onVerifyRes],
  );

  return (
    <Stack onLayout={onLayout}>
      <PasswordVerify
        onPasswordChange={() => {
          setStatues({ value: EPasswordVerifyStatus.DEFAULT });
        }}
        status={status}
        onBiologyAuth={onBiologyAuthenticate}
        onInputPasswordAuth={onInputPasswordAuthenticate}
        isEnable={isBiologyAuthEnable}
        authType={isEnable ? authType : [AuthenticationType.FINGERPRINT]}
      />
    </Stack>
  );
};
export default memo(PasswordVerifyContainer);
