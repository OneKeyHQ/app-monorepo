import React, { FC, useCallback, useState } from 'react';

import { useNavigation } from '@react-navigation/core';
import { useIntl } from 'react-intl';

import {
  Box,
  Button,
  Form,
  KeyboardDismissView,
  Modal,
  Typography,
  useForm,
} from '@onekeyhq/components';

import backgroundApiProxy from '../../background/instance/backgroundApiProxy';
import LocalAuthenticationButton from '../../components/LocalAuthenticationButton';
import { useStatus } from '../../hooks/redux';
import { useLocalAuthentication } from '../../hooks/useLocalAuthentication';
import { useToast } from '../../hooks/useToast';
import { runtimeUnlock } from '../../store/reducers/general';
import { setEnableAppLock } from '../../store/reducers/settings';
import { setPasswordCompleted, unlock } from '../../store/reducers/status';

import { PasswordRoutes, PasswordRoutesParams } from './types';

import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

type NavigationProps = NativeStackNavigationProp<
  PasswordRoutesParams,
  PasswordRoutes.PasswordRoutes
>;

type EnterPasswordProps = { onNext?: (password: string) => void };
type FieldValues = { password: string };

const EnterPassword: FC<EnterPasswordProps> = ({ onNext }) => {
  const intl = useIntl();
  const {
    control,
    handleSubmit,
    setError,
    formState: { isValid },
  } = useForm<FieldValues>({
    defaultValues: { password: '' },
    mode: 'onChange',
  });
  const onSubmit = useCallback(
    async (values: FieldValues) => {
      const isOK = await backgroundApiProxy.engine.verifyMasterPassword(
        values.password,
      );
      if (isOK) {
        onNext?.(values.password);
      } else {
        setError('password', {
          message: intl.formatMessage({
            id: 'msg__wrong_password',
            defaultMessage: 'Wrong password.',
          }),
        });
      }
    },
    [onNext, intl, setError],
  );

  return (
    <KeyboardDismissView px={{ base: 4, md: 0 }}>
      <Typography.DisplayLarge textAlign="center" mb={2}>
        {intl.formatMessage({
          id: 'title__enter_password',
          defaultMessage: 'Enter Password',
        })}
      </Typography.DisplayLarge>
      <Typography.Body1 textAlign="center" color="text-subdued">
        {intl.formatMessage({
          id: 'content__enter_current_password_before_resetting_it',
          defaultMessage: 'Enter the old password before resetting it',
        })}
      </Typography.Body1>
      <Form mt="8">
        <Form.Item
          name="password"
          label={intl.formatMessage({
            id: 'form__password',
            defaultMessage: 'Password',
          })}
          control={control}
          rules={{
            required: intl.formatMessage({
              id: 'form__field_is_required',
            }),
          }}
        >
          <Form.PasswordInput />
        </Form.Item>
        <Button
          size="xl"
          type="primary"
          isDisabled={!isValid}
          onPress={handleSubmit(onSubmit)}
        >
          {intl.formatMessage({
            id: 'action__continue',
            defaultMessage: 'Continue',
          })}
        </Button>
        <Box display="flex" justifyContent="center" alignItems="center">
          <LocalAuthenticationButton onOk={onNext} />
        </Box>
      </Form>
    </KeyboardDismissView>
  );
};

type PasswordsFieldValues = {
  password: string;
  confirmPassword: string;
};

const SetNewPassword: FC<{ oldPassword: string }> = ({ oldPassword }) => {
  const intl = useIntl();
  const { passwordCompleted } = useStatus();
  const toast = useToast();
  const { savePassword } = useLocalAuthentication();
  const { dispatch } = backgroundApiProxy;
  const navigation = useNavigation<NavigationProps>();
  const {
    control,
    handleSubmit,
    getValues,
    formState: { isValid },
  } = useForm<PasswordsFieldValues>({
    defaultValues: { password: '', confirmPassword: '' },
    mode: 'onChange',
  });
  const onSubmit = useCallback(
    async (values: PasswordsFieldValues) => {
      await backgroundApiProxy.engine.updatePassword(
        oldPassword,
        values.password,
      );
      await savePassword(values.password);
      dispatch(unlock());
      dispatch(runtimeUnlock());
      if (!passwordCompleted) {
        dispatch(setPasswordCompleted());
        dispatch(setEnableAppLock(true));
      }
      if (navigation.canGoBack()) {
        navigation.goBack();
      } else {
        navigation?.popToTop?.();
      }
      toast.info(
        intl.formatMessage({
          id: 'msg__password_changed',
          defaultMessage: 'Password changed',
        }),
      );
    },
    [
      navigation,
      toast,
      intl,
      dispatch,
      oldPassword,
      savePassword,
      passwordCompleted,
    ],
  );
  return (
    <KeyboardDismissView px={{ base: 4, md: 0 }}>
      <Typography.DisplayLarge textAlign="center" mb={2}>
        {intl.formatMessage({
          id: 'title__set_password',
          defaultMessage: 'Set Password',
        })}
      </Typography.DisplayLarge>
      <Typography.Body1 textAlign="center" color="text-subdued">
        {intl.formatMessage({
          id: 'Only_you_can_unlock_your_wallet',
          defaultMessage: 'Only you can unlock your wallet',
        })}
      </Typography.Body1>
      <Form mt="8">
        <Form.Item
          name="password"
          label={intl.formatMessage({
            id: 'form__password',
            defaultMessage: 'Password',
          })}
          control={control}
          rules={{
            required: intl.formatMessage({ id: 'form__field_is_required' }),
            minLength: {
              value: 8,
              message: intl.formatMessage({
                id: 'msg__password_validation',
              }),
            },
            validate: (value) => {
              const confirmPassword = getValues('confirmPassword');
              if (!confirmPassword) return undefined;
              return confirmPassword !== value
                ? intl.formatMessage({
                    id: 'msg__password_needs_to_be_the_same',
                  })
                : undefined;
            },
          }}
        >
          <Form.PasswordInput />
        </Form.Item>
        <Form.Item
          name="confirmPassword"
          label={intl.formatMessage({
            id: 'Confirm_password',
            defaultMessage: 'Confirm Password',
          })}
          control={control}
          rules={{
            required: intl.formatMessage({ id: 'form__field_is_required' }),
            minLength: {
              value: 8,
              message: intl.formatMessage({
                id: 'msg__password_validation',
              }),
            },
            validate: (value) => {
              const password = getValues('password');
              if (!password) return undefined;
              return password !== value
                ? intl.formatMessage({
                    id: 'msg__password_needs_to_be_the_same',
                  })
                : undefined;
            },
          }}
        >
          <Form.PasswordInput />
        </Form.Item>
        <Button
          size="xl"
          type="primary"
          isDisabled={!isValid}
          onPromise={handleSubmit(onSubmit)}
        >
          {intl.formatMessage({
            id: 'action__continue',
            defaultMessage: 'Continue',
          })}
        </Button>
      </Form>
    </KeyboardDismissView>
  );
};

const ChangePassword = () => {
  const [oldPassword, setOldPassword] = useState('');
  return oldPassword ? (
    <SetNewPassword oldPassword={oldPassword} />
  ) : (
    <EnterPassword onNext={setOldPassword} />
  );
};

export const Password = () => {
  const { passwordCompleted } = useStatus();
  const [isHasPassword] = useState(passwordCompleted);

  return (
    <Modal footer={null}>
      <Box>
        {isHasPassword ? <ChangePassword /> : <SetNewPassword oldPassword="" />}
      </Box>
    </Modal>
  );
};

export default Password;
