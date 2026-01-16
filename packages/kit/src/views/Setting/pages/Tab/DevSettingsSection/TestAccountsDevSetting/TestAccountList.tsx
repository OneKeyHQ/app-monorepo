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
import type { ITestAccount } from '@onekeyhq/kit-bg/src/states/jotai/atoms/devSettings';
import { ETranslations } from '@onekeyhq/shared/src/locale';

import { TestAccountForm } from './TestAccountForm';
import { TestAccountListItem } from './TestAccountListItem';

export function TestAccountList() {
  const intl = useIntl();
  const [accounts, setAccounts] = useState<ITestAccount[]>([]);

  // Load accounts from dev settings
  const { result: initialAccounts, run: reloadAccounts } = usePromiseResult(
    async () => {
      const devSettings =
        await backgroundApiProxy.serviceDevSetting.getDevSetting();
      return devSettings.settings?.testAccounts || [];
    },
    [],
    {
      watchLoading: true,
    },
  );

  useEffect(() => {
    if (initialAccounts) {
      setAccounts(initialAccounts);
    }
  }, [initialAccounts]);

  const refreshData = useCallback(async () => {
    try {
      const devSettings =
        await backgroundApiProxy.serviceDevSetting.getDevSetting();
      const newAccounts = devSettings.settings?.testAccounts || [];
      setAccounts(newAccounts);
    } catch (error) {
      console.error('Failed to refresh accounts:', error);
    } finally {
      void reloadAccounts();
    }
  }, [reloadAccounts]);

  // Handle adding new account
  const handleAdd = useCallback(() => {
    const d = Dialog.show({
      title: intl.formatMessage({ id: ETranslations.global_create }),
      renderContent: (
        <TestAccountForm
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

  // Handle editing account
  const handleEdit = useCallback(
    (account: ITestAccount) => {
      const d = Dialog.show({
        title: intl.formatMessage({ id: ETranslations.global_edit }),
        renderContent: (
          <TestAccountForm
            mode="edit"
            account={account}
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

  // Handle deleting account
  const handleDelete = useCallback(
    (id: string, name: string) => {
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
            const currentAccounts = devSettings.settings?.testAccounts || [];
            const updatedAccounts = currentAccounts.filter(
              (account) => account.id !== id,
            );

            await backgroundApiProxy.serviceDevSetting.updateDevSetting(
              'testAccounts',
              updatedAccounts,
            );

            setAccounts((prev) => prev.filter((account) => account.id !== id));
            Toast.success({
              title: intl.formatMessage({ id: ETranslations.global_delete }),
            });
            void refreshData();
            await close();
          } catch (error) {
            console.error('Failed to delete test account:', error);
            Toast.error({
              title: intl.formatMessage({ id: ETranslations.global_failed }),
            });
          }
        },
      });
    },
    [intl, refreshData],
  );

  return (
    <YStack gap="$4">
      {accounts.length === 0 ? (
        <Empty
          title="No Test Accounts"
          description="Add test accounts for quick OneKey ID login testing"
          buttonProps={{
            children: intl.formatMessage({ id: ETranslations.global_create }),
            onPress: handleAdd,
          }}
        />
      ) : (
        <YStack gap="$2">
          {accounts.map((account) => (
            <TestAccountListItem
              key={account.id}
              account={account}
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
