import { useEffect, useRef } from 'react';

import { getNetworkIdsMap } from '@onekeyhq/shared/src/config/networkIds';
import type { INetworkAccount } from '@onekeyhq/shared/types/account';
import type { IHex } from '@onekeyhq/shared/types/hyperliquid/sdk';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import { GlobalJotaiReady } from '../../../components/GlobalJotaiReady';
import { usePromiseResult } from '../../../hooks/usePromiseResult';
import { useActiveAccount } from '../../../states/jotai/contexts/accountSelector';
import { useHyperliquidActions } from '../../../states/jotai/contexts/hyperliquid';
import { usePerpsAccountLoadingAtom } from '../../../states/jotai/contexts/hyperliquid/atoms';

export function PerpsGlobalEffectsView() {
  const { activeAccount } = useActiveAccount({ num: 0 });
  const [, setPerpsAccountLoading] = usePerpsAccountLoadingAtom();
  const actions = useHyperliquidActions();
  const hidePerpsAccountLoadingTimer = useRef<
    ReturnType<typeof setTimeout> | undefined
  >(undefined);
  const { result: ethAccountData } = usePromiseResult<
    INetworkAccount | null | undefined
  >(async () => {
    try {
      clearTimeout(hidePerpsAccountLoadingTimer.current);
      setPerpsAccountLoading(true);
      const indexedAccountId = activeAccount?.indexedAccount?.id;
      const accountId = activeAccount?.account?.id;
      const deriveType = activeAccount?.deriveType;

      if (!indexedAccountId && !accountId) return null;

      const ethNetworkId = getNetworkIdsMap().arbitrum;

      const account = await backgroundApiProxy.serviceAccount.getNetworkAccount(
        {
          indexedAccountId,
          accountId: indexedAccountId ? undefined : accountId,
          networkId: ethNetworkId,
          deriveType: deriveType || 'default',
        },
      );

      return account;
    } catch (error) {
      console.error(error);
      return null;
    } finally {
      hidePerpsAccountLoadingTimer.current = setTimeout(() => {
        setPerpsAccountLoading(false);
      }, 200);
    }
  }, [
    activeAccount?.account?.id,
    activeAccount?.deriveType,
    activeAccount?.indexedAccount?.id,
    setPerpsAccountLoading,
  ]);
  const userAddress = ethAccountData?.address ?? null;
  const userAccountId = ethAccountData?.id ?? null;
  useEffect(() => {
    console.log('usePerpUseChainAccount -> activeAccountId: ', {
      userAddress,
      userAccountId,
    });
    if (
      typeof userAddress === 'string' &&
      userAddress.startsWith('0x') &&
      userAccountId
    ) {
      void actions.current.setCurrentUser(userAddress as IHex);
      void actions.current.setCurrentAccount(userAccountId);
    } else {
      void actions.current.setCurrentUser(null);
      void actions.current.setCurrentAccount(null);
    }
  }, [userAddress, actions, userAccountId]);

  return null;
}

export function PerpsGlobalEffects() {
  return (
    <GlobalJotaiReady>
      <PerpsGlobalEffectsView />
    </GlobalJotaiReady>
  );
}
