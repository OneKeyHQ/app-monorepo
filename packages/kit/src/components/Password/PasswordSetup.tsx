import { Suspense, memo, useCallback, useState } from 'react';

import { Form, Input, Spinner, Toast, useForm } from '@onekeyhq/components';
import { encodePassword } from '@onekeyhq/core/src/secret';

import backgroundApiProxy from '../../background/instance/backgroundApiProxy';
import BiologyAuthSwitch from '../BiologyAuthComponent/BiologyAuthSwitch';

interface IPasswordSetupForm {
  password: string;
  confirmPassword: string;
}

interface IPasswordSetupProps {
  onSetupRes: (password: string) => void;
}

const PasswordSetup = ({ onSetupRes }: IPasswordSetupProps) => {
  const form = useForm<IPasswordSetupForm>({
    defaultValues: {
      password: '',
      confirmPassword: '',
    },
  });
  const [secureEntry, setSecureEntry] = useState(true);
  const [loading, setLoading] = useState(false);
  const onSetupPassword = useCallback(
    async (data: IPasswordSetupForm) => {
      if (data.confirmPassword !== data.password) {
        form.setError('confirmPassword', { message: 'password not match' });
      } else {
        setLoading(true);
        try {
          const enCodePassword = encodePassword({ password: data.password });
          const updatePasswordRes =
            await backgroundApiProxy.servicePassword.setPassword(
              enCodePassword,
            );

          if (updatePasswordRes) {
            onSetupRes(updatePasswordRes);
            Toast.success({ title: 'password set success' });
          }
        } catch (e) {
          onSetupRes('');
          console.log('e', e);
          Toast.error({ title: 'password set failed' });
        } finally {
          setLoading(false);
        }
      }
    },
    [form, onSetupRes],
  );

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
        <BiologyAuthSwitch />
      </Suspense>
    </Form>
  );
};

export default memo(PasswordSetup);
