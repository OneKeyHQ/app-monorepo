import type { IKeyOfIcons } from '@onekeyhq/components';
import { ActionList } from '@onekeyhq/components';
import { ensureSensitiveTextEncoded } from '@onekeyhq/core/src/secret';
import type { IExportKeyType } from '@onekeyhq/core/src/types';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import type {
  IDBAccount,
  IDBIndexedAccount,
} from '@onekeyhq/kit-bg/src/dbs/local/types';
import {
  EAccountManagerStacksRoutes,
  EModalRoutes,
  EOnboardingPages,
} from '@onekeyhq/shared/src/routes';

export function AccountExportPrivateKeyButton({
  testID,
  accountName,
  indexedAccount,
  account,
  onClose,
  icon,
  label,
  exportType,
}: {
  testID?: string;
  accountName?: string;
  indexedAccount?: IDBIndexedAccount;
  account?: IDBAccount;
  onClose: () => void;
  icon: IKeyOfIcons;
  label: string;
  exportType: IExportKeyType;
}) {
  const navigation = useAppNavigation();

  return (
    <ActionList.Item
      testID={testID}
      icon={icon}
      label={label}
      onClose={onClose}
      onPress={async () => {
        if (exportType === 'mnemonic') {
          onClose?.();
          const { mnemonic } =
            await backgroundApiProxy.serviceAccount.getTonImportedAccountMnemonic(
              {
                accountId: account?.id ?? '',
              },
            );
          if (mnemonic) ensureSensitiveTextEncoded(mnemonic);
          navigation.pushModal(EModalRoutes.OnboardingModal, {
            screen: EOnboardingPages.BeforeShowRecoveryPhrase,
            params: {
              mnemonic,
              isBackup: true,
            },
          });
          return;
        }
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
