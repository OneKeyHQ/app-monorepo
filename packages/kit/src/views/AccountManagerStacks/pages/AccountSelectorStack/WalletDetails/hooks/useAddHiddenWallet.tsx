import { useCallback, useState } from 'react';

import { EDeviceType } from '@onekeyfe/hd-shared';
import { useIntl } from 'react-intl';

import {
  Dialog,
  ESwitchSize,
  SizableText,
  Switch,
  Toast,
  XStack,
  YStack,
} from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { useCreateQrWallet } from '@onekeyhq/kit/src/components/AccountSelector/hooks/useCreateQrWallet';
import { useAccountSelectorActions } from '@onekeyhq/kit/src/states/jotai/contexts/accountSelector';
import type { IDBWallet } from '@onekeyhq/kit-bg/src/dbs/local/types';
import type { ISettingsPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms/settings';
import { useSettingsPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms/settings';
import errorToastUtils from '@onekeyhq/shared/src/errors/utils/errorToastUtils';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';

function AddHiddenWalletDialogContent() {
  const [settings, setSettings] = useSettingsPersistAtom();

  return (
    <YStack gap="$4" py="$2">
      <XStack alignItems="center" justifyContent="space-between">
        <YStack flex={1} gap="$1">
          <SizableText>Show Add Hidden Wallet Button</SizableText>
          <SizableText color="$textSecondary">
            Display the add hidden wallet button in the wallet sidebar
          </SizableText>
        </YStack>
        <Switch
          size={ESwitchSize.small}
          value={settings.showAddHiddenInWalletSidebar}
          onChange={(value) => {
            setSettings(
              (prev): ISettingsPersistAtom => ({
                ...prev,
                showAddHiddenInWalletSidebar: !!value,
              }),
            );
          }}
        />
      </XStack>
    </YStack>
  );
}

export function useAddHiddenWallet() {
  const intl = useIntl();
  const actions = useAccountSelectorActions();
  const [isLoading, setIsLoading] = useState(false);
  const { createQrWallet } = useCreateQrWallet();

  const createHwHiddenWallet = useCallback(
    async ({ wallet }: { wallet?: IDBWallet }) => {
      try {
        setIsLoading(true);
        await actions.current.createHWHiddenWallet(
          {
            walletId: wallet?.id || '',
          },
          {
            addDefaultNetworkAccounts: true,
            showAddAccountsLoading: true,
          },
        );
        Toast.success({
          title: intl.formatMessage({
            id: ETranslations.global_success,
          }),
        });
      } finally {
        setIsLoading(false);
        const device =
          await backgroundApiProxy.serviceAccount.getWalletDeviceSafe({
            walletId: wallet?.id || '',
          });
        if (device?.connectId) {
          await backgroundApiProxy.serviceHardwareUI.closeHardwareUiStateDialog(
            {
              connectId: device?.connectId,
              hardClose: true,
            },
          );
        }
      }
    },
    [actions, intl],
  );

  const createQrHiddenWallet = useCallback(
    async ({ wallet }: { wallet?: IDBWallet }) => {
      try {
        defaultLogger.account.wallet.addWalletStarted({
          addMethod: 'ConnectHWWallet',
          details: {
            hardwareWalletType: 'Hidden',
            communication: 'QRCode',
          },
          isSoftwareWalletOnlyUser: false,
        });

        await createQrWallet({
          isOnboarding: true,
          onFinalizeWalletSetupError: () => {
            // only pop when finalizeWalletSetup pushed
            // navigation.pop();
          },
        });

        defaultLogger.account.wallet.walletAdded({
          status: 'success',
          addMethod: 'ConnectHWWallet',
          details: {
            hardwareWalletType: 'Hidden',
            communication: 'QRCode',
            deviceType: EDeviceType.Pro,
          },
          isSoftwareWalletOnlyUser: false,
        });
      } catch (error) {
        errorToastUtils.toastIfError(error);
        defaultLogger.account.wallet.walletAdded({
          status: 'failure',
          addMethod: 'ConnectHWWallet',
          details: {
            hardwareWalletType: 'Hidden',
            communication: 'QRCode',
            deviceType: EDeviceType.Pro,
          },
          isSoftwareWalletOnlyUser: false,
        });
        throw error;
      }
    },
    [createQrWallet],
  );

  const createHiddenWallet = useCallback(
    async ({ wallet }: { wallet?: IDBWallet }) => {
      if (accountUtils.isHwWallet({ walletId: wallet?.id })) {
        await createHwHiddenWallet({ wallet });
      }
      if (accountUtils.isQrWallet({ walletId: wallet?.id })) {
        await createQrHiddenWallet({ wallet });
      }
    },
    [createHwHiddenWallet, createQrHiddenWallet],
  );

  const createHiddenWalletWithDialogConfirm = useCallback(
    async ({ wallet }: { wallet?: IDBWallet }) => {
      return new Promise<void>((resolve, reject) => {
        Dialog.show({
          icon: 'PlusSmallOutline',
          title: intl.formatMessage({
            id: ETranslations.global_add_hidden_wallet,
          }),
          description: intl.formatMessage({
            id: ETranslations.global_hidden_wallet_desc,
          }),
          renderContent: <AddHiddenWalletDialogContent />,
          onConfirmText: intl.formatMessage({
            id: ETranslations.global_continue,
          }),
          onConfirm: async ({ close }) => {
            try {
              void close();
              await createHiddenWallet({ wallet });
              resolve();
            } catch (error) {
              reject(error);
            }
          },
          onCancel: () => {
            reject(new Error('User cancelled'));
          },
        });
      });
    },
    [createHiddenWallet, intl],
  );

  return {
    createHiddenWallet,
    createHiddenWalletWithDialogConfirm,
    isLoading,
  };
}
