import type { IAccountSelectorSelectedAccount } from '@onekeyhq/kit-bg/src/dbs/simple/entity/SimpleDbEntityAccountSelector';

import { EAccountSelectorSceneName } from '../../types';
import { NETWORK_ID_ETC } from '../config/networkIds';

import accountUtils from './accountUtils';
import networkUtils from './networkUtils';
import uriUtils from './uriUtils';

function isEqualAccountSelectorScene({
  scene1,
  scene2,
}: {
  scene1: {
    sceneName: EAccountSelectorSceneName;
    sceneUrl?: string;
    num: number;
  };
  scene2: {
    sceneName: EAccountSelectorSceneName;
    sceneUrl?: string;
    num: number;
  };
}): boolean {
  return (
    scene1.sceneName === scene2.sceneName &&
    scene1.num === scene2.num &&
    (scene1.sceneUrl || '') === (scene2.sceneUrl || '')
  );
}

function buildAccountSelectorSceneId({
  sceneName,
  sceneUrl,
}: {
  sceneName: EAccountSelectorSceneName;
  sceneUrl?: string;
}): string {
  if (sceneName === EAccountSelectorSceneName.discover) {
    if (!sceneUrl) {
      throw new Error('buildSceneId ERROR: sceneUrl is required');
    }
    const origin = uriUtils.getOriginFromUrl({ url: sceneUrl });
    if (origin !== sceneUrl) {
      throw new Error(
        'buildSceneId ERROR: sceneUrl should be equal to origin, full url is not allowed',
      );
    }
    return `${sceneName}--${origin}`;
  }

  if (!sceneName) {
    throw new Error('buildSceneId ERROR: sceneName is required');
  }
  return sceneName;
}

function buildAccountSelectorSaveKey({
  sceneName,
  sceneUrl,
  num,
}: {
  sceneName: EAccountSelectorSceneName;
  sceneUrl?: string;
  num: number;
}) {
  return `${sceneName}--${sceneUrl || ''}--${num.toString()}`;
}

function buildMergedSelectedAccount({
  data,
  mergedByData,
}: {
  data: IAccountSelectorSelectedAccount | undefined;
  mergedByData: IAccountSelectorSelectedAccount;
}): IAccountSelectorSelectedAccount {
  const result: IAccountSelectorSelectedAccount = {
    ...mergedByData,
    ...data,
    walletId: mergedByData.walletId,
    indexedAccountId: mergedByData.indexedAccountId,
    othersWalletAccountId: mergedByData.othersWalletAccountId,
    focusedWallet: mergedByData.focusedWallet,
  };

  if (
    mergedByData.walletId &&
    accountUtils.isOthersWallet({ walletId: mergedByData.walletId })
  ) {
    if (
      networkUtils.getNetworkImpl({
        networkId: result.networkId || '',
      }) !==
      networkUtils.getNetworkImpl({
        networkId: mergedByData.networkId || '',
      })
    ) {
      result.networkId = mergedByData.networkId;
      result.deriveType = mergedByData.deriveType;
    }
  }

  return result;
}

function buildGlobalDeriveTypesMapKey({ networkId }: { networkId: string }) {
  const impl = networkUtils.getNetworkImpl({
    networkId,
  });
  const useNetworkId = [NETWORK_ID_ETC].includes(networkId);
  const key = useNetworkId ? networkId : impl;
  return key;
}

export default {
  isEqualAccountSelectorScene,
  buildAccountSelectorSaveKey,
  buildAccountSelectorSceneId,
  buildMergedSelectedAccount,
  buildGlobalDeriveTypesMapKey,
};
