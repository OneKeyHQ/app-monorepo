import React, { FC, useCallback, useEffect, useState } from 'react';

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
import { useLocalAuthentication, useToast } from '../../hooks';
import { useAppDispatch, useData } from '../../hooks/redux';
import { setEnableLocalAuthentication } from '../../store/reducers/settings';

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
  withEnableAuthentication: boolean;
};

const SetNewPassword: FC<{ oldPassword: string }> = ({ oldPassword }) => {
  const intl = useIntl();
  const toast = useToast();
  const { isOk } = useLocalAuthentication();
  const dispatch = useAppDispatch();
  const { serviceApp } = backgroundApiProxy;
  const navigation = useNavigation<NavigationProps>();
  const {
    control,
    handleSubmit,
    getValues,
    setValue,
    watch,
    formState: { isValid },
  } = useForm<PasswordsFieldValues>({
    defaultValues: { password: '', confirmPassword: '' },
    mode: 'onChange',
  });
  const onSubmit = useCallback(
    async (values: PasswordsFieldValues) => {
      await serviceApp.updatePassword(oldPassword, values.password);
      if (values.withEnableAuthentication) {
        dispatch(setEnableLocalAuthentication(true));
      }
      // if oldPassword is empty. set password
      if (!oldPassword) {
        toast.show({
          title: intl.formatMessage({
            id: 'msg__password_has_been_set',
          }),
        });
      } else {
        toast.show({
          title: intl.formatMessage({
            id: 'msg__password_changed',
          }),
        });
      }
      navigation.goBack();
    },
    [navigation, toast, intl, oldPassword, serviceApp, dispatch],
  );

  const watchedPassword = watch(['password', 'confirmPassword']);

  useEffect(() => {
    const normalize = (text: string) =>
      text
        .split('')
        .filter((chat) => chat.charCodeAt(0) >= 32 && chat.charCodeAt(0) <= 126)
        .join('');
    const [password, confirmPassword] = watchedPassword.map(normalize);
    if (password !== watchedPassword[0]) {
      setValue('password', password);
    }
    if (confirmPassword !== watchedPassword[1]) {
      setValue('confirmPassword', confirmPassword);
    }
  }, [watchedPassword, setValue]);

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
            maxLength: {
              value: 24,
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
            maxLength: {
              value: 24,
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
        {isOk && !oldPassword ? (
          <Form.Item name="withEnableAuthentication" control={control}>
            <Form.CheckBox
              title={intl.formatMessage(
                { id: 'content__authentication_with' },
                {
                  0: `${intl.formatMessage({
                    id: 'content__face_id',
                  })}/${intl.formatMessage({ id: 'content__touch_id' })}`,
                },
              )}
            />
          </Form.Item>
        ) : null}
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
  const { isPasswordSet } = useData();
  const [isHasPassword] = useState(isPasswordSet);

  return (
    <Modal footer={null}>
      <Box>
        {isHasPassword ? <ChangePassword /> : <SetNewPassword oldPassword="" />}
      </Box>
    </Modal>
  );
};

export default Password;
