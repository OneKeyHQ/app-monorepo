import { useCallback } from 'react';

import type { IUnifiedNetworkSelectorRouteParams } from '@onekeyhq/shared/src/routes';
import { EAccountSelectorSceneName } from '@onekeyhq/shared/types';

import useAppNavigation from '../../../hooks/useAppNavigation';
import {
  useAccountSelectorActions,
  useAccountSelectorSceneInfo,
  useActiveAccount,
} from '../../../states/jotai/contexts/accountSelector';

import { useAccountSelectorAvailableNetworks } from './useAccountSelectorAvailableNetworks';

export function useUnifiedNetworkSelectorTrigger({ num }: { num: number }) {
  const { activeAccount } = useActiveAccount({ num });
  const actions = useAccountSelectorActions();
  const { sceneName, sceneUrl } = useAccountSelectorSceneInfo();
  const { networkIds, defaultNetworkId } = useAccountSelectorAvailableNetworks({
    num,
  });

  const navigation = useAppNavigation();

  const showUnifiedNetworkSelector = useCallback(
    ({
      recordNetworkHistoryEnabled,
      onNetworksChanged,
      defaultTab,
    }: {
      recordNetworkHistoryEnabled?: boolean;
      onNetworksChanged?: () => Promise<void>;
      defaultTab?: IUnifiedNetworkSelectorRouteParams['defaultTab'];
    } = {}) => {
      actions.current.showUnifiedNetworkSelector({
        navigation,
        num,
        sceneName,
        sceneUrl,
        networkIds,
        defaultNetworkId,
        recordNetworkHistoryEnabled,
        onNetworksChanged,
        defaultTab,
        editable:
          sceneName === EAccountSelectorSceneName.home ||
          sceneName === EAccountSelectorSceneName.homeUrlAccount,
      });
    },
    [
      actions,
      defaultNetworkId,
      networkIds,
      navigation,
      num,
      sceneName,
      sceneUrl,
    ],
  );

  return {
    activeAccount,
    networkIds,
    showUnifiedNetworkSelector,
  };
}
