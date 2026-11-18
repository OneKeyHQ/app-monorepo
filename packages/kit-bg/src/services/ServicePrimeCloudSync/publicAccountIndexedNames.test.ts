import { EPrimeCloudSyncDataType } from '@onekeyhq/shared/src/consts/primeConsts';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import type { ICloudSyncCredential } from '@onekeyhq/shared/types/prime/primeCloudSyncTypes';

import { ELocalDBStoreNames } from '../../dbs/local/localDBStoreNames';

import { CloudSyncFlowManagerIndexedAccount } from './CloudSyncFlowManager/CloudSyncFlowManagerIndexedAccount';
import cloudSyncItemBuilder from './cloudSyncItemBuilder';
import { preparePublicAccountIndexedNames } from './publicAccountIndexedNames';
import { PUBLIC_ACCOUNT_TEST_XFP } from './publicAccountSnapshot.test-utils';

import type { IBackgroundApi } from '../../apis/IBackgroundApi';
import type {
  IDBAccount,
  IDBCloudSyncItem,
  IDBWallet,
} from '../../dbs/local/types';

const xfp = PUBLIC_ACCOUNT_TEST_XFP;
const wallet = { id: 'hd-1', xfp } as IDBWallet;
const accounts = [0, 0, 1].map((pathIndex) => ({ pathIndex })) as IDBAccount[];
const credential = { masterPasswordUUID: 'space' } as ICloudSyncCredential;

afterEach(() => jest.restoreAllMocks());

async function setup() {
  const backgroundApi = {
    localDb: {},
    servicePrimeCloudSync: { syncManagers: {} },
  } as unknown as IBackgroundApi;
  const manager = new CloudSyncFlowManagerIndexedAccount({ backgroundApi });
  backgroundApi.servicePrimeCloudSync.syncManagers.indexedAccount = manager;
  const keyInfos = await Promise.all(
    [0, 1].map((index) =>
      manager.buildSyncKeyAndPayload({
        target: {
          targetId: `hd-1--${index}`,
          dataType: EPrimeCloudSyncDataType.IndexedAccount,
          wallet: { ...wallet, avatarInfo: wallet.avatarInfo },
          indexedAccount: {
            id: `hd-1--${index}`,
            walletId: wallet.id,
            index,
            name: 'Custom indexed name',
            idHash: '',
          },
        },
      }),
    ),
  );
  const rows: IDBCloudSyncItem[] = keyInfos.map(({ key }) => ({
    id: key,
    dataType: EPrimeCloudSyncDataType.IndexedAccount,
    data: 'test-cipher',
    rawData: '',
    rawKey: '',
    pwdHash: 'space',
    dataTime: 5,
    isDeleted: false,
    localSceneUpdated: true,
    serverUploaded: true,
  }));
  const read = jest.fn(
    async ({ name, ids }: { name: ELocalDBStoreNames; ids: string[] }) => ({
      records:
        name === ELocalDBStoreNames.CloudSyncItem
          ? rows.filter((row) => ids.includes(row.id))
          : [],
    }),
  );
  backgroundApi.localDb.getRecordsByIds =
    read as typeof backgroundApi.localDb.getRecordsByIds;
  jest.spyOn(cloudSyncItemBuilder, 'getPwdHash').mockReturnValue('space');
  const decrypt = jest
    .spyOn(cloudSyncItemBuilder, 'decryptSyncItem')
    .mockImplementation(async ({ item }) => {
      const keyInfo = keyInfos.find((info) => info.key === item.id);
      if (!keyInfo) throw new OneKeyLocalError('Unexpected metadata key');
      return {
        dbItem: item,
        dataType: EPrimeCloudSyncDataType.IndexedAccount,
        isDeleted: false,
        rawDataJson: {
          rawKey: keyInfo.rawKey,
          dataType: EPrimeCloudSyncDataType.IndexedAccount,
          payload: keyInfo.payload,
        },
      };
    });
  return { rows, read, decrypt, backgroundApi, keyInfos };
}

test('round-trips real manager keys and raw keys for acknowledged metadata once per unique index', async () => {
  const { backgroundApi, read, decrypt, keyInfos } = await setup();
  const result = await preparePublicAccountIndexedNames({
    backgroundApi,
    wallet,
    accounts,
    syncCredential: credential,
  });
  expect(result.size).toBe(2);
  expect(result.get('hd-1--0')?.name).toBe('Custom indexed name');
  expect(read).toHaveBeenCalledTimes(1);
  expect(read).toHaveBeenCalledWith({
    name: ELocalDBStoreNames.CloudSyncItem,
    ids: keyInfos.map((info) => info.key),
  });
  expect(keyInfos[0].rawKey).toBe(
    `${EPrimeCloudSyncDataType.IndexedAccount} >> ${xfp}__0`,
  );
  expect(decrypt).toHaveBeenCalledTimes(2);
});

