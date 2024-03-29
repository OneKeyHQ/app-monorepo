import { memo, useState } from 'react';

import { useIntl } from 'react-intl';

import { Button, Form, Input, useForm } from '@onekeyhq/components';

import { PasswordRegex, getPasswordKeyboardType } from '../utils';

export interface IPasswordSetupForm {
  password: string;
  confirmPassword: string;
}
interface IPasswordSetupProps {
  loading: boolean;
  onSetupPassword: (data: IPasswordSetupForm) => void;
  biologyAuthSwitchContainer?: React.ReactNode;
  confirmBtnText?: string;
}

const PasswordSetup = ({
  loading,
  onSetupPassword,
  confirmBtnText,
  biologyAuthSwitchContainer,
}: IPasswordSetupProps) => {
  const intl = useIntl();
  const form = useForm<IPasswordSetupForm>({
    mode: 'onSubmit',
    reValidateMode: 'onSubmit',
    defaultValues: {
      password: '',
      confirmPassword: '',
    },
  });
  const [secureEntry, setSecureEntry] = useState(true);
  const [secureReentry, setSecureReentry] = useState(true);

  return (
    <Form form={form}>
      <Form.Field
        label="New Password"
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
            form.clearErrors();
          },
        }}
      >
        <Input
          size="large"
          $gtMd={{
            size: 'medium',
          }}
          placeholder="Create a strong password"
          disabled={loading}
          autoFocus
          keyboardType={getPasswordKeyboardType(!secureEntry)}
          onChangeText={(text) => text.replace(PasswordRegex, '')}
          secureTextEntry={secureEntry}
          addOns={[
            {
              iconName: secureEntry ? 'EyeOffOutline' : 'EyeOutline',
              onPress: () => {
                setSecureEntry(!secureEntry);
              },
              testID: `password-eye-${secureEntry ? 'off' : 'on'}`,
            },
          ]}
          testID="password"
        />
      </Form.Field>
      <Form.Field
        label="Confirm Password"
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
          $gtMd={{
            size: 'medium',
          }}
          placeholder="Re-enter your password"
          disabled={loading}
          keyboardType={getPasswordKeyboardType(!secureReentry)}
          onChangeText={(text) => text.replace(PasswordRegex, '')}
          secureTextEntry={secureReentry}
          addOns={[
            {
              iconName: secureReentry ? 'EyeOffOutline' : 'EyeOutline',
              onPress: () => {
                setSecureReentry(!secureReentry);
              },
              testID: `confirm-password-eye-${secureReentry ? 'off' : 'on'}`,
            },
          ]}
          testID="confirm-password"
        />
      </Form.Field>
      {biologyAuthSwitchContainer}
      <Button
        variant="primary"
        loading={loading}
        onPress={form.handleSubmit(onSetupPassword)}
        testID="set-password"
      >
        {confirmBtnText ?? intl.formatMessage({ id: 'title__set_password' })}
      </Button>
    </Form>
  );
};

export default memo(PasswordSetup);
