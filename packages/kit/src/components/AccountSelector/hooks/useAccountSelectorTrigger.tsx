import { useCallback, useEffect, useState } from 'react';

import type { IAccountSelectorRouteParamsExtraConfig } from '@onekeyhq/shared/src/routes';

import useAppNavigation from '../../../hooks/useAppNavigation';
import {
  useAccountSelectorActions,
  useAccountSelectorSceneInfo,
  useActiveAccount,
} from '../../../states/jotai/contexts/accountSelector';

export function useAccountSelectorTrigger({
  num,
  showConnectWalletModalInDappMode,
  linkNetworkId,
  ...others
}: {
  num: number;
  showConnectWalletModalInDappMode?: boolean;
} & IAccountSelectorRouteParamsExtraConfig) {
  const navigation = useAppNavigation();
  const { activeAccount } = useActiveAccount({ num });
  const { sceneName, sceneUrl } = useAccountSelectorSceneInfo();
  const actions = useAccountSelectorActions();

  const showAccountSelector = useCallback(() => {
    void actions.current.showAccountSelector({
      activeWallet: activeAccount.wallet,
      num,
      navigation,
      sceneName,
      sceneUrl,
      showConnectWalletModalInDappMode,
      linkNetworkId,
      ...others,
    });
  }, [
    linkNetworkId,
    actions,
    activeAccount.wallet,
    others,
    navigation,
    num,
    sceneName,
    sceneUrl,
    showConnectWalletModalInDappMode,
  ]);

  return {
    showAccountSelector,
    activeAccount,
  };
}

export function useMockAccountSelectorLoading(duration = 500) {
  const [isLoading, setIsLoading] = useState(true);
  useEffect(() => {
    setTimeout(() => {
      setIsLoading(false);
    }, duration);
  }, [duration]);
  return {
    isLoading,
  };
}
