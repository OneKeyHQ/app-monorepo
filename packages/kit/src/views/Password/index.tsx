import type { FC } from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';

import { useNavigation } from '@react-navigation/core';
import { useIntl } from 'react-intl';

import {
  Box,
  Button,
  Center,
  Form,
  KeyboardDismissView,
  Modal,
  ToastManager,
  Typography,
  useForm,
} from '@onekeyhq/components';
import type { LocaleIds } from '@onekeyhq/components/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import backgroundApiProxy from '../../background/instance/backgroundApiProxy';
import LocalAuthenticationButton from '../../components/LocalAuthenticationButton';
import { useLocalAuthentication } from '../../hooks';
import { useAppSelector, useData } from '../../hooks/redux';
import { setEnableLocalAuthentication } from '../../store/reducers/settings';
import { savePassword } from '../../utils/localAuthentication';

import type { PasswordRoutes, PasswordRoutesParams } from './types';
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
          <Form.PasswordInput
            autoFocus
            // press enter key to submit
            onSubmitEditing={handleSubmit(onSubmit)}
          />
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
        {platformEnv.isNative ? (
          <Box display="flex" justifyContent="center" alignItems="center">
            <LocalAuthenticationButton onOk={onNext} />
          </Box>
        ) : null}
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
  const [attention, showAttention] = useState(false);
  const navigation = useNavigation<NavigationProps>();
  const { dispatch } = backgroundApiProxy;

  const ref = useRef({ unmount: false });
  const authenticationType = useAppSelector((s) => s.status.authenticationType);
  const enableLocalAuthentication = useAppSelector(
    (s) => s.settings.enableLocalAuthentication,
  );
  const { isOk } = useLocalAuthentication();

  const {
    control,
    handleSubmit,
    getValues,
    setValue,
    watch,
    formState: { isValid },
  } = useForm<PasswordsFieldValues>({
    defaultValues: {
      password: '',
      confirmPassword: '',
    },
    mode: 'onChange',
  });

  const addAttention = useCallback(() => {
    setTimeout(() => {
      if (ref.current.unmount) return;
      showAttention(true);
    }, 2 * 1000);
  }, []);

  const onSubmit = useCallback(
    async (values: PasswordsFieldValues) => {
      try {
        addAttention();
        await backgroundApiProxy.serviceApp.updatePassword(
          oldPassword,
          values.password,
        );
      } catch (e) {
        const errorKey = (e as { key: LocaleIds }).key;
        ToastManager.show({ title: intl.formatMessage({ id: errorKey }) });
        return;
      }

      if (values.withEnableAuthentication) {
        dispatch(setEnableLocalAuthentication(true));
        savePassword(values.password);
      }
      if (enableLocalAuthentication) {
        savePassword(values.password);
      }
      // if oldPassword is empty. set password
      if (!oldPassword) {
        ToastManager.show({
          title: intl.formatMessage({
            id: 'msg__password_has_been_set',
          }),
        });
      } else {
        ToastManager.show({
          title: intl.formatMessage({
            id: 'msg__password_changed',
          }),
        });
      }
      navigation.goBack();
    },
    [
      navigation,
      intl,
      oldPassword,
      dispatch,
      enableLocalAuthentication,
      addAttention,
    ],
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

  useEffect(
    () => () => {
      ref.current.unmount = true;
    },
    [],
  );

  const text =
    authenticationType === 'FACIAL'
      ? intl.formatMessage({
          id: 'content__face_id',
        })
      : intl.formatMessage({ id: 'content__touch_id' });

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
              value: 128,
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
          <Form.PasswordInput autoFocus />
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
              value: 128,
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
          <Form.PasswordInput
            // press enter key to submit
            onSubmitEditing={handleSubmit(onSubmit)}
          />
        </Form.Item>
        {isOk && !oldPassword ? (
          <Form.Item
            name="withEnableAuthentication"
            defaultValue={isOk}
            control={control}
          >
            <Form.CheckBox
              title={intl.formatMessage(
                { id: 'content__authentication_with' },
                {
                  0: text,
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
        {attention ? (
          <Center>
            <Typography.Body2 color="text-subdued">
              {intl.formatMessage({ id: 'content__change_password_attention' })}
            </Typography.Body2>
          </Center>
        ) : null}
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
