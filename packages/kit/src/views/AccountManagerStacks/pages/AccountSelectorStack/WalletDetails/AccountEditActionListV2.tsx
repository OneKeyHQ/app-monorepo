import { useCallback, useMemo } from 'react';

import { useIntl } from 'react-intl';

import { Divider, type IActionListProps } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { AccountSelectorProviderMirror } from '@onekeyhq/kit/src/components/AccountSelector';
import { useAccountData } from '@onekeyhq/kit/src/hooks/useAccountData';
import { useAccountSelectorContextData } from '@onekeyhq/kit/src/states/jotai/contexts/accountSelector';
import type {
  IDBAccount,
  IDBIndexedAccount,
  IDBUtxoAccount,
  IDBWallet,
} from '@onekeyhq/kit-bg/src/dbs/local/types';
import { getVendorProfile } from '@onekeyhq/shared/src/hardware/vendorProfile';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';

import { AccountCopyButton } from '../../../components/AccountEdit/AccountCopyButton';
import { AccountExportPrivateKeyButton } from '../../../components/AccountEdit/AccountExportPrivateKeyButton';
import { AccountMoveToTopButton } from '../../../components/AccountEdit/AccountMoveToTopButton';
import { AccountRemoveButton } from '../../../components/AccountEdit/AccountRemoveButton';
import { AccountRenameButton } from '../../../components/AccountEdit/AccountRenameButton';
import { AccountManagerTestIDs } from '../../../testIDs';

export interface IAccountEditActionListV2Props {
  avatarNetworkId?: string;
  accountsCount: number;
  indexedAccount?: IDBIndexedAccount;
  firstIndexedAccount?: IDBIndexedAccount;
  account?: IDBAccount;
  firstAccount?: IDBAccount;
  wallet?: IDBWallet;
  networkId?: string;
}

export interface IAccountEditActionListOptionsV2 {
  title: string;
  ready: boolean;
  renderItemsAsync: NonNullable<IActionListProps['renderItemsAsync']>;
}

export function useAccountEditActionListOptionsV2({
  avatarNetworkId,
  accountsCount,
  indexedAccount,
  firstIndexedAccount,
  account,
  firstAccount,
  wallet,
  networkId,
}: IAccountEditActionListV2Props): IAccountEditActionListOptionsV2 {
  const intl = useIntl();
  const { config } = useAccountSelectorContextData();
  const name = indexedAccount?.name || account?.name || '--';
  const { network, vaultSettings, isLoading } = useAccountData({
    networkId: account?.createAtNetwork ?? networkId,
    options: { watchLoading: true },
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
      // Third-party HW (Ledger) — no unified verify-and-confirm public key flow
      if (
        wallet?.associatedDeviceInfo?.vendor &&
        getVendorProfile(wallet.associatedDeviceInfo.vendor).isThirdParty
      ) {
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
    wallet?.associatedDeviceInfo?.vendor,
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
              avatarNetworkId={avatarNetworkId}
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
              testID={AccountManagerTestIDs.exportPrivateKey(name)}
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
              testID={AccountManagerTestIDs.exportPublicKey(name)}
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
              testID={AccountManagerTestIDs.exportMnemonicKey(name)}
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
      showCopyButton,
      avatarNetworkId,
      wallet,
      indexedAccount,
      account,
      name,
      intl,
      firstIndexedAccount,
      firstAccount,
      showRemoveButton,
      accountsCount,
    ],
  );

  return {
    title: name,
    // Keep account management available when network metadata fails to load.
    ready: !(account?.createAtNetwork ?? networkId) || isLoading === false,
    renderItemsAsync: renderItems,
  };
}
