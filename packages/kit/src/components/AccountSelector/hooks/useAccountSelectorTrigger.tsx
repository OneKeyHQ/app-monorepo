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
  ...others
}: {
  num: number;
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
      ...others,
    });
  }, [
    actions,
    activeAccount.wallet,
    others,
    navigation,
    num,
    sceneName,
    sceneUrl,
  ]);

  return {
    showAccountSelector,
    activeAccount,
  };
}

export function useMockAccountSelectorLoading() {
  const [isLoading, setIsLoading] = useState(true);
  useEffect(() => {
    setTimeout(() => {
      setIsLoading(false);
    }, 300);
  }, []);
  return {
    isLoading,
  };
}
