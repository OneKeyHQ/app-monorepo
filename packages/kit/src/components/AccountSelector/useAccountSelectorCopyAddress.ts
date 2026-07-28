import { useCallback } from 'react';

import type { IPageNavigationProp } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { useBotWalletDeactivatedStatus } from '@onekeyhq/kit/src/hooks/useBotWalletDeactivatedStatus';
import { useCopyAddressWithDeriveType } from '@onekeyhq/kit/src/hooks/useCopyAccountAddress';
import type { IAccountSelectorActiveAccountInfo } from '@onekeyhq/kit/src/states/jotai/contexts/accountSelector';
import { useAllNetworkCopyAddressHandler } from '@onekeyhq/kit/src/views/WalletAddress/hooks/useAllNetworkCopyAddressHandler';
import type { IModalReceiveParamList } from '@onekeyhq/shared/src/routes';
import { EModalReceiveRoutes, EModalRoutes } from '@onekeyhq/shared/src/routes';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';

import { showBotWalletDisabledToast } from '../../utils/botWalletDisabledToast';
import { shouldBlockBotWalletCopyAddress } from '../../utils/botWalletStatusUtils';

export function useAccountSelectorCopyAddress({
  activeAccount,
}: {
  activeAccount: IAccountSelectorActiveAccountInfo;
}) {
  const {
    account,
    deriveInfoItems,
    indexedAccount,
    network,
    vaultSettings,
    wallet,
  } = activeAccount;
  const navigation =
    useAppNavigation<IPageNavigationProp<IModalReceiveParamList>>();
  const copyAddressWithDeriveType = useCopyAddressWithDeriveType();
  const { isAllNetworkEnabled, handleAllNetworkCopyAddress } =
    useAllNetworkCopyAddressHandler({ activeAccount });
  const { isBotWallet, isBotWalletDeactivated } = useBotWalletDeactivatedStatus(
    {
      walletId: wallet?.id,
    },
  );
  const isCopyDisabled = shouldBlockBotWalletCopyAddress({
    isBotWallet,
    isBotWalletDeactivated,
  });

  const copyAddress = useCallback(async () => {
    if (isCopyDisabled) {
      showBotWalletDisabledToast('copyAddress');
      return;
    }
    if (isAllNetworkEnabled) {
      if (
        await backgroundApiProxy.serviceAccount.checkIsWalletNotBackedUp({
          walletId: wallet?.id ?? '',
        })
      ) {
        return;
      }
      await handleAllNetworkCopyAddress(true);
      return;
    }
    if (!account?.address || !network || !wallet) {
      return;
    }
    if (
      await backgroundApiProxy.serviceAccount.checkIsWalletNotBackedUp({
        walletId: wallet.id,
      })
    ) {
      return;
    }
    if (
      accountUtils.isHwWallet({ walletId: wallet.id }) ||
      accountUtils.isQrWallet({ walletId: wallet.id })
    ) {
      navigation.pushModal(EModalRoutes.ReceiveModal, {
        screen: EModalReceiveRoutes.ReceiveToken,
        params: {
          networkId: network.id,
          accountId: account.id,
          walletId: wallet.id,
        },
      });
      return;
    }
    if (
      vaultSettings?.mergeDeriveAssetsEnabled &&
      accountUtils.isHdWallet({ walletId: wallet.id })
    ) {
      const defaultDeriveType =
        await backgroundApiProxy.serviceNetwork.getGlobalDeriveTypeOfNetwork({
          networkId: network.id,
        });
      const { accounts } =
        await backgroundApiProxy.serviceAccount.getAccountsByIndexedAccounts({
          indexedAccountIds: [indexedAccount?.id ?? ''],
          networkId: network.id,
          deriveType: defaultDeriveType,
        });
      copyAddressWithDeriveType({
        address: accounts?.[0]?.address || '',
        deriveInfo: deriveInfoItems.find(
          (item) => item.value === defaultDeriveType,
        )?.item,
        networkName: network.name,
      });
      return;
    }
    let networkName = network.name;
    if (
      network.isAllNetworks &&
      accountUtils.isOthersWallet({ walletId: wallet.id }) &&
      account.createAtNetwork
    ) {
      const createAtNetwork =
        await backgroundApiProxy.serviceNetwork.getNetworkSafe({
          networkId: account.createAtNetwork,
        });
      networkName = createAtNetwork?.shortname ?? networkName;
    }
    copyAddressWithDeriveType({
      address: account.address,
      networkName,
    });
  }, [
    account,
    copyAddressWithDeriveType,
    deriveInfoItems,
    handleAllNetworkCopyAddress,
    indexedAccount?.id,
    isAllNetworkEnabled,
    isCopyDisabled,
    navigation,
    network,
    vaultSettings?.mergeDeriveAssetsEnabled,
    wallet,
  ]);

  return {
    copyAddress,
    isCopyDisabled,
  };
}
