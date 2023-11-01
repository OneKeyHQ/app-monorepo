import {
  memo,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import { useIntl } from 'react-intl';

import type { ICON_NAMES } from '@onekeyhq/components';
import { Form, Input, Toast, useForm } from '@onekeyhq/components';

import backgroundApiProxy from '../../background/instance/backgroundApiProxy';
import {
  getPassword,
  localAuthenticate,
} from '../../utils/localAuthentication';
import { AppStatusActiveListener } from '../AppStatusActiveListener';

import useBiologyAuth from './hooks/useBiologyAuth';

interface IPasswordVerifyProps {
  onVerifyRes: (password: string) => void;
}

interface IPasswordVerifyForm {
  password: string;
}

const PasswordVerify = ({ onVerifyRes }: IPasswordVerifyProps) => {
  const form = useForm<IPasswordVerifyForm>({
    defaultValues: { password: '' },
  });
  const [status, setStatues] = useState<{
    value: 'default' | 'verifying' | 'verified' | 'error';
    message?: string;
  }>({ value: 'default' });
  const intl = useIntl();
  const [secureEntry, setSecureEntry] = useState(true);
  const { isSupportBiologyAuth } = useBiologyAuth();
  const lastTime = useRef(0);

  const passwordInput = form.watch('password');

  // 生物识别验证获取密码
  const onBiologyAuthenticate = useCallback(async () => {
    if (status.value === 'verifying') {
      return;
    }
    setStatues({ value: 'verifying' });
    try {
      const localAuthenticateResult = await localAuthenticate();
      if (localAuthenticateResult.success) {
        const password = await getPassword();
        if (password) {
          const verifiedPassword =
            await backgroundApiProxy.servicePassword.verifyPassword(password);
          if (verifiedPassword) {
            onVerifyRes(verifiedPassword);
            setStatues({ value: 'verified' });
          }
        }
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

  // 输入密码验证
  const onInputPasswordAuthenticate = useCallback(
    async (data: IPasswordVerifyForm) => {
      setStatues({ value: 'verifying' });
      try {
        const verifiedPassword =
          await backgroundApiProxy.servicePassword.verifyPassword(
            data.password,
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

  const rightActions = useMemo(() => {
    const actions: {
      iconName?: ICON_NAMES;
      onPress?: () => void;
      loading?: boolean;
    }[] = [];
    if (isSupportBiologyAuth && !passwordInput) {
      actions.push({
        iconName: 'FaceArcSolid',
        onPress: onBiologyAuthenticate,
        loading: status.value === 'verifying',
      });
    } else {
      actions.push({
        iconName: secureEntry ? 'EyeOutline' : 'EyeOffOutline',
        onPress: () => {
          setSecureEntry(!secureEntry);
        },
      });
      actions.push({
        iconName: 'ArrowRightCircleOutline',
        onPress: form.handleSubmit(onInputPasswordAuthenticate),
        loading: status.value === 'verifying',
      });
    }

    return actions;
  }, [
    isSupportBiologyAuth,
    passwordInput,
    onBiologyAuthenticate,
    status.value,
    form,
    onInputPasswordAuthenticate,
    secureEntry,
  ]);

  useEffect(() => {
    if (status.value === 'error') {
      form.setError('password', { message: status.message });
      form.setFocus('password');
    } else {
      form.clearErrors('password');
    }
  }, [form, status]);

  useLayoutEffect(() => {
    if (isSupportBiologyAuth && !passwordInput) {
      void onBiologyAuthenticate();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSupportBiologyAuth]);

  const onActive = useCallback(() => {
    const now = Date.now();
    if (now - lastTime.current > 1000) {
      lastTime.current = now;
      if (isSupportBiologyAuth && !passwordInput) {
        void onBiologyAuthenticate();
      }
    }
  }, [isSupportBiologyAuth, onBiologyAuthenticate, passwordInput]);

  return (
    <Form form={form}>
      <Form.Field
        name="password"
        rules={{
          required: { value: true, message: 'req input text' },
          onChange: () => {
            setStatues({ value: 'default' });
          },
        }}
      >
        <Input
          autoFocus
          selectTextOnFocus
          size="large"
          disabled={status.value === 'verifying'}
          placeholder="Enter your password"
          flex={1}
          secureTextEntry={secureEntry}
          addOns={rightActions}
        />
      </Form.Field>
      {isSupportBiologyAuth && <AppStatusActiveListener onActive={onActive} />}
    </Form>
  );
};
export default memo(PasswordVerify);
