import React, { FC } from 'react';

import { useIntl } from 'react-intl';

import {
  Button,
  Center,
  Form,
  KeyboardDismissView,
  Typography,
  useForm,
} from '@onekeyhq/components';

import engine from '../../engine/EngineProvider';
import { useSettings } from '../../hooks/redux';
import LocalAuthenticationButton from '../LocalAuthenticationButton';

type FieldValues = { password: string };

type ValidationProps = { onOk?: (text: string) => void };

const Validation: FC<ValidationProps> = ({ onOk }) => {
  const intl = useIntl();
  const { enableLocalAuthentication } = useSettings();
  const { control, handleSubmit, setError } = useForm<FieldValues>({
    defaultValues: { password: '' },
  });
  const onSubmit = handleSubmit(async (values: FieldValues) => {
    const isOk = await engine.verifyMasterPassword(values.password);
    if (isOk) {
      onOk?.(values.password);
    } else {
      setError('password', {
        message: intl.formatMessage({ id: 'msg__wrong_password' }),
      });
    }
  });

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
          }}
        >
          <Form.PasswordInput />
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
          <LocalAuthenticationButton onOk={onOk} />
        </Center>
      )}
    </KeyboardDismissView>
  );
};

export default Validation;
