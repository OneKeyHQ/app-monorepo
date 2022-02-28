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

import LocalAuthenticationButton from '../../components/LocalAuthenticationButton';
import engine from '../../engine/EngineProvider';
import { useAppDispatch } from '../../hooks/redux';
import { useLocalAuthentication } from '../../hooks/useLocalAuthentication';
import { useToast } from '../../hooks/useToast';
import { unlock } from '../../store/reducers/status';

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
  const { control, handleSubmit, setError } = useForm<FieldValues>({
    defaultValues: { password: '' },
  });
  const onSubmit = useCallback(
    async (values: FieldValues) => {
      const isOK = await engine.verifyMasterPassword(values.password);
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
        >
          <Form.PasswordInput />
        </Form.Item>
        <Button size="xl" onPress={handleSubmit(onSubmit)}>
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
  const toast = useToast();
  const { savePassword } = useLocalAuthentication();
  const dispatch = useAppDispatch();
  const navigation = useNavigation<NavigationProps>();
  const { control, handleSubmit, getValues } = useForm<PasswordsFieldValues>({
    defaultValues: { password: '', confirmPassword: '' },
  });
  const onSubmit = useCallback(
    async (values: PasswordsFieldValues) => {
      await engine.updatePassword(oldPassword, values.password);
      await savePassword(values.password);
      dispatch(unlock());
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
    [navigation, toast, intl, dispatch, oldPassword, savePassword],
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
            validate: (value) =>
              getValues('password') !== value
                ? intl.formatMessage({
                    id: 'msg__password_needs_to_be_the_same',
                  })
                : undefined,
          }}
        >
          <Form.PasswordInput />
        </Form.Item>
        <Button size="xl" onPromise={handleSubmit(onSubmit)}>
          {intl.formatMessage({
            id: 'action__continue',
            defaultMessage: 'Continue',
          })}
        </Button>
      </Form>
    </KeyboardDismissView>
  );
};

export const Password = () => {
  const [oldPassword, setOldPassword] = useState('');
  return (
    <Modal footer={null}>
      <Box>
        {oldPassword ? (
          <SetNewPassword oldPassword={oldPassword} />
        ) : (
          <EnterPassword onNext={setOldPassword} />
        )}
      </Box>
    </Modal>
  );
};

export default Password;
