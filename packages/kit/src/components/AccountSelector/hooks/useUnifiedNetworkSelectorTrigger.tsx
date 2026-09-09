import { useCallback } from 'react';

import type { IUnifiedNetworkSelectorRouteParams } from '@onekeyhq/shared/src/routes';
import { EAccountSelectorSceneName } from '@onekeyhq/shared/types';

import useAppNavigation from '../../../hooks/useAppNavigation';
import {
  useAccountSelectorSceneInfo,
  useActiveAccount,
} from '../../../states/jotai/contexts/accountSelector';
import { useAccountSelectorLazyAction } from '../../../states/jotai/contexts/accountSelector/actionsLazy';

import { useAccountSelectorAvailableNetworks } from './useAccountSelectorAvailableNetworks';

export function useUnifiedNetworkSelectorTrigger({ num }: { num: number }) {
  const { activeAccount } = useActiveAccount({ num });
  const runAccountSelectorAction = useAccountSelectorLazyAction();
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
      void runAccountSelectorAction('showUnifiedNetworkSelector', {
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
    showUnifiedNetworkSelector,
  };
}
