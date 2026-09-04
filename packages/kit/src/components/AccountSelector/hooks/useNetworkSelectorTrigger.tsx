import { useCallback } from 'react';

import { EAccountSelectorSceneName } from '@onekeyhq/shared/types';

import useAppNavigation from '../../../hooks/useAppNavigation';
import {
  useAccountSelectorSceneInfo,
  useActiveAccount,
} from '../../../states/jotai/contexts/accountSelector';
import { useAccountSelectorLazyAction } from '../../../states/jotai/contexts/accountSelector/actionsLazy';

import { useAccountSelectorAvailableNetworks } from './useAccountSelectorAvailableNetworks';

export function useNetworkSelectorTrigger({ num }: { num: number }) {
  const { activeAccount } = useActiveAccount({ num });
  const runAccountSelectorAction = useAccountSelectorLazyAction();
  const { sceneName, sceneUrl } = useAccountSelectorSceneInfo();
  const { networkIds, defaultNetworkId } = useAccountSelectorAvailableNetworks({
    num,
  });

  const navigation = useAppNavigation();

  const showChainSelector = useCallback(
    ({
      recordNetworkHistoryEnabled,
    }: { recordNetworkHistoryEnabled?: boolean } = {}) => {
      void runAccountSelectorAction('showChainSelector', {
        navigation,
        num,
        sceneName,
        sceneUrl,
        networkIds,
        defaultNetworkId,
        recordNetworkHistoryEnabled,
        editable:
          sceneName === EAccountSelectorSceneName.home ||
          sceneName === EAccountSelectorSceneName.homeUrlAccount,
      });
    },
    [
      defaultNetworkId,
      networkIds,
      navigation,
      num,
      runAccountSelectorAction,
      sceneName,
      sceneUrl,
    ],
  );

  return {
    activeAccount,
    networkIds,
    showChainSelector,
  };
}
