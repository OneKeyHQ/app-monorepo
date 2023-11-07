import { memo, useCallback, useState } from 'react';

import { useIntl } from 'react-intl';

import { encodePassword } from '@onekeyhq/core/src/secret';
import { useSettingsBiologyAuthInfoAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import PasswordVerify from '../components/PasswordVerify';

interface IPasswordVerifyProps {
  onVerifyRes: (password: string) => void;
}

interface IPasswordVerifyForm {
  password: string;
}

const PasswordVerifyContainer = ({ onVerifyRes }: IPasswordVerifyProps) => {
  const intl = useIntl();
  const [{ authType, isEnable }] = useSettingsBiologyAuthInfoAtom();
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
        await backgroundApiProxy.servicePassword.verifyBiologyAuth();
      if (biologyAuthRes) {
        onVerifyRes(biologyAuthRes);
        setStatues({ value: 'verified' });
      } else {
        setStatues({
          value: 'error',
          message: intl.formatMessage({ id: 'msg__verification_failure' }),
        });
      }
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
        const enCodePassword = encodePassword({ password: data.password });
        const verifiedPassword =
          await backgroundApiProxy.servicePassword.verifyPassword(
            enCodePassword,
          );
        if (verifiedPassword) {
          onVerifyRes(verifiedPassword);
          setStatues({ value: 'verified' });
        } else {
          setStatues({ value: 'error', message: 'password error' });
        }
      } catch (e) {
        setStatues({ value: 'error', message: 'password verify error' });
      }
    },
    [onVerifyRes],
  );

  return (
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
  );
};
export default memo(PasswordVerifyContainer);
