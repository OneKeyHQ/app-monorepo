import accountSelectorUtils from '@onekeyhq/shared/src/utils/accountSelectorUtils';
import { EAccountSelectorSceneName } from '@onekeyhq/shared/types';

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
