import { useCallback, useEffect, useState } from 'react';

import { useIntl } from 'react-intl';

import {
  Button,
  Dialog,
  Empty,
  Form,
  IconButton,
  Input,
  Select,
  Stack,
  Switch,
  Toast,
  YStack,
  useForm,
} from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { ListItem } from '@onekeyhq/kit/src/components/ListItem';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import type { IApiEndpointConfig } from '@onekeyhq/kit-bg/src/states/jotai/atoms/apiEndpointConfig';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { EServiceEndpointEnum } from '@onekeyhq/shared/types/endpoint';

// Service module options for select component
const serviceModuleOptions = Object.values(EServiceEndpointEnum).map(
  (value) => ({
    label: value,
    value,
  }),
);

// Service module labels for display
const serviceModuleLabels: Record<EServiceEndpointEnum, string> = {
  wallet: 'Wallet',
  swap: 'Swap',
  utility: 'Utility',
  lightning: 'Lightning',
  earn: 'Earn',
  notification: 'Notification',
  notificationWebSocket: 'Notification WebSocket',
  prime: 'Prime',
  transfer: 'Transfer',
  rebate: 'Rebate',
};

type IFormData = {
  name: string;
  api: string;
  serviceModule: EServiceEndpointEnum;
  enabled: boolean;
};

