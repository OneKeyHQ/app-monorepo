import { useMemo } from 'react';

import { useIntl } from 'react-intl';

import { ActionList, Divider } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { AccountSelectorProviderMirror } from '@onekeyhq/kit/src/components/AccountSelector';
import { ListItem } from '@onekeyhq/kit/src/components/ListItem';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import { useAccountSelectorContextData } from '@onekeyhq/kit/src/states/jotai/contexts/accountSelector';
import type {
  IDBAccount,
  IDBIndexedAccount,
  IDBUtxoAccount,
  IDBWallet,
} from '@onekeyhq/kit-bg/src/dbs/local/types';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';

import { AccountExportPrivateKeyButton } from './AccountExportPrivateKeyButton';
import { AccountMoveToTopButton } from './AccountMoveToTopButton';
import { AccountRemoveButton } from './AccountRemoveButton';
import { AccountRenameButton } from './AccountRenameButton';

export function AccountEditButton({
  accountsCount,
  indexedAccount,
  firstIndexedAccount,
  account,
  firstAccount,
  wallet,
}: {
  accountsCount: number;
  indexedAccount?: IDBIndexedAccount;
  firstIndexedAccount?: IDBIndexedAccount;
  account?: IDBAccount;
  firstAccount?: IDBAccount;
  wallet?: IDBWallet;
}) {
  const intl = useIntl();
  const { config } = useAccountSelectorContextData();
  const name = indexedAccount?.name || account?.name || '--';
  // const { config } = useAccountSelectorContextData();
  // if (!config) {
  //   return null;
  // }

  const showRemoveButton = useMemo(() => {
    if (indexedAccount && accountsCount <= 1) {
      return false;
    }
    return true;
  }, [accountsCount, indexedAccount]);

  const isImportedAccount = useMemo(
    () =>
      Boolean(
        account &&
          !indexedAccount &&
          account?.id &&
          accountUtils.isImportedAccount({ accountId: account?.id }),
      ),
    [account, indexedAccount],
  );

  const isWatchingAccount = useMemo(
    () =>
      Boolean(
        account &&
          !indexedAccount &&
          account?.id &&
          accountUtils.isWatchingAccount({ accountId: account?.id }),
      ),
    [account, indexedAccount],
  );

  const isHdAccount = useMemo(
    () =>
      indexedAccount &&
      !account &&
      wallet?.id &&
      accountUtils.isHdWallet({ walletId: wallet?.id }),
    [account, indexedAccount, wallet?.id],
  );

  const { result: exportKeysVisible } = usePromiseResult<{
    showExportPrivateKey: boolean;
    showExportPublicKey: boolean;
  }>(async () => {
    if (
      (isImportedAccount && account?.createAtNetwork) ||
      (isWatchingAccount &&
        account?.createAtNetwork &&
        (account?.pub || (account as IDBUtxoAccount)?.xpub))
    ) {
      const privateKeyTypes =
        await backgroundApiProxy.serviceAccount.getNetworkSupportedExportKeyTypes(
          {
            networkId: account?.createAtNetwork,
            exportType: 'privateKey',
          },
        );
      const publicKeyTypes =
        await backgroundApiProxy.serviceAccount.getNetworkSupportedExportKeyTypes(
          {
            networkId: account?.createAtNetwork,
            exportType: 'publicKey',
          },
        );
      return {
        showExportPrivateKey: isWatchingAccount
          ? false
          : Boolean(privateKeyTypes?.length),
        showExportPublicKey: Boolean(publicKeyTypes?.length),
      };
    }

    if (isHdAccount) {
      return {
        showExportPrivateKey: true,
        showExportPublicKey: true,
      };
    }

    return {
      showExportPrivateKey: false,
      showExportPublicKey: false,
    };
  }, [account, isHdAccount, isImportedAccount, isWatchingAccount]);

  if (!config) {
    return null;
  }
  return (
    <ActionList
      title={name}
      renderTrigger={
        <ListItem.IconButton
          testID={'account-item-edit-button-' + name}
          icon="DotHorOutline"
        />
      }
      renderItems={({ handleActionListClose }) => (
        // fix missing context in popover
        <AccountSelectorProviderMirror enabledNum={[0]} config={config}>
          <AccountRenameButton
            name={name}
            indexedAccount={indexedAccount}
            account={account}
            onClose={handleActionListClose}
          />
          {exportKeysVisible?.showExportPrivateKey ? (
            <AccountExportPrivateKeyButton
              testID={'popover-export-private-key-' + name}
              icon="KeyOutline"
              accountName={name}
              indexedAccount={indexedAccount}
              account={account}
              onClose={handleActionListClose}
              label={intl.formatMessage({
                id: ETranslations.global_export_private_key,
              })}
              exportType="privateKey"
            />
          ) : null}
          {exportKeysVisible?.showExportPublicKey ? (
            <AccountExportPrivateKeyButton
              testID={'popover-export-public-key-' + name}
              icon="PasswordOutline"
              accountName={name}
              indexedAccount={indexedAccount}
              account={account}
              onClose={handleActionListClose}
              label={intl.formatMessage({
                id: ETranslations.global_public_key_export,
              })}
              exportType="publicKey"
            />
          ) : null}
          <AccountMoveToTopButton
            indexedAccount={indexedAccount}
            firstIndexedAccount={firstIndexedAccount}
            account={account}
            firstAccount={firstAccount}
            onClose={handleActionListClose}
          />
          {showRemoveButton ? (
            <>
              <Divider mx="$2" my="$1" />
              <AccountRemoveButton
                name={name}
                indexedAccount={indexedAccount}
                account={account}
                onClose={handleActionListClose}
              />
            </>
          ) : null}
        </AccountSelectorProviderMirror>
      )}
    />
  );
}
