import React, { FC, useCallback } from 'react';

import { useIntl } from 'react-intl';

import {
  Button,
  Center,
  Form,
  KeyboardDismissView,
  Typography,
  useForm,
} from '@onekeyhq/components';

import backgroundApiProxy from '../../background/instance/backgroundApiProxy';
import { useSettings } from '../../hooks/redux';
import LocalAuthenticationButton from '../LocalAuthenticationButton';

import { ValidationFields } from './types';

type FieldValues = { password: string };

type ValidationProps = {
  field?: ValidationFields;
  onOk?: (text: string, isLocalAuthentication?: boolean) => void;
};

const Validation: FC<ValidationProps> = ({ onOk, field }) => {
  const { serviceApp } = backgroundApiProxy;
  const intl = useIntl();
  const { enableLocalAuthentication } = useSettings();
  const { control, handleSubmit, setError } = useForm<FieldValues>({
    defaultValues: { password: '' },
  });
  const onSubmit = handleSubmit(async (values: FieldValues) => {
    const isOk = await serviceApp.verifyPassword(values.password);
    if (isOk) {
      onOk?.(values.password, false);
    } else {
      setError('password', {
        message: intl.formatMessage({ id: 'msg__wrong_password' }),
      });
    }
  });

  const onLocalAuthenticationOk = useCallback(
    (text: string) => {
      onOk?.(text, true);
    },
    [onOk],
  );

  return (
    <KeyboardDismissView px={{ base: 4, md: 0 }}>
      <Typography.DisplayLarge textAlign="center" mb={2}>
        {intl.formatMessage({
          id: 'Verify_Password',
        })}
      </Typography.DisplayLarge>
      <Typography.Body1 textAlign="center" color="text-subdued">
        {intl.formatMessage({
          id: 'Verify_password_to_continue',
        })}
      </Typography.Body1>
      <Form mt="8">
        <Form.Item
          name="password"
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
          }}
        >
          <Form.PasswordInput
            autoFocus
            // press enter key to submit
            onSubmitEditing={onSubmit}
          />
        </Form.Item>
        <Button type="primary" size="xl" onPress={onSubmit}>
          {intl.formatMessage({
            id: 'action__continue',
            defaultMessage: 'Continue',
          })}
        </Button>
      </Form>
      {enableLocalAuthentication && (
        <Center mt="8">
          <LocalAuthenticationButton
            onOk={onLocalAuthenticationOk}
            field={field}
          />
        </Center>
      )}
    </KeyboardDismissView>
  );
};

export default Validation;