test.each([
  'deleted',
  'foreign-space',
  'wrong-type',
  'wrong-identity',
  'unprefixed-raw-key',
])('rejects %s metadata', async (mode) => {
  const { backgroundApi, rows, decrypt, keyInfos } = await setup();
  rows.splice(1);
  if (mode === 'deleted') rows[0].isDeleted = true;
  if (mode === 'foreign-space') rows[0].pwdHash = 'other';
  if (mode === 'wrong-type') rows[0].dataType = EPrimeCloudSyncDataType.Account;
  if (mode === 'unprefixed-raw-key')
    decrypt.mockResolvedValue({
      dbItem: rows[0],
      dataType: EPrimeCloudSyncDataType.IndexedAccount,
      isDeleted: false,
      rawDataJson: {
        rawKey: `${xfp}__0`,
        dataType: EPrimeCloudSyncDataType.IndexedAccount,
        payload: keyInfos[0].payload,
      },
    });
  if (mode === 'wrong-identity')
    decrypt.mockResolvedValue({
      dbItem: rows[0],
      dataType: EPrimeCloudSyncDataType.IndexedAccount,
      isDeleted: false,
      rawDataJson: {
        rawKey: 'wrong',
        dataType: EPrimeCloudSyncDataType.IndexedAccount,
        payload: { walletXfp: '87654321', index: 0, name: 'Wrong' },
      },
    });
  expect(
    await preparePublicAccountIndexedNames({
      backgroundApi,
      wallet,
      accounts,
      syncCredential: credential,
    }),
  ).toEqual(new Map());
});

test('metadata target finds a later same-xfp wallet when the first lacks the index', async () => {
  const index = {
    id: 'hd-2--0',
    walletId: 'hd-2',
    index: 0,
    name: 'Name',
    idHash: '',
  };
  const backgroundApi = {
    localDb: {
      getWalletsByXfp: async () => [{ id: 'hd-1' }, { id: 'hd-2' }],
      getIndexedAccountSafe: async ({ id }: { id: string }) =>
        id === index.id ? index : undefined,
    },
  } as unknown as IBackgroundApi;
  const manager = new CloudSyncFlowManagerIndexedAccount({ backgroundApi });
  expect(
    await manager.getDBRecordBySyncPayload({
      payload: { walletXfp: xfp, index: 0, name: 'Name' },
    }),
  ).toEqual(index);
});

test('initializing a default indexed name does not promote it to a fresh edit', async () => {
  const clock = jest.fn(async () => 999_999);
  const backgroundApi = {
    localDb: {
      getWalletByIndexedAccountId: async () => wallet,
      getSyncItemSafe: async () => undefined,
    },
    servicePrimeCloudSync: { getCloudSyncDataTime: clock },
  } as unknown as IBackgroundApi;
  const manager = new CloudSyncFlowManagerIndexedAccount({ backgroundApi });
  const build = jest
    .spyOn(cloudSyncItemBuilder, 'buildSyncItemFromRawDataJson')
    .mockImplementation(async ({ key, dataTime, rawDataJson }) => ({
      id: key,
      dataTime,
      rawKey: rawDataJson.rawKey,
      rawData: '',
      data: 'public-test-cipher',
      pwdHash: 'space',
      dataType: EPrimeCloudSyncDataType.IndexedAccount,
      isDeleted: false,
      localSceneUpdated: false,
      serverUploaded: false,
    }));
  const items = await manager.buildInitSyncDBItems({
    dbRecords: [
      {
        id: 'hd-1--0',
        walletId: wallet.id,
        index: 0,
        name: 'Account #1',
        idHash: '',
      },
    ],
    initDataTime: undefined,
    syncCredential: credential,
  });
  expect(items).toHaveLength(1);
  expect(items[0].dataTime).toBeUndefined();
  expect(clock).not.toHaveBeenCalled();
  expect(build).toHaveBeenCalledWith(
    expect.objectContaining({
      dataTime: undefined,
      rawDataJson: expect.objectContaining({
        payload: expect.objectContaining({ name: 'Account #1' }),
      }),
    }),
  );
});
