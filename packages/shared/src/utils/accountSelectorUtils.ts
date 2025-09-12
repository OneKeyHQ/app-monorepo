import type { IAccountSelectorSelectedAccount } from '@onekeyhq/kit-bg/src/dbs/simple/entity/SimpleDbEntityAccountSelector';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';

import { EAccountSelectorSceneName } from '../../types';

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
      throw new OneKeyLocalError('buildSceneId ERROR: sceneUrl is required');
    }
    const origin = uriUtils.getOriginFromUrl({ url: sceneUrl });
    if (origin !== sceneUrl) {
      throw new OneKeyLocalError(
        `buildSceneId ERROR: sceneUrl should be equal to origin, full url is not allowed: ${sceneUrl}`,
      );
    }
    return `${sceneName}--${origin}`;
  }

  if (!sceneName) {
    throw new OneKeyLocalError('buildSceneId ERROR: sceneName is required');
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
      // TODO why should change networkId and driveType? check new network compatibility?
      // - swap from ETH token to BTC token, select EVM privateKey account, should not change home network and swapFrom network
      // ----------------------------------------------
      // result.networkId = mergedByData.networkId;
      // result.deriveType = mergedByData.deriveType;
    }
  }

  return result;
}

function buildGlobalDeriveTypesMapKey({ networkId }: { networkId: string }) {
  const impl = networkUtils.getNetworkImpl({
    networkId,
  });
  return impl;
  // const useNetworkId = [NETWORK_ID_ETC].includes(networkId);
  // const key = useNetworkId ? networkId : impl;
  // return key;
}

function isSceneCanPersist({
  sceneName,
}: {
  sceneName: EAccountSelectorSceneName | undefined;
}): boolean {
  if (
    sceneName &&
    [
      EAccountSelectorSceneName.discover,
      EAccountSelectorSceneName.addressInput,
    ].includes(sceneName)
  ) {
    return false;
  }
  return true;
}

function isSceneCanAutoSelect({
  sceneName,
}: {
  sceneName: EAccountSelectorSceneName | undefined;
}): boolean {
  if (
    sceneName &&
    [EAccountSelectorSceneName.addressInput].includes(sceneName)
  ) {
    return false;
  }
  return true;
}

// In the discover page scene, BTC can select a different derive type from the global derive type
function isSceneUseGlobalDeriveType({
  sceneName,
}: {
  sceneName: EAccountSelectorSceneName | undefined;
}): boolean {
  if (sceneName && [EAccountSelectorSceneName.discover].includes(sceneName)) {
    return false;
  }
  return true;
}

function isSceneAutoSaveToGlobalDeriveType({
  sceneName,
}: {
  sceneName: EAccountSelectorSceneName | undefined;
}) {
  if (
    sceneName &&
    [
      EAccountSelectorSceneName.discover,
      EAccountSelectorSceneName.addressInput,
    ].includes(sceneName)
  ) {
    return false;
  }
  return true;
}

export default {
  isEqualAccountSelectorScene,
  buildAccountSelectorSaveKey,
  buildAccountSelectorSceneId,
  buildMergedSelectedAccount,
  buildGlobalDeriveTypesMapKey,
  isSceneCanAutoSelect,
  isSceneCanPersist,
  isSceneUseGlobalDeriveType,
  isSceneAutoSaveToGlobalDeriveType,
};
