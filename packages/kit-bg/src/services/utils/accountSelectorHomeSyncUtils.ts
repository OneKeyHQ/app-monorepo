// This module is loaded ONLY via dynamic import from ServiceAccountSelector:
// home/swap selector sync logic runs on selector interactions, and keeping it
// behind a lazy segment keeps it out of the native background startup graph
// (Startup Graph Budget CI check). Do not add static imports of this module.
import { cloneDeep } from 'lodash';

import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import accountSelectorUtils from '@onekeyhq/shared/src/utils/accountSelectorUtils';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import networkUtils from '@onekeyhq/shared/src/utils/networkUtils';
import { EAccountSelectorSceneName } from '@onekeyhq/shared/types';

import { settingsAtom } from '../../states/jotai/atoms';

import type { IBackgroundApi } from '../../apis/IBackgroundApi';
import type { IDBAccount } from '../../dbs/local/types';
import type {
  IAccountSelectorSelectedAccount,
  IAccountSelectorSelectedAccountsMap,
} from '../../dbs/simple/entity/SimpleDbEntityAccountSelector';

type IAccountSelectorHomeSyncScene = {
  sceneName: EAccountSelectorSceneName;
  sceneUrl?: string;
  num: number;
};

const HOME_SYNC_SOURCE_SCENES: IAccountSelectorHomeSyncScene[] = [
  {
    sceneName: EAccountSelectorSceneName.home,
    num: 0,
  },
  {
    sceneName: EAccountSelectorSceneName.swap,
    num: 0,
  },
];

const isSceneMatched = (
  scene: IAccountSelectorHomeSyncScene,
  scenes: IAccountSelectorHomeSyncScene[],
) =>
  scenes.some((item) =>
    accountSelectorUtils.isEqualAccountSelectorScene({
      scene1: item,
      scene2: scene,
    }),
  );

export function isAccountSelectorHomeSyncSourceScene(
  scene: IAccountSelectorHomeSyncScene,
) {
  return isSceneMatched(scene, HOME_SYNC_SOURCE_SCENES);
}

export function isAccountSelectorHomeSyncTargetScene({
  scene,
  swapToAnotherAccountSwitchOn,
}: {
  scene: IAccountSelectorHomeSyncScene;
  swapToAnotherAccountSwitchOn: boolean;
}) {
  const targetScenes = [...HOME_SYNC_SOURCE_SCENES];
  if (!swapToAnotherAccountSwitchOn) {
    targetScenes.push({
      sceneName: EAccountSelectorSceneName.swap,
      num: 1,
    });
  }

  return isSceneMatched(scene, targetScenes);
}

export function shouldSyncAccountSelectorHomeAndSwapScenes({
  sourceScene,
  targetScene,
  swapToAnotherAccountSwitchOn,
}: {
  sourceScene: IAccountSelectorHomeSyncScene;
  targetScene: IAccountSelectorHomeSyncScene;
  swapToAnotherAccountSwitchOn: boolean;
}) {
  return (
    isAccountSelectorHomeSyncSourceScene(sourceScene) &&
    isAccountSelectorHomeSyncTargetScene({
      scene: targetScene,
      swapToAnotherAccountSwitchOn,
    })
  );
}

export async function fixOthersWalletAccountNetworkPair({
  backgroundApi,
  selectedAccount,
  source,
}: {
  backgroundApi: IBackgroundApi;
  selectedAccount: IAccountSelectorSelectedAccount;
  source?: string;
}): Promise<IAccountSelectorSelectedAccount> {
  const { walletId, networkId, othersWalletAccountId } = selectedAccount;
  if (
    !walletId ||
    !networkId ||
    !othersWalletAccountId ||
    !accountUtils.isOthersWallet({ walletId }) ||
    networkUtils.isAllNetwork({ networkId })
  ) {
    return selectedAccount;
  }

  let dbAccount: IDBAccount | undefined;
  try {
    dbAccount = await backgroundApi.serviceAccount.getDBAccount({
      accountId: othersWalletAccountId,
    });
  } catch {
    return selectedAccount;
  }

  if (!dbAccount) {
    return selectedAccount;
  }

  try {
    if (
      accountUtils.isAccountCompatibleWithNetwork({
        account: dbAccount,
        networkId,
      })
    ) {
      return selectedAccount;
    }
  } catch {
    // Fall through to compatible-network resolution below.
  }

  let fixedNetworkId: string | undefined;
  try {
    fixedNetworkId = accountUtils.getAccountCompatibleNetwork({
      account: dbAccount,
      networkId,
    });
  } catch {
    return selectedAccount;
  }

  if (!fixedNetworkId || fixedNetworkId === networkId) {
    return selectedAccount;
  }

  defaultLogger.accountSelector.listData.fixOthersWalletAccountNetworkPair({
    source,
    walletId,
    networkId,
    fixedNetworkId,
    accountImpl: dbAccount.impl,
    accountCreateAtNetwork: dbAccount.createAtNetwork,
    accountNetworksCount: dbAccount.networks?.length,
  });

  return {
    ...selectedAccount,
    networkId: fixedNetworkId,
    deriveType: selectedAccount.deriveType || 'default',
  };
}

export async function mergeHomeDataToSwapMap({
  backgroundApi,
  swapMap,
}: {
  backgroundApi: IBackgroundApi;
  swapMap: IAccountSelectorSelectedAccountsMap | undefined;
}) {
  const homeData: IAccountSelectorSelectedAccount | undefined =
    await backgroundApi.simpleDb.accountSelector.getSelectedAccount({
      sceneName: EAccountSelectorSceneName.home,
      num: 0,
    });
  if (homeData) {
    const fixedHomeData = await fixOthersWalletAccountNetworkPair({
      backgroundApi,
      selectedAccount: homeData,
      source: 'mergeHomeDataToSwapMap:home',
    });
    // eslint-disable-next-line no-param-reassign
    swapMap = cloneDeep(swapMap || {});

    const updateSwapMap = async (num: number) => {
      if (!swapMap) {
        return;
      }
      const swapDataMerged = accountSelectorUtils.buildMergedSelectedAccount({
        data: swapMap[num],
        mergedByData: fixedHomeData,
      });
      if (swapDataMerged) {
        const usedNetworkId =
          // swapDataMerged.networkId ??
          // swapMap[num]?.networkId ??
          fixedHomeData?.networkId;
        const fixedSwapDataMerged = await fixOthersWalletAccountNetworkPair({
          backgroundApi,
          selectedAccount: {
            ...swapDataMerged,
            networkId: usedNetworkId,
          },
          source: `mergeHomeDataToSwapMap:${num}`,
        });
        swapMap[num] = fixedSwapDataMerged;
      }
    };

    await updateSwapMap(0);

    const { swapToAnotherAccountSwitchOn } = await settingsAtom.get();
    if (!swapToAnotherAccountSwitchOn) {
      await updateSwapMap(1);
    }
  }
  return swapMap;
}
