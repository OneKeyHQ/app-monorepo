import { useCallback, useState } from 'react';

import { useIntl } from 'react-intl';

import {
  Button,
  Form,
  Input,
  Stack,
  Toast,
  YStack,
  useForm,
} from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import type { ITestAccount } from '@onekeyhq/kit-bg/src/states/jotai/atoms/devSettings';
import { ETranslations } from '@onekeyhq/shared/src/locale';

interface IFormData {
  email: string;
  otp: string;
  name: string;
}

interface ITestAccountFormProps {
  mode: 'add' | 'edit';
  account?: ITestAccount;
  onSuccess: () => void;
  onCancel: () => void;
}

export function TestAccountForm({
  mode,
  account,
  onSuccess,
  onCancel,
}: ITestAccountFormProps) {
  const intl = useIntl();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<IFormData>({
    defaultValues: {
      email: account?.email || '',
      otp: account?.otp || '',
      name: account?.name || '',
    },
  });

  const handleSave = useCallback(
    async (formData: IFormData) => {
      if (isSubmitting) return;

      setIsSubmitting(true);
      try {
        const devSettings =
          await backgroundApiProxy.serviceDevSetting.getDevSetting();
        const currentAccounts = devSettings.settings?.testAccounts || [];

        if (mode === 'add') {
          const newAccount: ITestAccount = {
            id: Date.now().toString(),
            email: formData.email.trim(),
            otp: formData.otp.trim(),
            name: formData.name.trim() || undefined,
          };
          const updatedAccounts = [...currentAccounts, newAccount];

          await backgroundApiProxy.serviceDevSetting.updateDevSetting(
            'testAccounts',
            updatedAccounts,
          );

          Toast.success({
            title: 'Test account added',
          });
        } else {
          if (!account) {
            console.error('Account is required for edit mode');
            return;
          }

          const updatedAccounts = currentAccounts.map((a) =>
            a.id === account.id
              ? {
                  ...a,
                  email: formData.email.trim(),
                  otp: formData.otp.trim(),
                  name: formData.name.trim() || undefined,
                }
              : a,
          );

          await backgroundApiProxy.serviceDevSetting.updateDevSetting(
            'testAccounts',
            updatedAccounts,
          );

          Toast.success({
            title: 'Test account updated',
          });
        }
        onSuccess();
      } catch (error) {
        console.error('Failed to save test account:', error);
        Toast.error({
          title: 'Save failed',
        });
      } finally {
        setIsSubmitting(false);
      }
    },
    [mode, account, onSuccess, isSubmitting],
  );

  return (
    <Form form={form}>
      <YStack gap="$4">
        <Form.Field
          name="name"
          label={intl.formatMessage({ id: ETranslations.global_name })}
        >
          <Input placeholder="Account nickname (optional)" />
        </Form.Field>

        <Form.Field
          name="email"
          label="Email"
          rules={{
            required: {
              value: true,
              message: 'Email is required',
            },
            pattern: {
              value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
              message: 'Invalid email format',
            },
          }}
        >
          <Input placeholder="your@email.com" autoCapitalize="none" />
        </Form.Field>

        <Form.Field
          name="otp"
          label="OTP Code"
          rules={{
            required: {
              value: true,
              message: 'OTP is required',
            },
            pattern: {
              value: /^\d{6}$/,
              message: 'OTP must be 6 digits',
            },
          }}
        >
          <Input placeholder="123456" keyboardType="number-pad" maxLength={6} />
        </Form.Field>

        <Stack flexDirection="row" gap="$3" justifyContent="flex-end">
          <Button variant="secondary" onPress={onCancel}>
            {intl.formatMessage({ id: ETranslations.global_cancel })}
          </Button>
          <Button
            variant="primary"
            loading={isSubmitting}
            onPress={form.handleSubmit(handleSave)}
          >
            Save
          </Button>
        </Stack>
      </YStack>
    </Form>
  );
}
