import { Suspense, memo, useState } from 'react';

import { Form, Input, Spinner, useForm } from '@onekeyhq/components';

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
  const form = useForm<IPasswordSetupForm>({
    defaultValues: {
      password: '',
      confirmPassword: '',
    },
  });
  const [secureEntry, setSecureEntry] = useState(true);

  return (
    <Form form={form}>
      <Form.Field
        name="password"
        rules={{
          required: { value: true, message: 'required input text' },
          onChange: () => {
            form.clearErrors('confirmPassword');
          },
        }}
      >
        <Input
          size="large"
          placeholder="ennter password"
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
        name="confirmPassword"
        rules={{
          onChange: () => {
            form.clearErrors('confirmPassword');
          },
        }}
      >
        <Input
          size="large"
          placeholder="ennter password confirm"
          disabled={loading}
          flex={1}
          secureTextEntry={secureEntry}
          addOns={[
            {
              iconName: 'ArrowRightCircleOutline',
              onPress: form.handleSubmit(onSetupPassword),
              loading,
            },
          ]}
        />
      </Form.Field>
      <Suspense fallback={<Spinner size="small" />}>
        {biologyAuthSwitchContainer}
      </Suspense>
    </Form>
  );
};

export default memo(PasswordSetup);
