import { useCallback, useRef } from 'react';

import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import type { IAccountSelectorActiveAccountInfo } from '@onekeyhq/kit/src/states/jotai/contexts/accountSelector';
import {
  EModalRoutes,
  EModalWalletAddressRoutes,
} from '@onekeyhq/shared/src/routes';
import networkUtils from '@onekeyhq/shared/src/utils/networkUtils';

export const useAllNetworkCopyAddressHandler = ({
  activeAccount,
}: {
  activeAccount: IAccountSelectorActiveAccountInfo;
}) => {
  const { account, indexedAccount, network, wallet } = activeAccount;
  const activeAccountRef = useRef(activeAccount);
  activeAccountRef.current = activeAccount;

  const appNavigation = useAppNavigation();
  const isAllNetworkEnabled =
    network &&
    networkUtils.isAllNetwork({ networkId: network.id }) &&
    indexedAccount !== undefined;

  const handleAllNetworkCopyAddress = useCallback(() => {
    console.log(activeAccountRef.current);
    if (!indexedAccount) {
      return;
    }
    appNavigation.pushModal(EModalRoutes.WalletAddress, {
      screen: EModalWalletAddressRoutes.WalletAddress,
      params: {
        accountId: account?.id,
        indexedAccountId: indexedAccount.id,
        walletId: wallet?.id,
      },
    });
  }, [appNavigation, account, indexedAccount, wallet]);

  return {
    isAllNetworkEnabled,
    handleAllNetworkCopyAddress,
  };
};
