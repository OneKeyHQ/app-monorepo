import { useCallback } from 'react';

import { useIntl } from 'react-intl';

import type { IPageNavigationProp } from '@onekeyhq/components';
import { ActionList } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { useCopyAddressWithDeriveType } from '@onekeyhq/kit/src/hooks/useCopyAccountAddress';
import { useUserWalletProfile } from '@onekeyhq/kit/src/hooks/useUserWalletProfile';
import { useActiveAccount } from '@onekeyhq/kit/src/states/jotai/contexts/accountSelector';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import type { IModalReceiveParamList } from '@onekeyhq/shared/src/routes';
import { EModalReceiveRoutes, EModalRoutes } from '@onekeyhq/shared/src/routes';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';

import { useAllNetworkCopyAddressHandler } from '../../../WalletAddress/hooks/useAllNetworkCopyAddressHandler';

export function WalletActionCopy({ onClose }: { onClose: () => void }) {
  const { activeAccount } = useActiveAccount({ num: 0 });

  const {
    network,
    account,
    wallet,
    vaultSettings,
    indexedAccount,
    deriveInfoItems,
  } = activeAccount;

  const intl = useIntl();

  const navigation =
    useAppNavigation<IPageNavigationProp<IModalReceiveParamList>>();
  const copyAddressWithDeriveType = useCopyAddressWithDeriveType();

  const { isAllNetworkEnabled, handleAllNetworkCopyAddress } =
    useAllNetworkCopyAddressHandler({
      activeAccount,
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
      source: 'homePage',
      isSoftwareWalletOnlyUser,
    });
    if (isAllNetworkEnabled) {
      void handleAllNetworkCopyAddress();
    } else if (accountUtils.isHwOrQrWallet({ walletId: wallet?.id ?? '' })) {
      navigation.pushModal(EModalRoutes.ReceiveModal, {
        screen: EModalReceiveRoutes.ReceiveToken,
        params: {
          networkId: network?.id ?? '',
          accountId: account?.id ?? '',
          walletId: wallet?.id ?? '',
        },
      });
    } else if (
      !network?.isAllNetworks &&
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
        deriveInfo: deriveInfoItems.find(
          (item) => item.value === defaultDeriveType,
        )?.item,
        networkName: network?.shortname,
      });
    } else {
      let networkName = network?.shortname;

      if (
        network?.isAllNetworks &&
        accountUtils.isOthersWallet({ walletId: wallet?.id ?? '' }) &&
        account?.createAtNetwork
      ) {
        const createAtNetwork =
          await backgroundApiProxy.serviceNetwork.getNetworkSafe({
            networkId: account.createAtNetwork,
          });
        networkName = createAtNetwork?.shortname ?? networkName;
      }

      copyAddressWithDeriveType({
        address: account?.address || '',
        networkName,
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
    isAllNetworkEnabled,
    vaultSettings?.mergeDeriveAssetsEnabled,
    onClose,
    handleAllNetworkCopyAddress,
    navigation,
    account?.id,
    account?.createAtNetwork,
    account?.address,
    indexedAccount?.id,
    copyAddressWithDeriveType,
    deriveInfoItems,
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
