import { memo, useState } from 'react';

import { useIntl } from 'react-intl';

import { Button, Form, Input, useForm } from '@onekeyhq/components';

import { PasswordRegex, getPasswordKeyboardType } from '../utils';

export interface IPasswordUpdateForm {
  newPassword: string;
  oldPassword: string;
}

interface IPasswordUpdateProps {
  loading: boolean;
  onUpdatePassword: (data: IPasswordUpdateForm) => void;
}

const createRules = (option: { message: { required: string } }) => {
  const rules = {
    required: { value: true, message: option.message.required },
    minLength: {
      value: 8,
      message: 'Password must be at least 8 characters',
    },
    maxLength: {
      value: 128,
      message: 'Password cannot exceed 128 characters',
    },
  };
  return rules;
};

const oldRules = createRules({
  message: { required: 'Please enter old password' },
});

const newRules = createRules({
  message: { required: 'Please enter new password' },
});

const PasswordUpdate = ({
  loading,
  onUpdatePassword,
}: IPasswordUpdateProps) => {
  const form = useForm<IPasswordUpdateForm>({
    defaultValues: {
      newPassword: '',
      oldPassword: '',
    },
  });
  const [secureEntry, setSecureEntry] = useState(true);
  const [secureReentry, setSecureReentry] = useState(true);
  const intl = useIntl();
  return (
    <Form form={form}>
      <Form.Field name="oldPassword" rules={oldRules}>
        <Input
          size="large"
          placeholder="Enter old password"
          disabled={loading}
          autoFocus
          onChangeText={(text) => text.replace(PasswordRegex, '')}
          flex={1}
          keyboardType={getPasswordKeyboardType(!secureEntry)}
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
      <Form.Field name="newPassword" rules={newRules}>
        <Input
          size="large"
          placeholder="Enter new password"
          disabled={loading}
          selectTextOnFocus
          flex={1}
          onChangeText={(text) => text.replace(PasswordRegex, '')}
          keyboardType={getPasswordKeyboardType(!secureReentry)}
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
      <Button onPress={form.handleSubmit(onUpdatePassword)}>
        {intl.formatMessage({ id: 'action__confirm' })}
      </Button>
    </Form>
  );
};

export default memo(PasswordUpdate);
