import { useCallback } from 'react';

import useAppNavigation from '../../../hooks/useAppNavigation';
import {
  useAccountSelectorActions,
  useAccountSelectorSceneInfo,
  useActiveAccount,
} from '../../../states/jotai/contexts/accountSelector';

import { useNetworkAutoSelect } from './useNetworkAutoSelect';

export function useNetworkSelectorTrigger({ num }: { num: number }) {
  const { activeAccount, activeAccountName } = useActiveAccount({ num });
  const actions = useAccountSelectorActions();
  const { sceneName, sceneUrl, networks, defaultNetworkId } =
    useAccountSelectorSceneInfo();

  useNetworkAutoSelect({ num });

  const navigation = useAppNavigation();

  const showChainSelector = useCallback(() => {
    actions.current.showChainSelector({
      navigation,
      num,
      sceneName,
      sceneUrl,
      networks,
      defaultNetworkId,
    });
  }, [
    actions,
    defaultNetworkId,
    navigation,
    networks,
    num,
    sceneName,
    sceneUrl,
  ]);

  return {
    activeAccount,
    activeAccountName,
    showChainSelector,
  };
}
