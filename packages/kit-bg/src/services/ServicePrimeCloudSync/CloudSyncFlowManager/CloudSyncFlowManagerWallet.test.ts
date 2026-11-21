import { EDeviceType } from '@onekeyfe/hd-shared';

import {
  DEV_UNKNOWN_AVATAR_DEVICE_ID,
  WALLET_TYPE_HD,
  WALLET_TYPE_QR,
} from '@onekeyhq/shared/src/consts/dbConsts';
import { EPrimeCloudSyncDataType } from '@onekeyhq/shared/src/consts/primeConsts';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import {
  EChangeHistoryContentType,
  EChangeHistoryEntityType,
} from '@onekeyhq/shared/src/types/changeHistory';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import type {
  ICloudSyncPayloadWallet,
  ICloudSyncTargetWallet,
} from '@onekeyhq/shared/types/prime/primeCloudSyncTypes';

import { SimpleDbEntityChangeHistory } from '../../../dbs/simple/entity/SimpleDbEntityChangeHistory';
import cloudSyncItemBuilder from '../cloudSyncItemBuilder';

import { CloudSyncFlowManagerWallet } from './CloudSyncFlowManagerWallet';

import type { IBackgroundApi } from '../../../apis/IBackgroundApi';
import type {
  IDBCloudSyncItem,
  IDBDevice,
  IDBWallet,
} from '../../../dbs/local/types';

