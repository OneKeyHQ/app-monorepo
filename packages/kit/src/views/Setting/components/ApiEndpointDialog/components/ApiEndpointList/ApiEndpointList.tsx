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
import { ETranslations } from '@onekeyhq/shared/src/locale';

import { ApiEndpointForm } from '../ApiEndpointForm';
import { ApiEndpointListItem } from '../ApiEndpointListItem';

import type { IApiEndpointConfig } from '../../types';

interface IApiEndpointListProps {
  onRefresh: () => void;
}

export function ApiEndpointList({ onRefresh }: IApiEndpointListProps) {
  const intl = useIntl();
  const [configs, setConfigs] = useState<IApiEndpointConfig[]>([]);

  // Load configurations from dev settings
  const { result: initialConfigs, run: reloadConfigs } = usePromiseResult(
    async () => {
      const devSettings =
        await backgroundApiProxy.serviceDevSetting.getDevSetting();
      return devSettings.settings?.customApiEndpoints || [];
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
      const devSettings =
        await backgroundApiProxy.serviceDevSetting.getDevSetting();
      const newConfigs = devSettings.settings?.customApiEndpoints || [];
      setConfigs(newConfigs);
    } catch (error) {
      console.error('Failed to refresh configs:', error);
    } finally {
      void reloadConfigs();
      onRefresh();
    }
  }, [reloadConfigs, onRefresh]);

  // Handle adding new configuration
  const handleAdd = useCallback(() => {
    const d = Dialog.show({
      title: intl.formatMessage({ id: ETranslations.global_create }),
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
  }, [refreshData, intl]);

  // Handle editing configuration
  const handleEdit = useCallback(
    (config: IApiEndpointConfig) => {
      const d = Dialog.show({
        title: intl.formatMessage({ id: ETranslations.global_edit }),
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
    [refreshData, intl],
  );

  // Handle deleting configuration
  const handleDelete = useCallback(
    async (id: string, name: string) => {
      Dialog.show({
        title: intl.formatMessage({
          id: ETranslations.global_delete,
        }),
        description: `${intl.formatMessage({
          id: ETranslations.global_delete,
        })} "${name}"?`,
        onConfirmText: intl.formatMessage({
          id: ETranslations.global_delete,
        }),
        confirmButtonProps: {
          variant: 'destructive',
        },
        onConfirm: async ({ close }) => {
          try {
            const devSettings =
              await backgroundApiProxy.serviceDevSetting.getDevSetting();
            const currentEndpoints =
              devSettings.settings?.customApiEndpoints || [];
            const updatedEndpoints = currentEndpoints.filter(
              (config) => config.id !== id,
            );

            await backgroundApiProxy.serviceDevSetting.updateDevSetting(
              'customApiEndpoints',
              updatedEndpoints,
            );

            setConfigs((prev) => prev.filter((config) => config.id !== id));
            Toast.success({
              title: intl.formatMessage({ id: ETranslations.global_delete }),
            });
            void refreshData();
            await close();
          } catch (error) {
            console.error('Failed to delete API endpoint config:', error);
            Toast.error({
              title: intl.formatMessage({ id: ETranslations.global_failed }),
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
        const devSettings =
          await backgroundApiProxy.serviceDevSetting.getDevSetting();
        const currentEndpoints = devSettings.settings?.customApiEndpoints || [];
        const updatedEndpoints = currentEndpoints.map((config) =>
          config.id === id ? { ...config, enabled } : config,
        );

        await backgroundApiProxy.serviceDevSetting.updateDevSetting(
          'customApiEndpoints',
          updatedEndpoints,
        );

        setConfigs((prev) =>
          prev.map((config) =>
            config.id === id ? { ...config, enabled } : config,
          ),
        );
        void refreshData();
        Toast.success({
          title: intl.formatMessage({
            id: enabled
              ? ETranslations.global_enabled
              : ETranslations.global_disabled,
          }),
        });
      } catch (error) {
        console.error('Failed to toggle API endpoint config:', error);
        Toast.error({
          title: intl.formatMessage({ id: ETranslations.global_failed }),
        });
      }
    },
    [refreshData, intl],
  );

  return (
    <YStack gap="$4">
      {configs.length === 0 ? (
        <Empty
          title="No API Endpoints"
          description="Add custom API endpoints for different services"
          buttonProps={{
            children: intl.formatMessage({ id: ETranslations.global_create }),
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
          {intl.formatMessage({ id: ETranslations.global_create })}
        </Button>
      </Stack>
    </YStack>
  );
}
