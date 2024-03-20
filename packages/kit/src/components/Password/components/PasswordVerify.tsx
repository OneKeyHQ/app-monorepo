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

import type { IKeyOfIcons, IPropsWithTestId } from '@onekeyhq/components';
import { Form, Input, useForm } from '@onekeyhq/components';
import { usePasswordPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { EPasswordVerifyStatus } from '@onekeyhq/shared/types/password';

import { useHandleAppStateActive } from '../../../hooks/useHandleAppStateActive';
import { PasswordRegex, getPasswordKeyboardType } from '../utils';

interface IPasswordVerifyProps {
  authType: AuthenticationType[];
  isEnable: boolean;
  onPasswordChange: (e: any) => void;
  onBiologyAuth: () => void;
  onInputPasswordAuth: (data: IPasswordVerifyForm) => void;
  status: {
    value: EPasswordVerifyStatus;
    message?: string;
  };
}

interface IPasswordVerifyForm {
  password: string;
}

const noop = () => {};

const PasswordVerify = ({
  authType,
  isEnable,
  status,
  onBiologyAuth,
  onPasswordChange,
  onInputPasswordAuth,
}: IPasswordVerifyProps) => {
  const form = useForm<IPasswordVerifyForm>({
    mode: 'onSubmit',
    reValidateMode: 'onSubmit',
    defaultValues: { password: '' },
  });

  const [secureEntry, setSecureEntry] = useState(true);
  const lastTime = useRef(0);
  const passwordInput = form.watch('password');
  const [{ manualLocking }] = usePasswordPersistAtom();

  const rightActions = useMemo(() => {
    const actions: IPropsWithTestId<{
      iconName?: IKeyOfIcons;
      onPress?: () => void;
      loading?: boolean;
    }>[] = [];
    if (isEnable && !passwordInput) {
      actions.push({
        iconName:
          authType && authType.includes(AuthenticationType.FACIAL_RECOGNITION)
            ? 'FaceArcSolid'
            : 'TouchId2Outline',
        onPress: onBiologyAuth,
        loading: status.value === EPasswordVerifyStatus.VERIFYING,
      });
    } else {
      actions.push({
        iconName: secureEntry ? 'EyeOutline' : 'EyeOffOutline',
        onPress: () => {
          setSecureEntry(!secureEntry);
        },
      });
      actions.push({
        iconName: 'ArrowRightOutline',
        onPress: form.handleSubmit(onInputPasswordAuth),
        loading: status.value === EPasswordVerifyStatus.VERIFYING,
        testID: 'verifying-password',
      });
    }

    return actions;
  }, [
    isEnable,
    passwordInput,
    authType,
    onBiologyAuth,
    status.value,
    secureEntry,
    form,
    onInputPasswordAuth,
  ]);

  useEffect(() => {
    if (status.value === EPasswordVerifyStatus.ERROR) {
      form.setError('password', { message: status.message });
      form.setFocus('password');
    } else {
      form.clearErrors('password');
    }
  }, [form, status]);

  useLayoutEffect(() => {
    if (
      isEnable &&
      !passwordInput &&
      status.value === EPasswordVerifyStatus.DEFAULT &&
      !manualLocking
    ) {
      void onBiologyAuth();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isEnable, manualLocking]);

  // Perform biology verification upon returning to the backend after a 1-second interval.
  const onActive = useCallback(() => {
    const now = Date.now();
    if (now - lastTime.current > 1000) {
      lastTime.current = now;
      if (
        isEnable &&
        !passwordInput &&
        status.value === EPasswordVerifyStatus.DEFAULT &&
        !manualLocking
      ) {
        void onBiologyAuth();
      }
    }
  }, [isEnable, passwordInput, status.value, manualLocking, onBiologyAuth]);

  useHandleAppStateActive(isEnable ? onActive : noop);

  return (
    <Form form={form}>
      <Form.Field
        name="password"
        rules={{
          required: { value: true, message: 'req input text' },
          onChange: onPasswordChange,
        }}
      >
        <Input
          autoFocus
          selectTextOnFocus
          size="large"
          disabled={status.value === EPasswordVerifyStatus.VERIFYING}
          placeholder="Enter your password"
          flex={1}
          onChangeText={(text) => text.replace(PasswordRegex, '')}
          keyboardType={getPasswordKeyboardType(!secureEntry)}
          secureTextEntry={secureEntry}
          onSubmitEditing={form.handleSubmit(onInputPasswordAuth)}
          addOns={rightActions}
          testID="enter-password"
        />
      </Form.Field>
    </Form>
  );
};
export default memo(PasswordVerify);
