import type { IKeyOfIcons } from '@onekeyhq/components';
import { ActionList } from '@onekeyhq/components';
import type { IExportKeyType } from '@onekeyhq/core/src/types';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { useBotWalletDeactivatedStatus } from '@onekeyhq/kit/src/hooks/useBotWalletDeactivatedStatus';
import { navigateToBackupWalletReminderPage } from '@onekeyhq/kit/src/hooks/usePageNavigation';
import { showBotWalletDisabledToast } from '@onekeyhq/kit/src/utils/botWalletDisabledToast';
import { shouldHideBotWalletExport } from '@onekeyhq/kit/src/utils/botWalletStatusUtils';
import type {
  IDBAccount,
  IDBIndexedAccount,
  IDBWallet,
} from '@onekeyhq/kit-bg/src/dbs/local/types';
import {
  EAccountManagerStacksRoutes,
  EModalRoutes,
} from '@onekeyhq/shared/src/routes';
import { ensureSensitiveTextEncoded } from '@onekeyhq/shared/src/utils/sensitiveTextUtils';

export function AccountExportPrivateKeyButton({
  testID,
  accountName,
  indexedAccount,
  account,
  onClose,
  icon,
  label,
  exportType,
  wallet,
}: {
  testID?: string;
  accountName?: string;
  indexedAccount?: IDBIndexedAccount;
  account?: IDBAccount;
  onClose: () => void;
  icon: IKeyOfIcons;
  label: string;
  exportType: IExportKeyType;
  wallet?: IDBWallet;
}) {
  const navigation = useAppNavigation();

  const { isBotWallet, isBotWalletDeactivated } = useBotWalletDeactivatedStatus(
    {
      walletId: wallet?.id,
    },
  );
  const isExportBlocked = shouldHideBotWalletExport({
    isBotWallet,
    isBotWalletDeactivated,
  });

  return (
    <ActionList.Item
      testID={testID}
      icon={icon}
      label={label}
      onClose={() => {}}
      disabled={isExportBlocked}
      allowPressWhenDisabled={isExportBlocked}
      onPress={async () => {
        if (isExportBlocked) {
          showBotWalletDisabledToast('export');
          return;
        }
        if (
          await backgroundApiProxy.serviceAccount.checkIsWalletNotBackedUp({
            walletId: wallet?.id ?? '',
          })
        ) {
          onClose?.();
          return;
        }

        if (exportType === 'mnemonic') {
          onClose?.();
          const { mnemonic } =
            await backgroundApiProxy.serviceAccount.getTonImportedAccountMnemonic(
              {
                accountId: account?.id ?? '',
              },
            );
          if (mnemonic) ensureSensitiveTextEncoded(mnemonic);
          navigateToBackupWalletReminderPage({
            walletId: wallet?.id ?? '',
            accountName: accountName ?? '',
            isWalletBackedUp: wallet?.backuped ?? false,
            mnemonic,
          });
          return;
        }
        onClose?.();
        navigation.pushModal(EModalRoutes.AccountManagerStacks, {
          screen: EAccountManagerStacksRoutes.ExportPrivateKeysPage,
          params: {
            indexedAccount,
            account,
            accountName,
            title: label,
            exportType,
          },
        });
      }}
    />
  );
}
