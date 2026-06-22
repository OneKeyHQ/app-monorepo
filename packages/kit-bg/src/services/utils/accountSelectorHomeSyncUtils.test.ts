import { EAccountSelectorSceneName } from '@onekeyhq/shared/types';

import {
  isAccountSelectorHomeSyncSourceScene,
  isAccountSelectorHomeSyncTargetScene,
  shouldSyncAccountSelectorHomeAndSwapScenes,
} from './accountSelectorHomeSyncUtils';

describe('accountSelectorHomeSyncUtils', () => {
  it('treats only home num0 and swap num0 as home-sync sources', () => {
    expect(
      isAccountSelectorHomeSyncSourceScene({
        sceneName: EAccountSelectorSceneName.home,
        num: 0,
      }),
    ).toBe(true);
    expect(
      isAccountSelectorHomeSyncSourceScene({
        sceneName: EAccountSelectorSceneName.swap,
        num: 0,
      }),
    ).toBe(true);
    expect(
      isAccountSelectorHomeSyncSourceScene({
        sceneName: EAccountSelectorSceneName.swap,
        num: 1,
      }),
    ).toBe(false);
  });

  it('allows swap num1 as a target only when receive account follows home', () => {
    expect(
      isAccountSelectorHomeSyncTargetScene({
        scene: {
          sceneName: EAccountSelectorSceneName.swap,
          num: 1,
        },
        swapToAnotherAccountSwitchOn: false,
      }),
    ).toBe(true);
    expect(
      isAccountSelectorHomeSyncTargetScene({
        scene: {
          sceneName: EAccountSelectorSceneName.swap,
          num: 1,
        },
        swapToAnotherAccountSwitchOn: true,
      }),
    ).toBe(false);
  });

  it('does not let swap num1 sync back to home or swap num0', () => {
    expect(
      shouldSyncAccountSelectorHomeAndSwapScenes({
        sourceScene: {
          sceneName: EAccountSelectorSceneName.swap,
          num: 1,
        },
        targetScene: {
          sceneName: EAccountSelectorSceneName.swap,
          num: 0,
        },
        swapToAnotherAccountSwitchOn: false,
      }),
    ).toBe(false);
    expect(
      shouldSyncAccountSelectorHomeAndSwapScenes({
        sourceScene: {
          sceneName: EAccountSelectorSceneName.swap,
          num: 1,
        },
        targetScene: {
          sceneName: EAccountSelectorSceneName.home,
          num: 0,
        },
        swapToAnotherAccountSwitchOn: false,
      }),
    ).toBe(false);
  });

  it('keeps home or swap num0 syncing to swap num1', () => {
    expect(
      shouldSyncAccountSelectorHomeAndSwapScenes({
        sourceScene: {
          sceneName: EAccountSelectorSceneName.home,
          num: 0,
        },
        targetScene: {
          sceneName: EAccountSelectorSceneName.swap,
          num: 1,
        },
        swapToAnotherAccountSwitchOn: false,
      }),
    ).toBe(true);
  });
});
