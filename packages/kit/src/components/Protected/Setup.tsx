import React, { FC, useCallback } from 'react';

import { useIntl } from 'react-intl';

import {
  Box,
  Button,
  Form,
  KeyboardDismissView,
  Typography,
  useForm,
} from '@onekeyhq/components';

import backgroundApiProxy from '../../background/instance/backgroundApiProxy';
import { useAppSelector, useLocalAuthentication } from '../../hooks';

type FieldValues = {
  password: string;
  confirmPassword: string;
  withEnableAuthentication: boolean;
};

type SetupProps = {
  skipSavePassword?: boolean;
  onOk?: (text: string, withEnableAuthentication?: boolean) => void;
  hideTitle?: boolean;
};

const Setup: FC<SetupProps> = ({ onOk, skipSavePassword, hideTitle }) => {
  const intl = useIntl();
  const { isOk } = useLocalAuthentication();
  const boardingCompleted = useAppSelector((s) => s.status.boardingCompleted);
  const authenticationType = useAppSelector((s) => s.status.authenticationType);
  const {
    control,
    handleSubmit,
    formState: { isValid },
    getValues,
  } = useForm<FieldValues>({
    mode: 'onBlur',
    reValidateMode: 'onBlur',
    defaultValues: {
      password: '',
      confirmPassword: '',
    },
  });
  const onSubmit = useCallback(
    async (values: FieldValues) => {
      if (boardingCompleted && !skipSavePassword) {
        await backgroundApiProxy.serviceApp.updatePassword('', values.password);
      }
      onOk?.(values.password, values.withEnableAuthentication);
    },
    [onOk, boardingCompleted, skipSavePassword],
  );
  const text =
    authenticationType === 'FACIAL'
      ? intl.formatMessage({
          id: 'content__face_id',
        })
      : intl.formatMessage({ id: 'content__touch_id' });

  return (
    <KeyboardDismissView px={{ base: hideTitle ? 0 : 4, md: 0 }}>
      {!hideTitle ? (
        <Box mb="8">
          <Typography.DisplayLarge textAlign="center" mb={2}>
            🔐{' '}
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
        </Box>
      ) : null}

      <Form>
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
          <Form.PasswordInput autoFocus />
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
          <Form.PasswordInput
            // press enter key to submit
            onSubmitEditing={handleSubmit(onSubmit)}
          />
        </Form.Item>
        {isOk ? (
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
          type="primary"
          size="xl"
          onPress={handleSubmit(onSubmit)}
          isDisabled={!isValid}
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

export default Setup;
