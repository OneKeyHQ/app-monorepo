import React, { FC, useCallback, useState } from 'react';

import { useIntl } from 'react-intl';

import {
  Box,
  Button,
  Form,
  KeyboardDismissView,
  Modal,
  Toast,
  Typography,
  useForm,
  useToast,
} from '@onekeyhq/components';

import { useNavigation } from '../../..';

import { SettingsModalRoutes, SettingsRoutesParams } from './types';

import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

type NavigationProps = NativeStackNavigationProp<
  SettingsRoutesParams,
  SettingsModalRoutes.SetPasswordModal
>;

type EnterPasswordProps = { onNext?: () => void };

const EnterPassword: FC<EnterPasswordProps> = ({ onNext }) => {
  const { control } = useForm();
  const intl = useIntl();
  const onSubmit = useCallback(() => {
    onNext?.();
  }, [onNext]);
  return (
    <KeyboardDismissView p="4">
      <Typography.DisplayLarge textAlign="center">
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
      <Form mt="4">
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
        <Button size="xl" onPress={onSubmit}>
          {intl.formatMessage({
            id: 'action__continue',
            defaultMessage: 'Continue',
          })}
        </Button>
      </Form>
    </KeyboardDismissView>
  );
};

const SetPassword = () => {
  const { control } = useForm();
  const intl = useIntl();
  const toast = useToast();
  const navigation = useNavigation<NavigationProps>();
  const onSubmit = useCallback(() => {
    if (navigation.canGoBack()) {
      navigation.goBack();
    } else {
      navigation?.popToTop?.();
    }
    toast.show({
      render: () => (
        <Toast
          title={intl.formatMessage({
            id: 'msg__password_changed',
            defaultMessage: 'Password changed',
          })}
        />
      ),
    });
  }, [navigation, toast, intl]);
  return (
    <KeyboardDismissView p="4">
      <Typography.DisplayLarge textAlign="center">
        {intl.formatMessage({
          id: 'title__set_password',
          defaultMessage: 'Set Password',
        })}
      </Typography.DisplayLarge>
      <Typography.Body1 textAlign="center" color="text-subdued">
        {intl.formatMessage({
          id: 'content__only_you_can_unlock_your_wallet',
          defaultMessage: 'Only you can unlock your wallet',
        })}
      </Typography.Body1>
      <Form mt="4">
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
        <Form.Item
          name="confirmPassword"
          label={intl.formatMessage({
            id: 'Confirm_password',
            defaultMessage: 'Confirm Password',
          })}
          control={control}
        >
          <Form.PasswordInput />
        </Form.Item>
        <Button size="xl" onPress={onSubmit}>
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
        {next ? (
          <SetPassword />
        ) : (
          <EnterPassword onNext={() => setNext(true)} />
        )}
      </Box>
    </Modal>
  );
};

export default Password;
