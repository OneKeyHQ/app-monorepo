import { memo, useCallback, useState } from 'react';

import { Form, Input, Toast, useForm } from '@onekeyhq/components';

import backgroundApiProxy from '../../background/instance/backgroundApiProxy';
import { savePassword } from '../../utils/localAuthentication';

interface IPasswordUpdateForm {
  newPassword: string;
  oldPassword: string;
}

interface IPasswordUpdateProps {
  onUpdateRes: (newPassword: string) => void;
}

const PasswordUpdate = ({ onUpdateRes }: IPasswordUpdateProps) => {
  const form = useForm<IPasswordUpdateForm>({
    defaultValues: {
      newPassword: '',
      oldPassword: '',
    },
  });
  const [secureEntry, setSecureEntry] = useState(true);
  const [loading, setLoading] = useState(false);

  const onUpdatePassword = useCallback(
    async (data: IPasswordUpdateForm) => {
      setLoading(true);
      if (data.oldPassword === data.newPassword) {
        Toast.error({ title: 'password is same' });
        form.setFocus('newPassword');
      } else {
        try {
          const updatePasswordRes =
            await backgroundApiProxy.servicePassword.updatePassword(
              data.oldPassword,
              data.newPassword,
            );
          // TODO 生物识别打开则需要更新生物识别本地密码
          if (updatePasswordRes) {
            await savePassword(updatePasswordRes);
            onUpdateRes(updatePasswordRes);
            Toast.success({ title: 'password set success' });
          }
        } catch (e) {
          onUpdateRes('');
          Toast.error({ title: 'password set failed' });
        }
      }
      setLoading(false);
    },
    [form, onUpdateRes],
  );

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
