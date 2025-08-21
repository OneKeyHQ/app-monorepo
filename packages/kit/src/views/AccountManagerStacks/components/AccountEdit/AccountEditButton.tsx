import { memo, useCallback, useMemo } from 'react';

import { useIntl } from 'react-intl';

import { ActionList, Divider } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { AccountSelectorProviderMirror } from '@onekeyhq/kit/src/components/AccountSelector';
import { ListItem } from '@onekeyhq/kit/src/components/ListItem';
import { useAccountData } from '@onekeyhq/kit/src/hooks/useAccountData';
import { useAccountSelectorContextData } from '@onekeyhq/kit/src/states/jotai/contexts/accountSelector';
import type {
  IDBAccount,
  IDBIndexedAccount,
  IDBUtxoAccount,
  IDBWallet,
} from '@onekeyhq/kit-bg/src/dbs/local/types';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';

import { AccountCopyButton } from './AccountCopyButton';
import { AccountExportPrivateKeyButton } from './AccountExportPrivateKeyButton';
import { AccountMoveToTopButton } from './AccountMoveToTopButton';
import { AccountRemoveButton } from './AccountRemoveButton';
import { AccountRenameButton } from './AccountRenameButton';

function AccountEditButtonView({
  accountsCount,
  indexedAccount,
  firstIndexedAccount,
  account,
  firstAccount,
  wallet,
  networkId,
}: {
  accountsCount: number;
  indexedAccount?: IDBIndexedAccount;
  firstIndexedAccount?: IDBIndexedAccount;
  account?: IDBAccount;
  firstAccount?: IDBAccount;
  wallet?: IDBWallet;
  networkId?: string;
}) {
  const intl = useIntl();
  const { config } = useAccountSelectorContextData();
  const name = indexedAccount?.name || account?.name || '--';
  const { network, vaultSettings } = useAccountData({
    networkId: account?.createAtNetwork ?? networkId,
  });
  // const { config } = useAccountSelectorContextData();
  // if (!config) {
  //   return null;
  // }

  const showRemoveButton = useMemo(() => {
    if (accountUtils.isQrWallet({ walletId: wallet?.id })) {
      return false;
    }
    if (indexedAccount && accountsCount <= 1) {
      return false;
    }
    return true;
  }, [accountsCount, indexedAccount, wallet?.id]);

  const showCopyButton = useMemo(() => {
    if (network?.isAllNetworks) {
      return true;
    }

    if (vaultSettings?.copyAddressDisabled) {
      return false;
    }

    if (!account && !indexedAccount?.associateAccount) {
      return false;
    }

    return true;
  }, [account, indexedAccount, network, vaultSettings?.copyAddressDisabled]);

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

  const isHwOrQrAccount = useMemo(
    () =>
      indexedAccount &&
      !account &&
      wallet?.id &&
      accountUtils.isHwOrQrWallet({ walletId: wallet?.id }),
    [account, indexedAccount, wallet?.id],
  );

  const getExportKeysVisible = useCallback(async () => {
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

      const mnemonicTypes =
        await backgroundApiProxy.serviceAccount.getNetworkSupportedExportKeyTypes(
          {
            accountId: account?.id,
            networkId: account?.createAtNetwork,
            exportType: 'mnemonic',
          },
        );

      return {
        showExportPrivateKey: isWatchingAccount
          ? false
          : Boolean(privateKeyTypes?.length),
        showExportPublicKey: Boolean(publicKeyTypes?.length),
        showExportMnemonic: Boolean(mnemonicTypes?.length),
      };
    }

    if (isHdAccount) {
      return {
        showExportPrivateKey: true,
        showExportPublicKey: true,
      };
    }

    if (isHwOrQrAccount) {
      let showExportPublicKey = true;

      // qr wallet firmware does not support verify and confirm public key currently
      if (accountUtils.isQrWallet({ walletId: wallet?.id })) {
        showExportPublicKey = false;
      }
      return {
        showExportPrivateKey: false,
        showExportPublicKey,
      };
    }

    return {
      showExportPrivateKey: false,
      showExportPublicKey: false,
    };
  }, [
    account,
    isHdAccount,
    isHwOrQrAccount,
    isImportedAccount,
    isWatchingAccount,
    wallet?.id,
  ]);

  const renderItems = useCallback(
    async ({
      handleActionListClose,
    }: {
      handleActionListClose: () => void;
    }) => {
      if (!config) {
        return null;
      }
      const exportKeysVisible = await getExportKeysVisible();
      return (
        // fix missing context in popover
        <AccountSelectorProviderMirror enabledNum={[0]} config={config}>
          {(() => {
            defaultLogger.accountSelector.perf.renderAccountEditOptions({
              wallet,
              indexedAccount,
              account,
            });
            return null;
          })()}
          {showCopyButton ? (
            <AccountCopyButton
              wallet={wallet}
              indexedAccount={indexedAccount}
              account={account}
              onClose={handleActionListClose}
            />
          ) : null}
          <AccountRenameButton
            name={name}
            wallet={wallet}
            indexedAccount={indexedAccount}
            account={account}
            onClose={handleActionListClose}
          />

          {exportKeysVisible?.showExportPrivateKey ? (
            <AccountExportPrivateKeyButton
              testID={`popover-export-private-key-${name}`}
              icon="KeyOutline"
              accountName={name}
              indexedAccount={indexedAccount}
              account={account}
              wallet={wallet}
              onClose={handleActionListClose}
              label={intl.formatMessage({
                id: ETranslations.global_export_private_key,
              })}
              exportType="privateKey"
            />
          ) : null}
          {exportKeysVisible?.showExportPublicKey ? (
            <AccountExportPrivateKeyButton
              testID={`popover-export-public-key-${name}`}
              icon="PasswordOutline"
              accountName={name}
              indexedAccount={indexedAccount}
              account={account}
              wallet={wallet}
              onClose={handleActionListClose}
              label={intl.formatMessage({
                id: ETranslations.global_public_key_export,
              })}
              exportType="publicKey"
            />
          ) : null}
          {exportKeysVisible?.showExportMnemonic ? (
            <AccountExportPrivateKeyButton
              testID={`popover-export-mnemonic-key-${name}`}
              icon="Shield2CheckOutline"
              accountName={name}
              indexedAccount={indexedAccount}
              account={account}
              wallet={wallet}
              onClose={handleActionListClose}
              label={intl.formatMessage({
                id: ETranslations.global_backup_recovery_phrase,
              })}
              exportType="mnemonic"
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
                accountsCount={accountsCount}
                name={name}
                indexedAccount={indexedAccount}
                account={account}
                onClose={handleActionListClose}
              />
            </>
          ) : null}
        </AccountSelectorProviderMirror>
      );
    },
    [
      config,
      getExportKeysVisible,
      name,
      wallet,
      indexedAccount,
      account,
      showCopyButton,
      intl,
      firstIndexedAccount,
      firstAccount,
      showRemoveButton,
      accountsCount,
    ],
  );

  return (
    <ActionList
      title={name}
      renderTrigger={
        <ListItem.IconButton
          testID={`account-item-edit-button-${name}`}
          icon="DotHorOutline"
        />
      }
      renderItemsAsync={renderItems}
    />
  );
}

export const AccountEditButton = memo(AccountEditButtonView);
