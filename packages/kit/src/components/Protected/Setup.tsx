import React, { FC, useCallback } from 'react';

import { useIntl } from 'react-intl';

import {
  Button,
  Form,
  KeyboardDismissView,
  Typography,
  useForm,
} from '@onekeyhq/components';

import backgroundApiProxy from '../../background/instance/backgroundApiProxy';
import { useStatus } from '../../hooks/redux';
import { useLocalAuthentication } from '../../hooks/useLocalAuthentication';
import { setEnableAppLock } from '../../store/reducers/settings';
import { setPasswordCompleted } from '../../store/reducers/status';

type FieldValues = {
  password: string;
  confirmPassword: string;
};

type SetupProps = {
  onOk?: (text: string, isLocalAuthentication?: boolean) => void;
};

const Setup: FC<SetupProps> = ({ onOk }) => {
  const intl = useIntl();
  const { boardingCompleted } = useStatus();
  const { dispatch } = backgroundApiProxy;
  const { savePassword } = useLocalAuthentication();
  const {
    control,
    handleSubmit,
    formState: { isValid },
    getValues,
  } = useForm<FieldValues>({
    mode: 'onChange',
    defaultValues: { password: '', confirmPassword: '' },
  });
  const onSubmit = useCallback(
    async (values: FieldValues) => {
      if (boardingCompleted) {
        await savePassword(values.password);
        dispatch(setPasswordCompleted());
        dispatch(setEnableAppLock(true));
      }
      onOk?.(values.password, false);
    },
    [onOk, boardingCompleted, dispatch, savePassword],
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
          <Form.PasswordInput />
        </Form.Item>
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