function ApiEndpointForm({
  mode,
  config,
  onSuccess,
  onCancel,
}: {
  mode: 'add' | 'edit';
  config?: IApiEndpointConfig;
  onSuccess: () => void;
  onCancel: () => void;
}) {
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
        if (mode === 'add') {
          await backgroundApiProxy.serviceApiEndpointConfig.addApiEndpointConfig(
            formData,
          );
          Toast.success({
            title: 'API endpoint added',
          });
        } else {
          if (!config) {
            console.error('Config is required for edit mode');
            return;
          }
          await backgroundApiProxy.serviceApiEndpointConfig.updateApiEndpointConfig(
            config.id,
            formData,
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

  // Basic URL validation
  const validateUrl = useCallback((url: string) => {
    if (!url.trim()) {
      return 'Field is required';
    }

    // Allow both domain names and IP addresses, with or without protocol
    const urlPattern =
      /^(https?:\/\/)?([a-zA-Z0-9-._]+|\[[0-9a-fA-F:]+\]|[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3})(:[0-9]+)?(\/.*)?$/;
    if (!urlPattern.test(url.trim())) {
      return 'Invalid URL format';
    }

    return undefined;
  }, []);

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

        <Form.Field
          name="api"
          label="API Endpoint"
          rules={{
            validate: validateUrl,
          }}
        >
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

function ApiEndpointList({ onRefresh }: { onRefresh: () => void }) {
  const intl = useIntl();
  const [configs, setConfigs] = useState<IApiEndpointConfig[]>([]);

  // Load configurations
  const { result: initialConfigs, run: reloadConfigs } = usePromiseResult(
    async () => {
      return backgroundApiProxy.serviceApiEndpointConfig.getApiEndpointConfigs();
    },
    [],
    {
      watchLoading: true,
    },
  );

  useEffect(() => {
    if (initialConfigs) {
      setConfigs(initialConfigs);
    }
  }, [initialConfigs]);

  const refreshData = useCallback(async () => {
    try {
      const newConfigs =
        await backgroundApiProxy.serviceApiEndpointConfig.getApiEndpointConfigs();
      setConfigs(newConfigs);
      void reloadConfigs();
      onRefresh();
    } catch (error) {
      console.error('Failed to refresh configs:', error);
      void reloadConfigs();
      onRefresh();
    }
  }, [reloadConfigs, onRefresh]);

  // Handle adding new configuration
  const handleAdd = useCallback(() => {
    const d = Dialog.show({
      title: 'Add API Endpoint',
      renderContent: (
        <ApiEndpointForm
          mode="add"
          onSuccess={() => {
            void refreshData();
            void d.close();
          }}
          onCancel={() => {
            void d.close();
          }}
        />
      ),
      showFooter: false,
    });
  }, [refreshData]);

  // Handle editing configuration
  const handleEdit = useCallback(
    (config: IApiEndpointConfig) => {
      const d = Dialog.show({
        title: 'Edit API Endpoint',
        renderContent: (
          <ApiEndpointForm
            mode="edit"
            config={config}
            onSuccess={() => {
              void refreshData();
              void d.close();
            }}
            onCancel={() => {
              void d.close();
            }}
          />
        ),
        showFooter: false,
      });
    },
    [refreshData],
  );

  // Handle deleting configuration
  const handleDelete = useCallback(
    async (id: string, name: string) => {
      Dialog.show({
        title: intl.formatMessage({
          id: ETranslations.global_delete,
        }),
        description: `Are you sure you want to delete "${name}"?`,
        onConfirmText: intl.formatMessage({
          id: ETranslations.global_delete,
        }),
        confirmButtonProps: {
          variant: 'destructive',
        },
        onConfirm: async ({ close }) => {
          try {
            await backgroundApiProxy.serviceApiEndpointConfig.deleteApiEndpointConfig(
              id,
            );
            setConfigs((prev) => prev.filter((config) => config.id !== id));
            Toast.success({
              title: 'Deleted',
            });
            void refreshData();
            await close();
          } catch (error) {
            console.error('Failed to delete API endpoint config:', error);
            Toast.error({
              title: 'Delete failed',
            });
          }
        },
      });
    },
    [intl, refreshData],
  );

  // Handle toggling enabled state
  const handleToggleEnabled = useCallback(
    async (id: string, enabled: boolean) => {
      try {
        await backgroundApiProxy.serviceApiEndpointConfig.updateApiEndpointConfig(
          id,
          { enabled },
        );
        setConfigs((prev) =>
          prev.map((config) =>
            config.id === id ? { ...config, enabled } : config,
          ),
        );
        void refreshData();
        Toast.success({
          title: enabled ? 'Enabled' : 'Disabled',
        });
      } catch (error) {
        console.error('Failed to toggle API endpoint config:', error);
        Toast.error({
          title: 'Operation failed',
        });
      }
    },
    [refreshData],
  );

  return (
    <YStack gap="$4">
      {configs.length === 0 ? (
        <Empty
          title="No API Endpoints"
          description="Add custom API endpoints for different services"
          buttonProps={{
            children: 'Add',
            onPress: handleAdd,
          }}
        />
      ) : (
        <YStack gap="$2">
          {configs.map((config) => (
            <ListItem
              px="$1"
              key={config.id}
              title={config.name}
              subtitle={`${serviceModuleLabels[config.serviceModule]}: ${
                config.api
              }`}
            >
              <Stack flexDirection="row" alignItems="center" gap="$3">
                <Switch
                  size="small"
                  value={config.enabled}
                  onChange={(enabled) =>
                    handleToggleEnabled(config.id, enabled)
                  }
                />
                <IconButton
                  icon="PencilOutline"
                  variant="tertiary"
                  size="small"
                  onPress={() => handleEdit(config)}
                />
                <IconButton
                  icon="DeleteOutline"
                  variant="tertiary"
                  size="small"
                  onPress={() => handleDelete(config.id, config.name)}
                />
              </Stack>
            </ListItem>
          ))}
        </YStack>
      )}

      <Stack justifyContent="flex-end" alignItems="flex-end">
        <Button size="small" onPress={handleAdd}>
          Add
        </Button>
      </Stack>
    </YStack>
  );
}

export function showApiEndpointDialog() {
  Dialog.show({
    title: 'API Endpoint Management',
    renderContent: (
      <ApiEndpointList
        onRefresh={() => {
          // Data will be refreshed automatically through usePromiseResult
        }}
      />
    ),
    showFooter: false,
  });
}
