import { useCallback, useEffect, useState } from 'react';

import type { IAccountSelectorRouteParamsExtraConfig } from '@onekeyhq/shared/src/routes';

import useAppNavigation from '../../../hooks/useAppNavigation';
import { useAccountSelectorLazyAction } from '../../../states/jotai/contexts/accountSelector/actionsLazy';
import {
  useAccountSelectorSceneInfo,
  useActiveAccount,
} from '../../../states/jotai/contexts/accountSelector/atoms';

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
  const callAccountSelectorAction = useAccountSelectorLazyAction();

  const showAccountSelector = useCallback(() => {
    void callAccountSelectorAction('showAccountSelector', {
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
    activeAccount.wallet,
    callAccountSelectorAction,
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
