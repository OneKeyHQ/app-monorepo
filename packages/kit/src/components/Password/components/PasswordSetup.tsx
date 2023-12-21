import { memo, useState } from 'react';

import { useIntl } from 'react-intl';

import { Button, Form, Input, useForm } from '@onekeyhq/components';

import { PasswordRegex, getPasswordKeyboardType } from '../utils';

export interface IPasswordSetupForm {
  password: string;
  confirmPassword: string;
}
interface IPasswordSetupProps {
  biologyAuthSwitchContainer: React.ReactNode;
  loading: boolean;
  onSetupPassword: (data: IPasswordSetupForm) => void;
}

const PasswordSetup = ({
  loading,
  biologyAuthSwitchContainer,
  onSetupPassword,
}: IPasswordSetupProps) => {
  const intl = useIntl();
  const form = useForm<IPasswordSetupForm>({
    reValidateMode: 'onSubmit',
    defaultValues: {
      password: '',
      confirmPassword: '',
    },
  });
  const [secureEntry, setSecureEntry] = useState(true);
  const [secureReentry, setSecureReentry] = useState(true);

  return (
    <Form form={form} validateOnBlur={false}>
      <Form.Field
        name="password"
        rules={{
          required: { value: true, message: 'Please enter a password' },
          minLength: {
            value: 8,
            message: 'Password must be at least 8 characters',
          },
          maxLength: {
            value: 128,
            message: 'Password cannot exceed 128 characters',
          },
          onChange: () => {
            form.clearErrors('confirmPassword');
          },
        }}
      >
        <Input
          size="large"
          placeholder="Create a strong password"
          disabled={loading}
          autoFocus
          flex={1}
          keyboardType={getPasswordKeyboardType(!secureEntry)}
          onChangeText={(text) => text.replace(PasswordRegex, '')}
          secureTextEntry={secureEntry}
          addOns={[
            {
              iconName: secureEntry ? 'EyeOffOutline' : 'EyeOutline',
              onPress: () => {
                setSecureEntry(!secureEntry);
              },
            },
          ]}
        />
      </Form.Field>
      <Form.Field
        name="confirmPassword"
        rules={{
          validate: {
            equal: (v, values) => {
              const state = form.getFieldState('password');
              if (!state.error) {
                return v !== values.password
                  ? 'Passwords do not match'
                  : undefined;
              }
              return undefined;
            },
          },
          onChange: () => {
            form.clearErrors('confirmPassword');
          },
        }}
      >
        <Input
          size="large"
          placeholder="Re-enter your password"
          disabled={loading}
          flex={1}
          keyboardType={getPasswordKeyboardType(!secureReentry)}
          onChangeText={(text) => text.replace(PasswordRegex, '')}
          secureTextEntry={secureReentry}
          addOns={[
            {
              iconName: secureReentry ? 'EyeOffOutline' : 'EyeOutline',
              onPress: () => {
                setSecureReentry(!secureReentry);
              },
            },
          ]}
        />
      </Form.Field>
      {biologyAuthSwitchContainer}
      <Button variant="primary" onPress={form.handleSubmit(onSetupPassword)}>
        {intl.formatMessage({ id: 'title__set_password' })}
      </Button>
    </Form>
  );
};

export default memo(PasswordSetup);
