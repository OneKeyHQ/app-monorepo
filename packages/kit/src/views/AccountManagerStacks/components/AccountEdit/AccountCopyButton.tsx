import { useCallback } from 'react';

import { useIntl } from 'react-intl';

import type { IPageNavigationProp } from '@onekeyhq/components';
import { ActionList } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { useAccountData } from '@onekeyhq/kit/src/hooks/useAccountData';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { useCopyAddressWithDeriveType } from '@onekeyhq/kit/src/hooks/useCopyAccountAddress';
import { useUserWalletProfile } from '@onekeyhq/kit/src/hooks/useUserWalletProfile';
import { useActiveAccount } from '@onekeyhq/kit/src/states/jotai/contexts/accountSelector';
import type {
  IDBAccount,
  IDBIndexedAccount,
  IDBWallet,
} from '@onekeyhq/kit-bg/src/dbs/local/types';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import type { IModalReceiveParamList } from '@onekeyhq/shared/src/routes';
import {
  EModalReceiveRoutes,
  EModalRoutes,
  EModalWalletAddressRoutes,
} from '@onekeyhq/shared/src/routes';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';

export function AccountCopyButton({
  indexedAccount,
  account,
  wallet,
  onClose,
}: {
  indexedAccount?: IDBIndexedAccount;
  account?: IDBAccount;
  wallet?: IDBWallet;
  onClose: () => void;
}) {
  const intl = useIntl();
  const { activeAccount } = useActiveAccount({ num: 0 });

  const navigation =
    useAppNavigation<IPageNavigationProp<IModalReceiveParamList>>();
  const copyAddressWithDeriveType = useCopyAddressWithDeriveType();

  const currentNetworkId =
    account?.createAtNetwork ?? activeAccount?.network?.id;

  const { network, vaultSettings } = useAccountData({
    networkId: currentNetworkId,
  });

  const { isSoftwareWalletOnlyUser } = useUserWalletProfile();

  const handleCopyAddress = useCallback(async () => {
    if (
      await backgroundApiProxy.serviceAccount.checkIsWalletNotBackedUp({
        walletId: wallet?.id ?? '',
      })
    ) {
      return;
    }

    defaultLogger.wallet.walletActions.actionCopyAddress({
      walletType: wallet?.type ?? '',
      networkId: network?.id ?? '',
      source: 'accountSelector',
      isSoftwareWalletOnlyUser,
    });
    if (network?.isAllNetworks) {
      navigation.pushModal(EModalRoutes.WalletAddress, {
        screen: EModalWalletAddressRoutes.WalletAddress,
        params: {
          accountId: account?.id ?? indexedAccount?.associateAccount?.id ?? '',
          indexedAccountId: indexedAccount?.id ?? '',
          walletId: wallet?.id,
        },
      });
    } else if (accountUtils.isHwOrQrWallet({ walletId: wallet?.id ?? '' })) {
      navigation.pushModal(EModalRoutes.ReceiveModal, {
        screen: EModalReceiveRoutes.ReceiveToken,
        params: {
          networkId: network?.id ?? '',
          accountId: account?.id ?? indexedAccount?.associateAccount?.id ?? '',
          walletId: wallet?.id ?? '',
        },
      });
    } else if (
      !accountUtils.isOthersWallet({ walletId: wallet?.id ?? '' }) &&
      vaultSettings?.mergeDeriveAssetsEnabled
    ) {
      const defaultDeriveType =
        await backgroundApiProxy.serviceNetwork.getGlobalDeriveTypeOfNetwork({
          networkId: network?.id ?? '',
        });

      const { accounts } =
        await backgroundApiProxy.serviceAccount.getAccountsByIndexedAccounts({
          indexedAccountIds: [indexedAccount?.id ?? ''],
          networkId: network?.id ?? '',
          deriveType: defaultDeriveType,
        });

      copyAddressWithDeriveType({
        address: accounts?.[0]?.address || '',
        deriveInfo: activeAccount?.deriveInfoItems?.find(
          (item) => item.value === defaultDeriveType,
        )?.item,
        networkName: network?.shortname,
      });
    } else {
      copyAddressWithDeriveType({
        address:
          account?.address || indexedAccount?.associateAccount?.address || '',
        networkName: network?.shortname,
      });
    }
    onClose();
  }, [
    wallet?.id,
    wallet?.type,
    network?.id,
    network?.isAllNetworks,
    network?.shortname,
    isSoftwareWalletOnlyUser,
    vaultSettings?.mergeDeriveAssetsEnabled,
    onClose,
    navigation,
    account?.id,
    account?.address,
    indexedAccount?.associateAccount?.id,
    indexedAccount?.associateAccount?.address,
    indexedAccount?.id,
    copyAddressWithDeriveType,
    activeAccount?.deriveInfoItems,
  ]);

  return (
    <ActionList.Item
      trackID="wallet-copy"
      icon="Copy3Outline"
      label={intl.formatMessage({ id: ETranslations.global_copy_address })}
      onClose={() => {}}
      onPress={handleCopyAddress}
    />
  );
}
