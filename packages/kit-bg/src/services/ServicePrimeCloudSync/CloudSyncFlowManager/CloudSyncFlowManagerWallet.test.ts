import { EDeviceType } from '@onekeyfe/hd-shared';

import {
  DEV_UNKNOWN_AVATAR_DEVICE_ID,
  WALLET_TYPE_HD,
  WALLET_TYPE_QR,
} from '@onekeyhq/shared/src/consts/dbConsts';
import { EPrimeCloudSyncDataType } from '@onekeyhq/shared/src/consts/primeConsts';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import type { ICloudSyncTargetWallet } from '@onekeyhq/shared/types/prime/primeCloudSyncTypes';

import { CloudSyncFlowManagerWallet } from './CloudSyncFlowManagerWallet';

import type { IBackgroundApi } from '../../../apis/IBackgroundApi';
import type { IDBDevice } from '../../../dbs/local/types';

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
