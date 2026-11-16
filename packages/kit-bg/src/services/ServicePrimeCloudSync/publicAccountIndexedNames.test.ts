import { EPrimeCloudSyncDataType } from '@onekeyhq/shared/src/consts/primeConsts';
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

function setup() {
  const rows: IDBCloudSyncItem[] = [0, 1].map((index) => ({
    id: `key:${xfp}__${index}`,
    dataType: EPrimeCloudSyncDataType.IndexedAccount,
    data: `cipher${index}`,
    rawData: '',
    rawKey: '',
    pwdHash: 'space',
    dataTime: 5,
    isDeleted: false,
    localSceneUpdated: true,
    serverUploaded: true,
  }));
  const read = jest.fn(async ({ name }: { name: ELocalDBStoreNames }) => ({
    records: name === ELocalDBStoreNames.CloudSyncItem ? rows : [],
  }));
  jest.spyOn(cloudSyncItemBuilder, 'getPwdHash').mockReturnValue('space');
  const decrypt = jest
    .spyOn(cloudSyncItemBuilder, 'decryptSyncItem')
    .mockImplementation(async ({ item }) => ({
      dbItem: item,
      dataType: EPrimeCloudSyncDataType.IndexedAccount,
      isDeleted: false,
      rawDataJson: {
        rawKey: `${xfp}__${item.id.endsWith('0') ? 0 : 1}`,
        dataType: EPrimeCloudSyncDataType.IndexedAccount,
        payload: {
          walletXfp: xfp,
          index: item.id.endsWith('0') ? 0 : 1,
          name: 'Custom indexed name',
        },
      },
    }));
  const backgroundApi = {
    localDb: { getRecordsByIds: read },
    servicePrimeCloudSync: {
      syncManagers: {
        indexedAccount: { rawKeyToHashKey: (raw: string) => `key:${raw}` },
      },
    },
  } as unknown as IBackgroundApi;
  return { rows, read, decrypt, backgroundApi };
}

test('reads acknowledged or early metadata once per unique index, not once per chain account', async () => {
  const { backgroundApi, read, decrypt } = setup();
  const result = await preparePublicAccountIndexedNames({
    backgroundApi,
    wallet,
    accounts,
    syncCredential: credential,
  });
  expect(result.size).toBe(2);
  expect(result.get('hd-1--0')?.name).toBe('Custom indexed name');
  expect(read).toHaveBeenCalledTimes(1);
  expect(decrypt).toHaveBeenCalledTimes(2);
});

test.each(['deleted', 'foreign-space', 'wrong-type', 'wrong-identity'])(
  'rejects %s metadata',
  async (mode) => {
    const { backgroundApi, rows, decrypt } = setup();
    rows.splice(1);
    if (mode === 'deleted') rows[0].isDeleted = true;
    if (mode === 'foreign-space') rows[0].pwdHash = 'other';
    if (mode === 'wrong-type')
      rows[0].dataType = EPrimeCloudSyncDataType.Account;
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
  },
);

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
