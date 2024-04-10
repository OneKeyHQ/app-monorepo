import { useCallback, useEffect, useState } from 'react';

import useAppNavigation from '../../../hooks/useAppNavigation';
import {
  useAccountSelectorActions,
  useAccountSelectorSceneInfo,
  useActiveAccount,
} from '../../../states/jotai/contexts/accountSelector';

export function useAccountSelectorTrigger({
  num,
  linkNetwork,
}: {
  num: number;
  linkNetwork?: boolean;
}) {
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
      linkNetwork,
    });
  }, [
    actions,
    activeAccount.wallet,
    linkNetwork,
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
