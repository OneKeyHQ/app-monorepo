import { useCallback, useState } from 'react';

import { useIntl } from 'react-intl';

import {
  Button,
  Form,
  Input,
  Select,
  Stack,
  Switch,
  Toast,
  YStack,
  useForm,
} from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { EServiceEndpointEnum } from '@onekeyhq/shared/types/endpoint';

import { serviceModuleOptions } from '../../constants';

import type { IApiEndpointConfig, IFormData } from '../../types';

interface IApiEndpointFormProps {
  mode: 'add' | 'edit';
  config?: IApiEndpointConfig;
  onSuccess: () => void;
  onCancel: () => void;
}

export function ApiEndpointForm({
  mode,
  config,
  onSuccess,
  onCancel,
}: IApiEndpointFormProps) {
  const intl = useIntl();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<IFormData>({
    defaultValues: {
      name: config?.name || '',
      api: config?.api || '',
      serviceModule: config?.serviceModule || EServiceEndpointEnum.Wallet,
      enabled: config?.enabled ?? true,
    },
  });

  const handleSave = useCallback(
    async (formData: IFormData) => {
      if (isSubmitting) return;

      setIsSubmitting(true);
      try {
        const devSettings =
          await backgroundApiProxy.serviceDevSetting.getDevSetting();
        const currentEndpoints = devSettings.settings?.customApiEndpoints || [];

        if (mode === 'add') {
          const newConfig: IApiEndpointConfig = {
            id: Date.now().toString(), // Simple ID generation
            ...formData,
          };
          const updatedEndpoints = [...currentEndpoints, newConfig];

          await backgroundApiProxy.serviceDevSetting.updateDevSetting(
            'customApiEndpoints',
            updatedEndpoints,
          );

          Toast.success({
            title: 'API endpoint added',
          });
        } else {
          if (!config) {
            console.error('Config is required for edit mode');
            return;
          }

          const updatedEndpoints = currentEndpoints.map((endpoint) =>
            endpoint.id === config.id ? { ...endpoint, ...formData } : endpoint,
          );

          await backgroundApiProxy.serviceDevSetting.updateDevSetting(
            'customApiEndpoints',
            updatedEndpoints,
          );

          Toast.success({
            title: 'API endpoint updated',
          });
        }
        onSuccess();
      } catch (error) {
        console.error('Failed to save API endpoint config:', error);
        Toast.error({
          title: 'Save failed',
        });
      } finally {
        setIsSubmitting(false);
      }
    },
    [mode, config, onSuccess, isSubmitting],
  );

  return (
    <Form form={form}>
      <YStack gap="$4">
        <Form.Field
          name="name"
          label={intl.formatMessage({ id: ETranslations.global_name })}
          rules={{
            required: {
              value: true,
              message: 'Field is required',
            },
          }}
        >
          <Input placeholder="Enter a name for this endpoint" />
        </Form.Field>

        <Form.Field name="serviceModule" label="Service Module">
          <Select
            title="Service Module"
            items={serviceModuleOptions}
            placeholder="Select a service module"
          />
        </Form.Field>

        <Form.Field name="api" label="API Endpoint">
          <Input placeholder="https://api.example.com or 192.168.1.100:8080" />
        </Form.Field>

        <Form.Field
          name="enabled"
          label={intl.formatMessage({ id: ETranslations.global_enabled })}
        >
          <Switch size="small" />
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
