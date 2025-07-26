import { useCallback, useEffect, useState } from 'react';

import { useIntl } from 'react-intl';

import {
  Button,
  Dialog,
  Empty,
  Stack,
  Toast,
  YStack,
} from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import type { IApiEndpointConfig } from '@onekeyhq/kit-bg/src/states/jotai/atoms/apiEndpointConfig';
import { ETranslations } from '@onekeyhq/shared/src/locale';

import { ApiEndpointForm } from '../ApiEndpointForm';
import { ApiEndpointListItem } from '../ApiEndpointListItem';

interface IApiEndpointListProps {
  onRefresh: () => void;
}

export function ApiEndpointList({ onRefresh }: IApiEndpointListProps) {
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
            <ApiEndpointListItem
              key={config.id}
              config={config}
              onToggleEnabled={handleToggleEnabled}
              onEdit={handleEdit}
              onDelete={handleDelete}
            />
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
