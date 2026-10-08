import accountSelectorUtils from '@onekeyhq/shared/src/utils/accountSelectorUtils';
import { EAccountSelectorSceneName } from '@onekeyhq/shared/types';

import {
  fixOthersWalletAccountNetworkPair,
  isAccountSelectorHomeSyncSourceScene,
  isAccountSelectorHomeSyncTargetScene,
  shouldSyncAccountSelectorHomeAndSwapScenes,
} from './accountSelectorHomeSyncUtils';

import type { IBackgroundApi } from '../../apis/IBackgroundApi';
import type { IAccountSelectorSelectedAccount } from '../../dbs/simple/entity/SimpleDbEntityAccountSelector';

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

describe('fixOthersWalletAccountNetworkPair', () => {
  function buildSelection(
    overrides: Partial<IAccountSelectorSelectedAccount>,
  ): IAccountSelectorSelectedAccount {
    return {
      walletId: 'hd-1',
      indexedAccountId: 'hd-1--0',
      othersWalletAccountId: undefined,
      networkId: 'evm--1',
      deriveType: 'default',
      focusedWallet: 'hd-1',
      ...overrides,
    };
  }

  function buildBackgroundApi() {
    const getDBAccount = jest.fn();
    const backgroundApi = {
      serviceAccount: { getDBAccount },
    } as unknown as IBackgroundApi;
    return { backgroundApi, getDBAccount };
  }

  // The UI skips the request for these; that is only sound if the background
  // would have handed the same selection back without looking anything up.
  it.each([
    ['an HD account', buildSelection({})],
    [
      'a hardware account',
      buildSelection({ walletId: 'hw-abc', indexedAccountId: 'hw-abc--0' }),
    ],
    [
      'a QR account',
      buildSelection({ walletId: 'qr-abc', indexedAccountId: 'qr-abc--0' }),
    ],
    [
      'an others-wallet account on all networks',
      buildSelection({
        walletId: 'watching',
        indexedAccountId: undefined,
        othersWalletAccountId: 'watching--evm--0x1',
        networkId: 'onekeyall--0',
      }),
    ],
    [
      'an others wallet without a chosen account',
      buildSelection({ walletId: 'imported', indexedAccountId: undefined }),
    ],
    ['a selection without a network', buildSelection({ networkId: undefined })],
    ['a selection without a wallet', buildSelection({ walletId: undefined })],
  ])(
    'returns %s untouched without a lookup',
    async (_name, selectedAccount) => {
      const { backgroundApi, getDBAccount } = buildBackgroundApi();

      expect(
        accountSelectorUtils.hasOthersWalletAccountNetworkPair({
          selectedAccount,
        }),
      ).toBe(false);
      await expect(
        fixOthersWalletAccountNetworkPair({ backgroundApi, selectedAccount }),
      ).resolves.toBe(selectedAccount);
      expect(getDBAccount).not.toHaveBeenCalled();
    },
  );

  it('still looks the account up for an others-wallet account on a concrete network', async () => {
    const { backgroundApi, getDBAccount } = buildBackgroundApi();
    getDBAccount.mockResolvedValue(undefined);
    const selectedAccount = buildSelection({
      walletId: 'watching',
      indexedAccountId: undefined,
      othersWalletAccountId: 'watching--evm--0x1',
    });

    expect(
      accountSelectorUtils.hasOthersWalletAccountNetworkPair({
        selectedAccount,
      }),
    ).toBe(true);
    await fixOthersWalletAccountNetworkPair({ backgroundApi, selectedAccount });

    expect(getDBAccount).toHaveBeenCalledWith({
      accountId: 'watching--evm--0x1',
    });
  });
});
