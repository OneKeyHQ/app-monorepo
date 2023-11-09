import { memo, useState } from 'react';

import { Form, Input, useForm } from '@onekeyhq/components';

export interface IPasswordUpdateForm {
  newPassword: string;
  oldPassword: string;
}

interface IPasswordUpdateProps {
  loading: boolean;
  onUpdatePassword: (data: IPasswordUpdateForm) => void;
}

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

  return (
    <Form form={form}>
      <Form.Field
        name="oldPassword"
        rules={{
          required: { value: true, message: 'required input text' },
        }}
      >
        <Input
          size="large"
          placeholder="ennter old password"
          disabled={loading}
          autoFocus
          flex={1}
          secureTextEntry={secureEntry}
          addOns={[
            {
              iconName: secureEntry ? 'EyeOutline' : 'EyeOffOutline',
              onPress: () => {
                setSecureEntry(!secureEntry);
              },
            },
          ]}
        />
      </Form.Field>
      <Form.Field
        name="newPassword"
        rules={{
          required: { value: true, message: 'required input text' },
        }}
      >
        <Input
          size="large"
          placeholder="ennter new password"
          disabled={loading}
          selectTextOnFocus
          flex={1}
          secureTextEntry={secureEntry}
          addOns={[
            {
              iconName: 'ArrowRightCircleOutline',
              onPress: form.handleSubmit(onUpdatePassword),
              loading,
            },
          ]}
        />
      </Form.Field>
    </Form>
  );
};

export default memo(PasswordUpdate);
