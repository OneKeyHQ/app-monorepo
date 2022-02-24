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
import { useAppDispatch, useStatus } from '../../hooks/redux';
import { useToast } from '../../hooks/useToast';
import { refreshLoginAt, setPassword } from '../../store/reducers/status';

import { PasswordRoutes, PasswordRoutesParams } from './types';

import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

type NavigationProps = NativeStackNavigationProp<
  PasswordRoutesParams,
  PasswordRoutes.PasswordRoutes
>;

type EnterPasswordProps = { onOk?: () => void };
type FieldValues = { password: string };

const EnterPassword: FC<EnterPasswordProps> = ({ onOk }) => {
  const intl = useIntl();
  const { password } = useStatus();
  const { control, handleSubmit, setError } = useForm<FieldValues>({
    defaultValues: { password: '' },
  });
  const onSubmit = useCallback(
    (values: FieldValues) => {
      if (values.password === password) {
        onOk?.();
      } else {
        setError('password', {
          message: intl.formatMessage({
            id: 'msg__wrong_password',
            defaultMessage: 'Wrong password.',
          }),
        });
      }
    },
    [onOk, intl, password, setError],
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
          <LocalAuthenticationButton onOk={onOk} />
        </Box>
      </Form>
    </KeyboardDismissView>
  );
};

type PasswordsFieldValues = {
  password: string;
  confirmPassword: string;
};

const SetPassword = () => {
  const intl = useIntl();
  const toast = useToast();
  const dispatch = useAppDispatch();
  const navigation = useNavigation<NavigationProps>();
  const { control, handleSubmit, getValues } = useForm<PasswordsFieldValues>({
    defaultValues: { password: '', confirmPassword: '' },
  });
  const onSubmit = useCallback(
    (values: PasswordsFieldValues) => {
      dispatch(setPassword(values.password));
      dispatch(refreshLoginAt());
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
    [navigation, toast, intl, dispatch],
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
            pattern: {
              value: /^(?![0-9]+$)(?![a-zA-Z]+$)[0-9A-Za-z]{10,24}$/g,
              message: intl.formatMessage({
                id: 'msg__password_should_be_between_10_and_24',
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
            pattern: {
              value: /^(?![0-9]+$)(?![a-zA-Z]+$)[0-9A-Za-z]{10,24}$/g,
              message: intl.formatMessage({
                id: 'msg__password_should_be_between_10_and_24',
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
        <Button size="xl" onPress={handleSubmit(onSubmit)}>
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
  const [next, setNext] = useState(false);
  return (
    <Modal footer={null}>
      <Box>
        {next ? <SetPassword /> : <EnterPassword onOk={() => setNext(true)} />}
      </Box>
    </Modal>
  );
};

export default Password;
