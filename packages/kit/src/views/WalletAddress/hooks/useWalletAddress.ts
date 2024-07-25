import { useCallback } from 'react';

import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import type { IAccountSelectorActiveAccountInfo } from '@onekeyhq/kit/src/states/jotai/contexts/accountSelector';
import {
  EModalRoutes,
  EModalWalletAddressRoutes,
} from '@onekeyhq/shared/src/routes';
import networkUtils from '@onekeyhq/shared/src/utils/networkUtils';

export const useWalletAddress = ({
  activeAccount,
}: {
  activeAccount: IAccountSelectorActiveAccountInfo;
}) => {
  const { account, indexedAccount, wallet, deriveType, network, deriveInfo } =
    activeAccount;
  const appNavigation = useAppNavigation();
  const isEnable =
    network &&
    networkUtils.isAllNetwork({ networkId: network.id }) &&
    indexedAccount !== undefined;

  const handleWalletAddress = useCallback(() => {
    if (!indexedAccount || !wallet || !deriveInfo) {
      return;
    }
    appNavigation.pushModal(EModalRoutes.WalletAddress, {
      screen: EModalWalletAddressRoutes.WalletAddress,
      params: {
        accountId: account?.id,
        indexedAccountId: indexedAccount?.id,
        walletId: wallet?.id,
        deriveType,
        deriveInfo,
      },
    });
  }, [appNavigation, account, indexedAccount, wallet, deriveType, deriveInfo]);

  return {
    isEnable,
    handleWalletAddress,
  };
};
