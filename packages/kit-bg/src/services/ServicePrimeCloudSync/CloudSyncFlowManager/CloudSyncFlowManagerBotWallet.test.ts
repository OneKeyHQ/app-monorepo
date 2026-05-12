import { BOT_WALLET_STATUS_ACTIVE } from '@onekeyhq/shared/src/consts/dbConsts';
import { EPrimeCloudSyncDataType } from '@onekeyhq/shared/src/consts/primeConsts';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';

import simpleDb from '../../../dbs/simple/simpleDb';

import { CloudSyncFlowManagerBotWallet } from './CloudSyncFlowManagerBotWallet';

jest.mock('../../../dbs/simple/simpleDb', () => ({
  __esModule: true,
  default: {
    botWallet: {
      getMetadata: jest.fn(),
      setMetadata: jest.fn(),
    },
  },
}));

describe('CloudSyncFlowManagerBotWallet', () => {
  const botWalletDb = simpleDb.botWallet as unknown as {
    getMetadata: jest.Mock;
    setMetadata: jest.Mock;
  };
  const getWalletSafe = jest.fn();
  const createBotWalletFromCloudSync = jest.fn(async () => true);
  const setWalletNameAndAvatar = jest.fn(async () => undefined);
  const manager = new CloudSyncFlowManagerBotWallet({
    backgroundApi: {
      localDb: {
        getWalletSafe,
      },
      serviceAccount: {
        createBotWalletFromCloudSync,
        setWalletNameAndAvatar,
      },
    } as any,
  });

  const walletId = accountUtils.buildBotWalletId({
    parentKeylessWalletId: 'hd-keyless-parent',
    index: 1,
  });
  const payload = {
    walletId,
    parentKeylessWalletId: 'hd-keyless-parent',
    walletHash: 'bot-wallet-hash',
    name: 'Bot #2',
    avatar: undefined,
    index: 1,
    visible: true,
    status: BOT_WALLET_STATUS_ACTIVE,
    deactivatedAt: undefined,
    createdAt: 123,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('buildSyncPayload uses top-level bot wallet payload', async () => {
    const result = await manager.buildSyncPayload({
      target: {
        walletId,
        parentKeylessWalletId: 'hd-keyless-parent',
        metadata: {
          index: 1,
          name: 'Bot #2',
          visible: true,
          status: BOT_WALLET_STATUS_ACTIVE,
          createdAt: 123,
        },
        wallet: {
          id: walletId,
          name: 'Bot #2',
          hash: 'bot-wallet-hash',
          avatarInfo: undefined,
        },
      } as any,
    });

    expect(result).toEqual(payload);
  });

  test('buildSyncTargetByPayload keeps bot wallet creatable when local wallet is missing', async () => {
    getWalletSafe.mockImplementation(async ({ walletId: currentWalletId }) => {
      if (currentWalletId === 'hd-keyless-parent') {
        return {
          id: 'hd-keyless-parent',
          isKeyless: true,
        };
      }
      return undefined;
    });

    const target = await manager.buildSyncTargetByPayload({
      payload,
    });

    expect(target).toMatchObject({
      targetId: walletId,
      walletId,
      parentKeylessWalletId: 'hd-keyless-parent',
      walletHash: 'bot-wallet-hash',
      metadata: {
        index: 1,
        name: 'Bot #2',
        visible: true,
        status: BOT_WALLET_STATUS_ACTIVE,
        createdAt: 123,
      },
      wallet: undefined,
    });
  });

  test('buildSyncKeyAndPayload rebuilds raw key from wallet hash when local wallet is missing', async () => {
    getWalletSafe.mockImplementation(async ({ walletId: currentWalletId }) => {
      if (currentWalletId === 'hd-keyless-parent') {
        return {
          id: 'hd-keyless-parent',
          isKeyless: true,
        };
      }
      return undefined;
    });

    const target = await manager.buildSyncTargetByPayload({
      payload,
    });

    expect(target).toBeTruthy();

    await expect(
      manager.buildSyncKeyAndPayload({
        target: target as any,
      }),
    ).resolves.toMatchObject({
      rawKey: 'BotWallet >> hd:__bot-wallet-hash:',
      dataType: EPrimeCloudSyncDataType.BotWallet,
      payload,
    });
  });

  test('syncToSceneEachItem updates local wallet metadata when wallet exists', async () => {
    await expect(
      manager.syncToSceneEachItem({
        item: {
          isDeleted: false,
        } as any,
        target: {
          wallet: {
            id: walletId,
          },
        } as any,
        payload,
      }),
    ).resolves.toBe(true);

    expect(setWalletNameAndAvatar).toHaveBeenCalledWith({
      walletId,
      name: 'Bot #2',
      avatar: undefined,
      skipSaveLocalSyncItem: true,
      skipEmitEvent: true,
    });
    expect(botWalletDb.setMetadata).toHaveBeenCalledWith(walletId, {
      index: 1,
      name: 'Bot #2',
      visible: true,
      status: BOT_WALLET_STATUS_ACTIVE,
      deactivatedAt: undefined,
      createdAt: 123,
    });
    expect(createBotWalletFromCloudSync).not.toHaveBeenCalled();
  });

  test('isSupportSync rejects orphan target whose localDb wallet was removed', async () => {
    // OK-53558: simulate an orphan bot wallet metadata entry — parent KW
    // still exists but the bot wallet itself has been removed from localDb,
    // so target.walletHash is undefined. isSupportSync must return false to
    // keep the init sync flow from throwing "keyHash is required".
    await expect(
      manager.isSupportSync({
        targetId: walletId,
        dataType: EPrimeCloudSyncDataType.BotWallet,
        walletId,
        parentKeylessWalletId: 'hd-keyless-parent',
        walletHash: undefined,
        metadata: {
          index: 1,
          name: 'Bot #2',
          visible: true,
          status: BOT_WALLET_STATUS_ACTIVE,
          createdAt: 123,
        },
        wallet: undefined,
      } as any),
    ).resolves.toBe(false);
  });

  test('isSupportSync accepts target whose walletHash is preserved by cloud payload', async () => {
    await expect(
      manager.isSupportSync({
        targetId: walletId,
        dataType: EPrimeCloudSyncDataType.BotWallet,
        walletId,
        parentKeylessWalletId: 'hd-keyless-parent',
        walletHash: 'bot-wallet-hash',
        metadata: {
          index: 1,
          name: 'Bot #2',
          visible: true,
          status: BOT_WALLET_STATUS_ACTIVE,
          createdAt: 123,
        },
        wallet: undefined,
      } as any),
    ).resolves.toBe(true);
  });

  test('syncToSceneEachItem creates missing local wallet from cloud payload', async () => {
    await expect(
      manager.syncToSceneEachItem({
        item: {
          isDeleted: false,
        } as any,
        target: {
          wallet: undefined,
        } as any,
        payload,
      }),
    ).resolves.toBe(true);

    expect(createBotWalletFromCloudSync).toHaveBeenCalledWith({
      walletId: payload.walletId,
      parentKeylessWalletId: payload.parentKeylessWalletId,
      index: payload.index,
      name: payload.name,
      avatar: payload.avatar,
      visible: payload.visible,
      status: payload.status,
      deactivatedAt: payload.deactivatedAt,
      createdAt: payload.createdAt,
    });
    expect(setWalletNameAndAvatar).not.toHaveBeenCalled();
  });
});
