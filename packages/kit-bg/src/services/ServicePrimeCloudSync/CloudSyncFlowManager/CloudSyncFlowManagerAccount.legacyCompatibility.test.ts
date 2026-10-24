import { EPrimeCloudSyncDataType } from '@onekeyhq/shared/src/consts/primeConsts';
import type {
  ICloudSyncCredential,
  ICloudSyncPayloadAccount,
  ICloudSyncRawDataJson,
} from '@onekeyhq/shared/types/prime/primeCloudSyncTypes';
import type { ICloudPublicAccountSnapshot } from '@onekeyhq/shared/types/prime/publicAccountSnapshot';

import { EDBAccountType } from '../../../dbs/local/consts';
import cloudSyncItemBuilder from '../cloudSyncItemBuilder';
import { getPublicAccountSnapshotId } from '../publicAccountSnapshot';

import { CloudSyncFlowManagerAccount as PublishedAccountManager } from './CloudSyncFlowManagerAccount.legacy.test-utils';

import type { IBackgroundApi } from '../../../apis/IBackgroundApi';
import type { IDBAccount, IDBCloudSyncItem } from '../../../dbs/local/types';

// Public BIP32 test vector; no production or user wallet data.
const snapshot: ICloudPublicAccountSnapshot = {
  schema: 'onekey-public-account',
  version: 1,
  capabilities: ['account-copy-v1'],
  wallet: {
    kind: 'hardware',
    xfp: '12345678--xpub6C1HVMz946r433QEjZGpYYWYcspxXXBPys5PBGkmQboRXE6RLfFiStEkKbWKCZaPgDrzZh9nUEunxuiuy6MNdw23du2Ek7GoKYMJVH8eK5E',
    hidden: false,
  },
  account: {
    impl: 'evm',
    type: 'simple',
    networkId: 'evm--1',
    coinType: '60',
    path: "m/44'/60'/0'/0/0",
    pathIndex: 0,
    template: "m/44'/60'/0'/0/$$INDEX$$",
    name: 'Public snapshot name',
    address: '0x1111111111111111111111111111111111111111',
    pub: '',
  },
};
const credential: ICloudSyncCredential = {
  primeAccountSalt: 'test-salt',
  securityPasswordR1: 'test-password',
  masterPasswordUUID: 'test-pwd-hash',
};

describe('frozen 7140d406 Account reader compatibility', () => {
  afterEach(() => jest.restoreAllMocks());

  test('skips synthetic known/future snapshots and tombstones while applying ordinary labels', async () => {
    const ordinary: IDBAccount = {
      id: 'watching--evm--ordinary',
      name: 'Old name',
      type: EDBAccountType.SIMPLE,
      impl: 'evm',
      coinType: '60',
      path: '',
      pathIndex: 0,
      template: '',
      address: '0x2222222222222222222222222222222222222222',
      pub: '',
    };
    const getAccountSafe = jest.fn(
      async ({ accountId }: { accountId: string }) =>
        accountId === ordinary.id ? ordinary : undefined,
    );
    const setAccountName = jest.fn(async () => undefined);
    const updateSyncItem = jest.fn(async () => undefined);
    const createAccount = jest.fn();
    const importPublicCloudAccounts = jest.fn();
    const removeAccount = jest.fn();
    const removeCloudSyncPoolItems = jest.fn();
    const manager = new PublishedAccountManager({
      backgroundApi: {
        localDb: {
          getAccountSafe,
          updateSyncItem,
          createAccount,
          importPublicCloudAccounts,
          removeAccount,
          removeCloudSyncPoolItems,
        },
        serviceAccount: { setAccountName },
      } as unknown as IBackgroundApi,
    });
    const knownId = getPublicAccountSnapshotId(snapshot);
    const futureId = `cloud-public-account:v2:${'a'.repeat(64)}`;
    const payloads: ICloudSyncPayloadAccount[] = [
      {
        name: snapshot.account.name,
        accountId: knownId,
        publicAccountSnapshot: snapshot,
      },
      {
        name: 'Unknown version',
        accountId: futureId,
        publicAccountSnapshot: {
          ...snapshot,
          version: 2,
          capabilities: ['future-copy'],
        } as unknown as ICloudPublicAccountSnapshot,
      },
      {
        name: snapshot.account.name,
        accountId: knownId,
        publicAccountSnapshot: snapshot,
      },
      { name: 'Updated ordinary label', accountId: ordinary.id },
    ];
    const rawItems = new Map<string, ICloudSyncRawDataJson>();
    const items: IDBCloudSyncItem[] = payloads.map((payload, index) => {
      const rawKey = `Account >> ${payload.accountId}`;
      const id =
        index === 2
          ? 'test-tombstone-record-key'
          : manager.rawKeyToHashKey(rawKey);
      rawItems.set(id, {
        dataType: EPrimeCloudSyncDataType.Account,
        rawKey,
        payload,
      });
      return {
        id,
        dataType: EPrimeCloudSyncDataType.Account,
        rawKey: '',
        rawData: '',
        data: 'test-ciphertext',
        dataTime: 1,
        pwdHash: credential.masterPasswordUUID,
        isDeleted: index === 2,
        localSceneUpdated: false,
        serverUploaded: true,
      };
    });
    jest
      .spyOn(cloudSyncItemBuilder, 'decryptSyncItem')
      .mockImplementation(async ({ item }) => {
        const rawDataJson = rawItems.get(item.id);
        return {
          dbItem: { ...item, rawDataJson },
          rawDataJson,
          dataType: item.dataType,
          isDeleted: item.isDeleted,
        };
      });

    await manager.syncToScene({ items, syncCredential: credential });

    expect(
      getAccountSafe.mock.calls.map(([params]) => params.accountId),
    ).toEqual([knownId, futureId, knownId, ordinary.id]);
    expect(setAccountName).toHaveBeenCalledTimes(1);
    expect(setAccountName).toHaveBeenCalledWith({
      accountId: ordinary.id,
      name: 'Updated ordinary label',
      skipSaveLocalSyncItem: true,
      skipEventEmit: true,
    });
    expect(updateSyncItem).toHaveBeenCalledTimes(1);
    expect(updateSyncItem).toHaveBeenCalledWith(
      expect.objectContaining({ ids: [items[3].id] }),
    );
    expect(createAccount).not.toHaveBeenCalled();
    expect(importPublicCloudAccounts).not.toHaveBeenCalled();
    expect(removeAccount).not.toHaveBeenCalled();
    expect(removeCloudSyncPoolItems).not.toHaveBeenCalled();
    expect(items.slice(0, 3).every((item) => !item.localSceneUpdated)).toBe(
      true,
    );
  });
});
