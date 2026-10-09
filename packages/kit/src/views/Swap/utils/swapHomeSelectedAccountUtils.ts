import { EJotaiContextStoreNames } from '@onekeyhq/kit-bg/src/states/jotai/atoms';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import {
  accountSelectorUpdateMetaAtom,
  selectedAccountsAtom,
} from '../../../states/jotai/contexts/accountSelector';
import { jotaiContextStore } from '../../../states/jotai/utils/jotaiContextStore';

import { SWAP_COLD_START_HOME_SCENE_NAME } from './swapColdStartTokenCacheUtils';

function getHomeSelectedAccountInfoFromContextStore() {
  const homeAccountSelectorStore = jotaiContextStore.getStore({
    storeName: EJotaiContextStoreNames.accountSelector,
    accountSelectorInfo: {
      sceneName: SWAP_COLD_START_HOME_SCENE_NAME,
      sceneUrl: '',
      enabledNum: [0],
    },
  });
  const selectedAccount = homeAccountSelectorStore?.get(
    selectedAccountsAtom(),
  )?.[0];
  if (!selectedAccount) {
    return undefined;
  }
  const updateMeta = homeAccountSelectorStore?.get(
    accountSelectorUpdateMetaAtom(),
  )?.[0];
  return {
    selectedAccount,
    // The home scene's committed revision for this selection - the same value
    // its change events broadcast as `selectedAccountUpdatedAt` - so a read
    // taken here stays comparable with those events in the compare-if-newer
    // gate. Undefined when the home slot holds an unversioned value.
    selectedAccountUpdatedAt: updateMeta?.updatedAt,
    sourceRuntimeId: updateMeta?.sourceRuntimeId,
  };
}

export async function getLatestHomeSelectedAccountInfo() {
  const homeSelectedAccountInfoFromStore =
    getHomeSelectedAccountInfoFromContextStore();
  if (homeSelectedAccountInfoFromStore) {
    return homeSelectedAccountInfoFromStore;
  }

  const selectedAccount =
    await backgroundApiProxy.simpleDb.accountSelector.getSelectedAccount({
      sceneName: SWAP_COLD_START_HOME_SCENE_NAME,
      num: 0,
    });
  // simpleDb persists no selection revision, so a snapshot read this way
  // carries no ordering information.
  return {
    selectedAccount,
    selectedAccountUpdatedAt: undefined,
    sourceRuntimeId: undefined,
  };
}

export async function getLatestHomeSelectedAccount() {
  return (await getLatestHomeSelectedAccountInfo()).selectedAccount;
}
