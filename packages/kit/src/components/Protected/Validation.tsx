/* eslint-disable @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call */
import React, { FC, useCallback, useEffect, useRef } from 'react';

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
import { hasHardwareSupported } from '../../utils/localAuthentication';
import LocalAuthenticationButton from '../LocalAuthenticationButton';

import { ValidationFields } from './types';

type FieldValues = { password: string };

type ValidationProps = {
  field?: ValidationFields;
  onOk?: (text: string, isLocalAuthentication?: boolean) => void;
};

const Validation: FC<ValidationProps> = ({ onOk, field }) => {
  const intl = useIntl();
  const ref = useRef<any>();
  const { enableLocalAuthentication, validationState = {} } = useSettings();
  const { control, handleSubmit, setError } = useForm<FieldValues>({
    defaultValues: { password: '' },
  });
  const onSubmit = handleSubmit(async (values: FieldValues) => {
    const isOk = await backgroundApiProxy.serviceApp.verifyPassword(
      values.password,
    );
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

  useEffect(() => {
    if (!enableLocalAuthentication) {
      // https://stackoverflow.com/questions/42456069/how-to-open-keyboard-automatically-in-react-native
      // use setTimeout hack android platform
      // eslint-disable-next-line @typescript-eslint/no-unsafe-return
      setTimeout(() => ref.current?.focus(), 100);
      return;
    }
    hasHardwareSupported().then((isOk) => {
      if (!isOk || !field || validationState[field] === false) {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-return
        setTimeout(() => ref.current?.focus(), 100);
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
            ref={ref}
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
      <Center mt="8">
        <LocalAuthenticationButton
          onOk={onLocalAuthenticationOk}
          field={field}
        />
      </Center>
    </KeyboardDismissView>
  );
};

export default Validation;
