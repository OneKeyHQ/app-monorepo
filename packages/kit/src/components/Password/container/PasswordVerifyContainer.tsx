import { memo, useCallback, useState } from 'react';

import { useIntl } from 'react-intl';

import { Stack } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { usePasswordBiologyAuthInfoAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms/password';

import PasswordVerify from '../components/PasswordVerify';

import type { LayoutChangeEvent } from 'react-native';

interface IPasswordVerifyProps {
  onVerifyRes: (password: string) => void;
  onLayout: (e: LayoutChangeEvent) => void;
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
  const [status, setStatues] = useState<{
    value: 'default' | 'verifying' | 'verified' | 'error';
    message?: string;
  }>({ value: 'default' });
  const onBiologyAuthenticate = useCallback(async () => {
    if (status.value === 'verifying') {
      return;
    }
    setStatues({ value: 'verifying' });
    try {
      const biologyAuthRes =
        await backgroundApiProxy.servicePassword.verifyPassword({
          password: '',
          isBiologyAuth: true,
        });

      onVerifyRes(biologyAuthRes);
      setStatues({ value: 'verified' });
    } catch (e) {
      setStatues({
        value: 'error',
        message: intl.formatMessage({ id: 'msg__verification_failure' }),
      });
    }
  }, [intl, onVerifyRes, status.value]);

  const onInputPasswordAuthenticate = useCallback(
    async (data: IPasswordVerifyForm) => {
      setStatues({ value: 'verifying' });
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
        setStatues({ value: 'verified' });
      } catch (e) {
        setStatues({ value: 'error', message: 'password verify error' });
      }
    },
    [onVerifyRes],
  );

  return (
    <Stack onLayout={onLayout}>
      <PasswordVerify
        onPasswordChange={() => {
          setStatues({ value: 'default' });
        }}
        status={status}
        onBiologyAuth={onBiologyAuthenticate}
        onInputPasswordAuth={onInputPasswordAuthenticate}
        isEnable={isEnable}
        authType={authType}
      />
    </Stack>
  );
};
export default memo(PasswordVerifyContainer);
