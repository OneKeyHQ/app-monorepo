import { useCallback } from 'react';

import { EAccountSelectorSceneName } from '@onekeyhq/shared/types';

import useAppNavigation from '../../../hooks/useAppNavigation';
import {
  useAccountSelectorActions,
  useAccountSelectorSceneInfo,
  useActiveAccount,
} from '../../../states/jotai/contexts/accountSelector';

import { useAccountSelectorAvailableNetworks } from './useAccountSelectorAvailableNetworks';

export function useNetworkSelectorTrigger({ num }: { num: number }) {
  const { activeAccount } = useActiveAccount({ num });
  const actions = useAccountSelectorActions();
  const { sceneName, sceneUrl } = useAccountSelectorSceneInfo();
  const { networkIds, defaultNetworkId } = useAccountSelectorAvailableNetworks({
    num,
  });

  const navigation = useAppNavigation();

  const showChainSelector = useCallback(() => {
    actions.current.showChainSelector({
      navigation,
      num,
      sceneName,
      sceneUrl,
      networkIds,
      defaultNetworkId,
      editable:
        sceneName === EAccountSelectorSceneName.home ||
        sceneName === EAccountSelectorSceneName.homeUrlAccount,
    });
  }, [
    actions,
    defaultNetworkId,
    networkIds,
    navigation,
    num,
    sceneName,
    sceneUrl,
  ]);

  return {
    activeAccount,
    networkIds,
    showChainSelector,
  };
}
