import { useEffect } from 'react';

import type { IHex } from '@onekeyhq/shared/types/hyperliquid/sdk';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import { usePromiseResult } from '../../../hooks/usePromiseResult';
import { useActiveAccount } from '../../../states/jotai/contexts/accountSelector';
import { useHyperliquidActions } from '../../../states/jotai/contexts/hyperliquid';

export function usePerpUseChainAccount() {
  const { activeAccount } = useActiveAccount({ num: 0 });
  const actions = useHyperliquidActions();
  const { result: ethAccountData } = usePromiseResult(async () => {
    if (!activeAccount?.account?.id) return null;

    const ethNetworkId = 'evm--42161';
    const account = await backgroundApiProxy.serviceAccount.getAccount({
      accountId: activeAccount.account.id,
      networkId: ethNetworkId,
    });

    return account;
  }, [activeAccount?.account?.id]);
  const userAddress = ethAccountData?.address as IHex | undefined;
  useEffect(() => {
    if (
      typeof userAddress === 'string' &&
      userAddress.startsWith('0x') &&
      activeAccount.account?.id
    ) {
      void actions.current.setCurrentUser(userAddress);
      void actions.current.setCurrentAccount(activeAccount.account?.id);
    }
  }, [userAddress, actions, activeAccount.account]);
  return {
    userAddress,
  };
}
