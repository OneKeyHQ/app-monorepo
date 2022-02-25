import React, { FC } from 'react';

import { useIntl } from 'react-intl';

import {
  Button,
  Form,
  KeyboardDismissView,
  Typography,
  useForm,
} from '@onekeyhq/components';

type FieldValues = {
  password: string;
  confirmPassword: string;
};

type SetupProps = { onOk?: (text: string) => void };

const Setup: FC<SetupProps> = ({ onOk }) => {
  const intl = useIntl();
  const {
    control,
    handleSubmit,
    formState: { isValid },
    getValues,
  } = useForm<FieldValues>({
    mode: 'onChange',
    defaultValues: { password: '', confirmPassword: '' },
  });
  const onSubmit = handleSubmit((values: FieldValues) => {
    onOk?.(values.password);
  });

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
            minLength: {
              value: 8,
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
  );
};

export default Setup;
