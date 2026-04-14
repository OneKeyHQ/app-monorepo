import { WALLET_TYPE_HD } from '@onekeyhq/shared/src/consts/dbConsts';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';

import { CloudSyncFlowManagerWallet } from './CloudSyncFlowManagerWallet';

describe('CloudSyncFlowManagerWallet', () => {
  const setWalletNameAndAvatar = jest.fn(async () => undefined);
  const manager = new CloudSyncFlowManagerWallet({
    backgroundApi: {
      serviceAccount: {
        setWalletNameAndAvatar,
      },
    } as any,
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('isSupportSync excludes bot wallets', async () => {
    await expect(
      manager.isSupportSync({
        wallet: {
          id: 'hd-1',
        },
      } as any),
    ).resolves.toBe(true);

    await expect(
      manager.isSupportSync({
        wallet: {
          id: accountUtils.buildBotWalletId({
            parentKeylessWalletId: 'hd-keyless-parent',
            index: 2,
          }),
        },
      } as any),
    ).resolves.toBe(false);
  });

  test('buildSyncPayload only includes wallet payload fields', async () => {
    const payload = await manager.buildSyncPayload({
      target: {
        wallet: {
          id: 'hd-keyless-parent',
          name: 'Keyless',
          avatarInfo: undefined,
          hash: 'wallet-hash',
          type: WALLET_TYPE_HD,
          passphraseState: '',
        },
        dbDevice: undefined,
      } as any,
    });

    expect(payload).toEqual({
      name: 'Keyless',
      avatar: undefined,
      walletHash: 'wallet-hash',
      hwDeviceId: undefined,
      passphraseState: '',
      walletType: WALLET_TYPE_HD,
    });
    expect(payload).not.toHaveProperty('botWallets');
  });

  test('syncToSceneEachItem only updates wallet metadata', async () => {
    await expect(
      manager.syncToSceneEachItem({
        target: {
          wallet: {
            id: 'hd-parent',
          },
        } as any,
        payload: {
          name: 'Synced Wallet',
          avatar: undefined,
          walletHash: 'wallet-hash',
          hwDeviceId: undefined,
          passphraseState: '',
          walletType: WALLET_TYPE_HD,
        },
      }),
    ).resolves.toBe(true);

    expect(setWalletNameAndAvatar).toHaveBeenCalledWith({
      walletId: 'hd-parent',
      name: 'Synced Wallet',
      avatar: undefined,
      skipSaveLocalSyncItem: true,
      skipEmitEvent: true,
    });
  });
});
