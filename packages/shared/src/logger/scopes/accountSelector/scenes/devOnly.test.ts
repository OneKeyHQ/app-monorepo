import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { AccountSelectorAutoSelectScene } from './autoSelect';
import { AccountSelectorListDataScene } from './listData';
import { AccountSelectorPerfScene } from './perf';
import { AccountSelectorRenderScene } from './render';
import { AccountSelectorStorageScene } from './storage';

describe('account selector development-only logger scenes', () => {
  it('does not emit performance or storage logs in production', () => {
    const previousNodeEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';
    try {
      const perfScene = new AccountSelectorPerfScene();
      const storageScene = new AccountSelectorStorageScene();
      const autoSelectScene = new AccountSelectorAutoSelectScene();
      const listDataScene = new AccountSelectorListDataScene();
      const renderScene = new AccountSelectorRenderScene();
      const perfEmit = jest.spyOn(perfScene, '_emitLog');
      const storageEmit = jest.spyOn(storageScene, '_emitLog');
      const autoSelectEmit = jest.spyOn(autoSelectScene, '_emitLog');
      const listDataEmit = jest.spyOn(listDataScene, '_emitLog');
      const renderEmit = jest.spyOn(renderScene, '_emitLog');

      perfScene.trace('selectionStateUpdated', { num: 0, transitionId: 1 });
      perfScene.renderAccountSelectorModal({
        num: 0,
        sceneName: 'home',
      });
      storageScene.updateSelectedAccount({
        newSelectedAccount: { networkId: 'evm--1' },
        num: 0,
        oldSelectedAccount: { networkId: 'btc--0' },
        sceneName: 'home',
        sceneUrl: undefined,
      });
      autoSelectScene.currentSelectedAccount({
        selectedAccount: { walletId: 'wallet-id' },
      });
      listDataScene.focusedWalletMissing({ focusedWallet: 'wallet-id' });
      renderScene.selectAccount({
        accountId: 'account-id',
        networkId: 'network-id',
        walletId: 'wallet-id',
      });

      expect(perfEmit).not.toHaveBeenCalled();
      expect(storageEmit).not.toHaveBeenCalled();
      expect(autoSelectEmit).not.toHaveBeenCalled();
      expect(listDataEmit).not.toHaveBeenCalled();
      expect(renderEmit).not.toHaveBeenCalled();
    } finally {
      process.env.NODE_ENV = previousNodeEnv;
    }
  });

  it('formats performance traces as one structured record', () => {
    const perfScene = new AccountSelectorPerfScene();

    expect(
      perfScene.trace('selectionStateUpdated', { num: 0, transitionId: 1 }),
    ).toEqual([
      {
        event: 'selectionStateUpdated',
        num: 0,
        runtimeRole: platformEnv.runtimeRole,
        transitionId: 1,
      },
    ]);
  });
});
