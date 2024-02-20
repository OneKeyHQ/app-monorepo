import { useCallback } from 'react';

import useAppNavigation from '../../../hooks/useAppNavigation';
import {
  useAccountSelectorActions,
  useAccountSelectorSceneInfo,
  useActiveAccount,
} from '../../../states/jotai/contexts/accountSelector';

export function useAccountSelectorTrigger({ num }: { num: number }) {
  const navigation = useAppNavigation();
  const { activeAccount } = useActiveAccount({ num });
  const { sceneName, sceneUrl } = useAccountSelectorSceneInfo();
  const actions = useAccountSelectorActions();

  const showAccountSelector = useCallback(() => {
    actions.current.showAccountSelector({
      activeWallet: activeAccount.wallet,
      num,
      navigation,
      sceneName,
      sceneUrl,
      linkNetwork: true,
    });
  }, [actions, navigation, num, sceneName, sceneUrl, activeAccount?.wallet]);

  return {
    showAccountSelector,
    activeAccount,
  };
}
