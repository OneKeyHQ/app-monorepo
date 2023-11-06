import {
  memo,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import { AuthenticationType } from 'expo-local-authentication';
import { useIntl } from 'react-intl';

import type { ICON_NAMES } from '@onekeyhq/components';
import { Form, Input, useForm } from '@onekeyhq/components';
import { encodePassword } from '@onekeyhq/core/src/secret';
import {
  useSettingsBiologyAuthTypeAtom,
  useSettingsIsBioAuthEnableAtom,
} from '@onekeyhq/kit-bg/src/states/jotai/atoms';

import backgroundApiProxy from '../../background/instance/backgroundApiProxy';
import { AppStatusActiveListener } from '../AppStatusActiveListener';

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
  const [isBioAuthEnable] = useSettingsIsBioAuthEnableAtom();
  const [bioAuthType] = useSettingsBiologyAuthTypeAtom();
  const lastTime = useRef(0);
  const passwordInput = form.watch('password');

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

  const rightActions = useMemo(() => {
    const actions: {
      iconName?: ICON_NAMES;
      onPress?: () => void;
      loading?: boolean;
    }[] = [];
    if (isBioAuthEnable && !passwordInput) {
      actions.push({
        iconName:
          bioAuthType && bioAuthType === AuthenticationType.FACIAL_RECOGNITION
            ? 'FaceArcSolid'
            : 'FinderOutline',
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
    isBioAuthEnable,
    passwordInput,
    bioAuthType,
    onBiologyAuthenticate,
    status.value,
    secureEntry,
    form,
    onInputPasswordAuthenticate,
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
    if (isBioAuthEnable && !passwordInput) {
      void onBiologyAuthenticate();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isBioAuthEnable]);

  // Perform biology verification upon returning to the backend after a 1-second interval.
  const onActive = useCallback(() => {
    const now = Date.now();
    if (now - lastTime.current > 1000) {
      lastTime.current = now;
      if (isBioAuthEnable && !passwordInput) {
        void onBiologyAuthenticate();
      }
    }
  }, [isBioAuthEnable, onBiologyAuthenticate, passwordInput]);

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
      {isBioAuthEnable && <AppStatusActiveListener onActive={onActive} />}
    </Form>
  );
};
export default memo(PasswordVerify);
