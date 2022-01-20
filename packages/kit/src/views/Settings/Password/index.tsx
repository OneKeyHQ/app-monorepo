import React, { FC, useCallback, useEffect, useState } from 'react';

import { useNavigation } from '@react-navigation/core';
import * as LocalAuthentication from 'expo-local-authentication';
import { useIntl } from 'react-intl';
import { Platform } from 'react-native';

import {
  Box,
  Button,
  Form,
  IconButton,
  KeyboardDismissView,
  Modal,
  Toast,
  Typography,
  useForm,
  useToast,
} from '@onekeyhq/components';

import { SettingsModalRoutes, SettingsRoutesParams } from './types';

import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

type NavigationProps = NativeStackNavigationProp<
  SettingsRoutesParams,
  SettingsModalRoutes.SetPasswordModal
>;

type EnterPasswordProps = { onNext?: () => void };

const EnterPassword: FC<EnterPasswordProps> = ({ onNext }) => {
  const { control } = useForm();
  const [hasHardware, setHasHardware] = useState<boolean>();
  const intl = useIntl();
  const onSubmit = useCallback(() => {
    onNext?.();
  }, [onNext]);
  const onAuthenticate = useCallback(async () => {
    const localAuthenticationResult =
      await LocalAuthentication.authenticateAsync({
        cancelLabel: 'Cancel',
        promptMessage: 'Face ID',
      });
    if (localAuthenticationResult.success) {
      onNext?.();
    }
    console.log('localAuthenticationResult', localAuthenticationResult);
  }, [onNext]);
  useEffect(() => {
    if (['ios', 'android'].includes(Platform.OS)) {
      LocalAuthentication.hasHardwareAsync().then((has) => {
        setHasHardware(has);
      });
    }
  }, []);
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
        <Button size="xl" onPress={onSubmit}>
          {intl.formatMessage({
            id: 'action__continue',
            defaultMessage: 'Continue',
          })}
        </Button>
        {hasHardware && ['ios', 'android'].includes(Platform.OS) ? (
          <Box display="flex" justifyContent="center" alignItems="center">
            <IconButton
              iconSize={24}
              name="FaceIdOutline"
              onPress={onAuthenticate}
            />
          </Box>
        ) : null}
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
    <KeyboardDismissView px={{ base: 4, md: 0 }}>
      <Typography.DisplayLarge textAlign="center" mb={2}>
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
