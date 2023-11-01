import { memo, useCallback, useState } from 'react';

import { Controller } from 'react-hook-form';

import {
  Form,
  Input,
  Switch,
  Text,
  Toast,
  XStack,
  useForm,
} from '@onekeyhq/components';

import backgroundApiProxy from '../../background/instance/backgroundApiProxy';
import { savePassword } from '../../utils/localAuthentication';

import useBiologyAuth from './hooks/useBiologyAuth';

interface IPasswordSetupForm {
  password: string;
  confirmPassword: string;
  biologyAuth: boolean;
}

interface IPasswordSetupProps {
  onSetupRes: (password: string) => void;
}

const PasswordSetup = ({ onSetupRes }: IPasswordSetupProps) => {
  const form = useForm<IPasswordSetupForm>({
    defaultValues: {
      password: '',
      confirmPassword: '',
      biologyAuth: true,
    },
  });
  const [secureEntry, setSecureEntry] = useState(true);
  const [loading, setLoading] = useState(false);
  const { isSupportBiologyAuth } = useBiologyAuth();

  const onSetupPassword = useCallback(
    async (data: IPasswordSetupForm) => {
      if (data.confirmPassword !== data.password) {
        form.setError('confirmPassword', { message: 'password not match' });
      } else {
        setLoading(true);
        try {
          const updatePasswordRes =
            await backgroundApiProxy.servicePassword.updatePassword(
              '',
              data.password,
            );
          if (updatePasswordRes) {
            if (data.biologyAuth) {
              await savePassword(updatePasswordRes);
            }
            onSetupRes(updatePasswordRes);
            Toast.success({ title: 'password set success' });
          }
        } catch (e) {
          onSetupRes('');
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

      {isSupportBiologyAuth && (
        <Controller
          control={form.control}
          name="biologyAuth"
          render={({ field }) => (
            <XStack justifyContent="space-between">
              <Text>生物识别</Text>
              <Switch
                value={field.value}
                onChange={(checked) => {
                  field.onChange(checked);
                }}
              />
            </XStack>
          )}
        />
      )}
    </Form>
  );
};

export default memo(PasswordSetup);
