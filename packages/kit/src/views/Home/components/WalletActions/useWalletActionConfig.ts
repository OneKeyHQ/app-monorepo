import { useMemo } from 'react';

import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import { useActiveAccount } from '@onekeyhq/kit/src/states/jotai/contexts/accountSelector';

import {
  defaultWalletActionsConfig,
  detailedNetworkConfigs,
  userCustomConfigs,
} from './networkConfigs';

import type {
  IActionCustomization,
  IMoreActionGroup,
  INetworkWalletActionsConfig,
  IWalletActionType,
} from './types';

export function useWalletActionConfig() {
  const {
    activeAccount: { network },
  } = useActiveAccount({ num: 0 });

  const vaultSettings = usePromiseResult(async () => {
    if (!network?.id) return null;
    const settings = await backgroundApiProxy.serviceNetwork.getVaultSettings({
      networkId: network.id,
    });
    return settings;
  }, [network?.id]);

  const config = useMemo((): INetworkWalletActionsConfig => {
    if (!network?.id) return defaultWalletActionsConfig;

    const networkSpecificConfig = detailedNetworkConfigs[network.id] || {};
    const userCustomConfig = userCustomConfigs[network.id] || {};

    const mergedConfig: INetworkWalletActionsConfig = {
      ...defaultWalletActionsConfig,
      ...networkSpecificConfig,
      ...userCustomConfig,
    };

    if (vaultSettings.result) {
      const { result: settings } = vaultSettings;

      const filterDisabledActions = (
        actions: IWalletActionType[],
      ): IWalletActionType[] => {
        return actions.filter((action) => {
          switch (action) {
            case 'send':
              return !settings.disabledSendAction;
            case 'swap':
              return !settings.disabledSwapAction;
            default:
              return true;
          }
        });
      };

      mergedConfig.mainActions = filterDisabledActions(
        mergedConfig.mainActions,
      );
      mergedConfig.moreActions = filterDisabledActions(
        mergedConfig.moreActions,
      );
    }

    return mergedConfig;
  }, [network?.id, vaultSettings]);

  const isActionEnabled = (actionType: IWalletActionType): boolean => {
    return [...config.mainActions, ...config.moreActions].includes(actionType);
  };

  const getActionCustomization = (
    actionType: IWalletActionType,
  ): IActionCustomization | undefined => {
    return config.actionCustomization?.[actionType];
  };

  const getMoreActionGroups = (): IMoreActionGroup[] => {
    const groups = config.moreActionGroups || [];

    const allGroups: IMoreActionGroup[] = [...groups];

    const groupedActions = new Set(groups.flatMap((group) => group.actions));
    const ungroupedActions = config.moreActions.filter(
      (action) => !groupedActions.has(action),
    );

    if (ungroupedActions.length > 0) {
      allGroups.push({
        type: 'others',
        actions: ungroupedActions,
        order: groups.length + 1,
      });
    }

    return allGroups.sort((a, b) => a.order - b.order);
  };

  return {
    config,
    isActionEnabled,
    getActionCustomization,
    getMoreActionGroups,
    vaultSettings: vaultSettings.result,
  };
}
