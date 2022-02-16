import React, { useCallback } from 'react';

import { useNavigation } from '@react-navigation/core';
import { useIntl } from 'react-intl';

import {
  Button,
  Form,
  KeyboardDismissView,
  Modal,
  Typography,
  useForm,
} from '@onekeyhq/components';
import { useAppDispatch } from '@onekeyhq/kit/src/hooks/redux';
import {
  refreshLoginAt,
  setPassword,
} from '@onekeyhq/kit/src/store/reducers/status';

import { MiscModalRoutes } from '../../../routes/Modal/Misc';
import {
  ModalRoutes,
  RootRoutes,
  RootRoutesParams,
} from '../../../routes/types';

import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

type NavigationProps = NativeStackNavigationProp<
  RootRoutesParams,
  RootRoutes.Root
>;

type FieldValues = {
  password: string;
  confirmPassword: string;
};

const SetPassword = () => {
  const intl = useIntl();
  const dispatch = useAppDispatch();
  const {
    control,
    handleSubmit,
    formState: { isValid },
    getValues,
  } = useForm<FieldValues>({
    mode: 'onChange',
    defaultValues: { password: '', confirmPassword: '' },
  });
  const navigation = useNavigation<NavigationProps>();
  const onValid = useCallback(
    (values: FieldValues) => {
      dispatch(refreshLoginAt());
      dispatch(setPassword(values.password));
      setTimeout(() => {
        navigation.navigate(RootRoutes.Modal, {
          screen: ModalRoutes.Misc,
          params: { screen: MiscModalRoutes.WalletGuide },
        });
      }, 100);
    },
    [navigation, intl, dispatch],
  );
  const onSubmit = handleSubmit(onValid);

  return (
    <Modal footer={null}>
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
            defaultValue=""
            control={control}
            rules={{
              required: intl.formatMessage({ id: 'form__field_is_required' }),
              pattern: {
                value: /^[a-zA-Z0-9]{10,24}$/g,
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
            defaultValue=""
            control={control}
            rules={{
              required: intl.formatMessage({ id: 'form__field_is_required' }),
              pattern: {
                value: /^[a-zA-Z0-9]{10,24}$/g,
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
          <Button
            type="primary"
            size="xl"
            onPress={onSubmit}
            isDisabled={!isValid}
          >
            {intl.formatMessage({
              id: 'action__continue',
              defaultMessage: 'Continue',
            })}
          </Button>
        </Form>
      </KeyboardDismissView>
    </Modal>
  );
};

export default SetPassword;