describe('CloudSyncFlowManagerWallet', () => {
  const qaDevice: IDBDevice = {
    id: 'qa-device',
    name: 'QA device',
    deviceId: DEV_UNKNOWN_AVATAR_DEVICE_ID,
    deviceType: EDeviceType.Pro,
    connectId: '',
    uuid: '',
    features: '',
    settingsRaw: '',
    createdAt: 1,
    updatedAt: 1,
  };
  const qaTarget: ICloudSyncTargetWallet = {
    targetId: 'qr-qa-fixture',
    dataType: EPrimeCloudSyncDataType.Wallet,
    wallet: {
      id: 'qr-qa-fixture',
      name: 'Renamed QA fixture',
      avatarInfo: { img: EDeviceType.Unknown },
      type: WALLET_TYPE_QR,
      backuped: true,
      associatedDevice: qaDevice.id,
      isMocked: true,
      accounts: [],
      nextIds: {},
      walletNo: 99,
    },
    dbDevice: qaDevice,
  };
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

  test('reserved QA device never creates sync records, even after renaming', async () => {
    const target = qaTarget;
    const syncCredential = {
      primeAccountSalt: 'test-salt',
      securityPasswordR1: 'test-password',
      masterPasswordUUID: 'test-password-id',
    };
    const getSyncCredentialSafe = jest.fn(async () => syncCredential);
    const isCloudSyncIsAvailable = jest.fn(async () => true);
    const getWalletDeviceSafe = jest.fn(async () => target.dbDevice);
    const qaManager = new CloudSyncFlowManagerWallet({
      backgroundApi: {
        servicePrimeCloudSync: {
          getSyncCredentialSafe,
          isCloudSyncIsAvailable,
        },
        localDb: { getWalletDeviceSafe },
      } as unknown as IBackgroundApi,
    });

    await expect(qaManager.isSupportSync(target)).resolves.toBe(false);
    await expect(
      qaManager.buildExistingSyncItemsInfo({
        tx: undefined,
        targets: [target],
        onExistingSyncItemsInfo: async () => undefined,
      }),
    ).resolves.toMatchObject({ existingSyncItems: [], newSyncItems: [] });
    await expect(
      qaManager.buildInitSyncDBItems({
        dbRecords: [target.wallet],
        initDataTime: undefined,
        syncCredential,
      }),
    ).resolves.toEqual([]);
    await expect(
      qaManager.isSupportSync({
        ...target,
        wallet: {
          ...target.wallet,
          isMocked: false,
          accounts: ['test-account'],
        },
      }),
    ).resolves.toBe(false);
  });

  test('ordinary mocked QR wallets remain eligible for sync', async () => {
    await expect(
      manager.isSupportSync({
        ...qaTarget,
        wallet: {
          ...qaTarget.wallet,
          id: 'qr-ordinary',
          name: 'QA Unknown Avatar',
          isMocked: true,
          avatarInfo: { img: EDeviceType.Unknown },
        },
        dbDevice: { ...qaDevice, deviceId: 'ordinary-device' },
      }),
    ).resolves.toBe(true);
  });

  test('restore identities filter wallet lookups and encryption before constructing items', async () => {
    const selected: IDBWallet = {
      ...qaTarget.wallet,
      id: 'hd-selected',
      type: WALLET_TYPE_HD,
      hash: 'selected-hash',
      associatedDevice: undefined,
    };
    const other = { ...selected, id: 'hd-other', hash: 'other-hash' };
    const wrongRaw = { ...selected, id: 'hd-wrong', hash: 'wrong-hash' };
    const getSyncItemSafe = jest.fn(async () => undefined);
    const restoreManager = new CloudSyncFlowManagerWallet({
      backgroundApi: {
        localDb: { getSyncItemSafe },
      } as unknown as IBackgroundApi,
    });
    const build = jest
      .spyOn(restoreManager, 'buildSyncItem')
      .mockResolvedValue(undefined);
    const selectedKey = await restoreManager.buildSyncKeyInfo({
      target: await restoreManager.buildSyncTargetByDBQuery({
        dbRecord: selected,
      }),
    });
    const wrongKey = await restoreManager.buildSyncKeyInfo({
      target: await restoreManager.buildSyncTargetByDBQuery({
        dbRecord: wrongRaw,
      }),
    });
    expect(selectedKey).toBeDefined();
    expect(wrongKey).toBeDefined();
    if (!selectedKey || !wrongKey) return;
    const syncCredential = {
      primeAccountSalt: 'fixture',
      securityPasswordR1: 'fixture',
      masterPasswordUUID: 'fixture',
    };
    await restoreManager.buildInitSyncDBItems({
      dbRecords: [selected, other, wrongRaw],
      initDataTime: undefined,
      syncCredential,
      requiredSyncItems: new Map([
        [selectedKey.key, selectedKey.rawKey],
        [wrongKey.key, 'Wallet >> wrong identity'],
      ]),
    });
    expect(getSyncItemSafe).toHaveBeenCalledTimes(1);
    expect(getSyncItemSafe).toHaveBeenCalledWith({ id: selectedKey.key });
    expect(build).toHaveBeenCalledTimes(1);
    expect(build).toHaveBeenCalledWith(
      expect.objectContaining({
        target: expect.objectContaining({ targetId: selected.id }),
      }),
    );
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

  test('syncs the wallet avatar seed even without any network accounts', async () => {
    const firstEvmAddress = '0x1111111111111111111111111111111111111111';
    const target = {
      ...qaTarget,
      wallet: { ...qaTarget.wallet, firstEvmAddress, accounts: [] },
    };
    const payload = await manager.buildSyncPayload({ target });
    expect(payload.firstEvmAddress).toBe(firstEvmAddress);
    await manager.syncToSceneEachItem({ target, payload });
    expect(setWalletNameAndAvatar).toHaveBeenCalledWith(
      expect.objectContaining({ firstEvmAddress }),
    );
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
  describe('server scene rename retention', () => {
    const wallet: IDBWallet = {
      id: 'hd-canonical-before-cloud',
      name: 'Local name not yet in history',
      type: WALLET_TYPE_HD,
      accounts: [],
      nextIds: {},
      backuped: true,
      walletNo: 7,
    };
    const target: ICloudSyncTargetWallet = {
      targetId: wallet.id,
      dataType: EPrimeCloudSyncDataType.Wallet,
      wallet: { ...wallet, avatarInfo: undefined },
      dbDevice: undefined,
    };
    const item: IDBCloudSyncItem = {
      id: 'synthetic-wallet-row',
      data: 'synthetic-active-scope-box',
      dataTime: 900,
      dataType: EPrimeCloudSyncDataType.Wallet,
      rawKey: '',
      rawData: '',
      pwdHash: 'keyless-synthetic',
      localSceneUpdated: false,
      serverUploaded: true,
      isDeleted: false,
    };
    const payload: ICloudSyncPayloadWallet = {
      name: 'Server name',
      avatar: undefined,
      walletHash: undefined,
      hwDeviceId: undefined,
      passphraseState: '',
      walletType: WALLET_TYPE_HD,
    };
    const filter = {
      entityType: EChangeHistoryEntityType.Wallet,
      entityId: wallet.id,
      contentType: EChangeHistoryContentType.Name,
    };

    test('a new history instance sees only the old name before the scene changes', async () => {
      const values = new Map<string, string>();
      const history = new SimpleDbEntityChangeHistory();
      const storage = {
        getItem: async (key: string) => values.get(key) ?? null,
        setItem: async (key: string, value: string) => values.set(key, value),
      } as unknown as typeof history.appStorage;
      history.appStorage = storage;
      const update = jest.fn(async () => {
        const reopened = new SimpleDbEntityChangeHistory();
        reopened.appStorage = storage;
        const retained = await reopened.getChangeHistory(filter);
        expect(retained.map(({ value }) => value)).toEqual([wallet.name]);
        expect(retained[0].timestamp).not.toBe(item.dataTime);
      });
      const sync = new CloudSyncFlowManagerWallet({
        backgroundApi: {
          localDb: { getWallet: jest.fn(async () => wallet) },
          simpleDb: { changeHistory: history },
          serviceAccount: { setWalletNameAndAvatar: update },
        } as unknown as IBackgroundApi,
      });
      await expect(
        sync.syncToSceneEachItem({ item, target, payload }),
      ).resolves.toBe(true);
      expect(update).toHaveBeenCalledWith(
        expect.objectContaining({ expectedCloudSyncWalletName: wallet.name }),
      );
      const first = await history.getChangeHistory(filter);
      await history.retainWalletName({
        walletId: wallet.id,
        name: wallet.name,
      });
      await history.retainWalletName({ walletId: wallet.id, name: ' ' });
      expect(await history.getChangeHistory(filter)).toEqual(first);
    });

    test.each(['failure', 'hang', 'cancelled'] as const)(
      'does not apply or acknowledge the server scene when safety preparation %s',
      async (scenario) => {
        jest.useFakeTimers();
        try {
          let isCurrent = true;
          const retained = Promise.withResolvers<boolean>();
          const retainWalletName = jest.fn(async () => {
            if (scenario === 'failure')
              throw new OneKeyLocalError('synthetic I/O failure');
            if (scenario === 'cancelled') {
              isCurrent = false;
              return true;
            }
            return retained.promise;
          });
          const update = jest.fn(async () => undefined);
          const sync = new CloudSyncFlowManagerWallet({
            backgroundApi: {
              localDb: { getWallet: jest.fn(async () => wallet) },
              simpleDb: { changeHistory: { retainWalletName } },
              serviceAccount: { setWalletNameAndAvatar: update },
            } as unknown as IBackgroundApi,
          });
          const apply = sync.syncToSceneEachItem({
            item,
            target,
            payload,
            isCurrent: () => isCurrent,
          });
          await jest.advanceTimersByTimeAsync(1500);
          await expect(apply).resolves.toBe(false);
          expect(update).not.toHaveBeenCalled();
          retained.resolve(true);
          await Promise.resolve();
          expect(update).not.toHaveBeenCalled();
        } finally {
          jest.useRealTimers();
        }
      },
    );

    test.each(['same-name', 'empty-name', 'not-server-uploaded'] as const)(
      'does not add history for a %s scene',
      async (scenario) => {
        const retainWalletName = jest.fn(async () => true);
        const sync = new CloudSyncFlowManagerWallet({
          backgroundApi: {
            localDb: {
              getWallet: jest.fn(async () => ({
                ...wallet,
                name: (() => {
                  if (scenario === 'empty-name') return '';
                  if (scenario === 'same-name') return payload.name;
                  return wallet.name;
                })(),
              })),
            },
            simpleDb: { changeHistory: { retainWalletName } },
            serviceAccount: { setWalletNameAndAvatar },
          } as unknown as IBackgroundApi,
        });
        await expect(
          sync.syncToSceneEachItem({
            item: {
              ...item,
              serverUploaded: scenario !== 'not-server-uploaded',
            },
            target,
            payload,
          }),
        ).resolves.toBe(true);
        expect(retainWalletName).not.toHaveBeenCalled();
      },
    );

    test.each(['', wallet.name])(
      'a server avatar applies without writing name history when name is %s',
      async (name) => {
        const retainWalletName = jest.fn(async () => false);
        const update = jest.fn(async () => undefined);
        const sync = new CloudSyncFlowManagerWallet({
          backgroundApi: {
            localDb: { getWallet: jest.fn(async () => wallet) },
            simpleDb: { changeHistory: { retainWalletName } },
            serviceAccount: { setWalletNameAndAvatar: update },
          } as unknown as IBackgroundApi,
        });
        await expect(
          sync.syncToSceneEachItem({
            item,
            target,
            payload: { ...payload, name, avatar: { img: 'bear' } },
          }),
        ).resolves.toBe(true);
        expect(retainWalletName).not.toHaveBeenCalled();
        expect(update).toHaveBeenCalledWith(
          expect.objectContaining({ name, avatar: { img: 'bear' } }),
        );
      },
    );

    test('a deferred old name leaves the scene pending and does not block the next Wallet', async () => {
      const secondWallet = { ...wallet, id: 'hd-second', hash: 'second-hash' };
      const firstWallet = { ...wallet, hash: 'first-hash' };
      const secondItem = { ...item, dataTime: 901 };
      const retainWalletName = jest.fn(
        async ({ walletId }: { walletId: string }) =>
          walletId === secondWallet.id,
      );
      const update = jest.fn(async () => undefined);
      const updateSyncItem = jest.fn(async () => undefined);
      const localDb = {
        getWallet: jest.fn(async ({ walletId }: { walletId: string }) =>
          walletId === secondWallet.id ? secondWallet : firstWallet,
        ),
        getWalletBySyncPayload: jest.fn(
          async ({ payload: current }: { payload: { walletHash: string } }) =>
            current.walletHash === firstWallet.hash
              ? firstWallet
              : secondWallet,
        ),
        updateSyncItem,
      };
      const sync = new CloudSyncFlowManagerWallet({
        backgroundApi: {
          localDb,
          simpleDb: { changeHistory: { retainWalletName } },
          serviceAccount: { setWalletNameAndAvatar: update },
        } as unknown as IBackgroundApi,
      });
      const firstKey = await sync.buildSyncKeyInfo({
        target: await sync.buildSyncTargetByDBQuery({ dbRecord: firstWallet }),
      });
      const secondKey = await sync.buildSyncKeyInfo({
        target: await sync.buildSyncTargetByDBQuery({ dbRecord: secondWallet }),
      });
      if (!firstKey || !secondKey)
        throw new OneKeyLocalError('Missing synthetic identity');
      jest
        .spyOn(cloudSyncItemBuilder, 'decryptSyncItem')
        .mockImplementation(async ({ item: current }) => ({
          dbItem: current,
          dataType: current.dataType,
          isDeleted: current.isDeleted,
          rawDataJson: {
            rawKey: current.rawKey,
            dataType: EPrimeCloudSyncDataType.Wallet,
            payload: {
              ...payload,
              walletHash:
                current.id === firstKey.key
                  ? firstWallet.hash
                  : secondWallet.hash,
            },
          },
        }));
      try {
        await sync.syncToScene({
          syncCredential: {
            primeAccountSalt: '',
            securityPasswordR1: '',
            masterPasswordUUID: item.pwdHash,
          },
          items: [
            { ...item, id: firstKey.key, rawKey: firstKey.rawKey },
            { ...secondItem, id: secondKey.key, rawKey: secondKey.rawKey },
          ],
          forceSync: true,
        });
        expect(update).toHaveBeenCalledTimes(1);
        expect(update).toHaveBeenCalledWith(
          expect.objectContaining({ walletId: secondWallet.id }),
        );
        expect(updateSyncItem).toHaveBeenCalledTimes(1);
        expect(updateSyncItem).toHaveBeenCalledWith(
          expect.objectContaining({ ids: [secondKey.key] }),
        );
      } finally {
        jest.restoreAllMocks();
      }
    });
  });
});
