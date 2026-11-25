import { EDeviceType } from '@onekeyfe/hd-shared';
import { AxiosHeaders } from 'axios';
import { cloneDeep } from 'lodash';

import { sha512ProSync } from '@onekeyhq/core/src/secret/hash';
import { EPrimeCloudSyncDataType } from '@onekeyhq/shared/src/consts/primeConsts';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import stringUtils from '@onekeyhq/shared/src/utils/stringUtils';
import type {
  ICloudSyncCredential,
  ICloudSyncRawDataJson,
} from '@onekeyhq/shared/types/prime/primeCloudSyncTypes';

import localDb from '../../dbs/local/localDb';

import cloudSyncItemBuilder from './cloudSyncItemBuilder';
import {
  getPublicAccountSnapshotId,
  getPublicAccountSnapshotIdentityHash,
} from './publicAccountSnapshot';
import { publicAccountTestSnapshot } from './publicAccountSnapshot.test-utils';
import { getOfflinePublicAccountSnapshotFill } from './publicAccountSnapshotWriteGuard';
import ServicePrimeCloudSync from './ServicePrimeCloudSync';

import type {
  IDBCloudSyncItem,
  IDBIndexedAccount,
} from '../../dbs/local/types';

jest.mock('@onekeyhq/shared/src/background/backgroundDecorators', () => {
  const passthroughDecorator =
    () =>
    (...args: unknown[]) =>
      args.length === 1 ? args[0] : args[2];

  return {
    backgroundClass: passthroughDecorator,
    backgroundMethod: passthroughDecorator,
    backgroundMethodForDev: passthroughDecorator,
    toastIfError: passthroughDecorator,
  };
});

jest.mock('../ServiceBase', () => ({
  __esModule: true,
  default: class ServiceBaseMock {
    constructor({ backgroundApi }: { backgroundApi: unknown }) {
      this.backgroundApi = backgroundApi;
    }

    backgroundApi: unknown;
  },
}));

jest.mock('../../states/jotai/atoms', () => ({
  primeCloudSyncPersistAtom: {
    get: jest.fn(async () => ({})),
    set: jest.fn(),
  },
  addressBookPersistAtom: {},
  devSettingsPersistAtom: { sub: jest.fn(() => () => undefined) },
  primeMasterPasswordPersistAtom: {},
  primePersistAtom: {},
}));

jest.mock('./CloudSyncFlowManager/CloudSyncFlowManagerAccount', () => ({
  CloudSyncFlowManagerAccount: jest.fn(),
}));
jest.mock('./CloudSyncFlowManager/CloudSyncFlowManagerAddressBook', () => ({
  CloudSyncFlowManagerAddressBook: jest.fn(),
}));
jest.mock('./CloudSyncFlowManager/CloudSyncFlowManagerBotWallet', () => ({
  CloudSyncFlowManagerBotWallet: jest.fn(),
}));
jest.mock('./CloudSyncFlowManager/CloudSyncFlowManagerBrowserBookmark', () => ({
  CloudSyncFlowManagerBrowserBookmark: jest.fn(),
}));
jest.mock('./CloudSyncFlowManager/CloudSyncFlowManagerCustomNetwork', () => ({
  CloudSyncFlowManagerCustomNetwork: jest.fn(),
}));
jest.mock('./CloudSyncFlowManager/CloudSyncFlowManagerCustomRpc', () => ({
  CloudSyncFlowManagerCustomRpc: jest.fn(),
}));
jest.mock('./CloudSyncFlowManager/CloudSyncFlowManagerCustomToken', () => ({
  CloudSyncFlowManagerCustomToken: jest.fn(),
}));
jest.mock('./CloudSyncFlowManager/CloudSyncFlowManagerIndexedAccount', () => ({
  CloudSyncFlowManagerIndexedAccount: jest.fn(),
}));
jest.mock('./CloudSyncFlowManager/CloudSyncFlowManagerLock', () => ({
  CloudSyncFlowManagerLock: jest.fn(),
}));
jest.mock('./CloudSyncFlowManager/CloudSyncFlowManagerMarketWatchList', () => ({
  CloudSyncFlowManagerMarketWatchList: jest.fn(),
}));
jest.mock('./CloudSyncFlowManager/CloudSyncFlowManagerWallet', () => ({
  CloudSyncFlowManagerWallet: jest.fn(),
}));

jest.mock('../../dbs/local/localDb', () => ({
  __esModule: true,
  default: {
    addAndUpdateSyncItems: jest.fn(async () => undefined),
    getSyncItemSafe: jest.fn(),
    updateSyncItem: jest.fn(),
    getAccountSafe: jest.fn(),
    getWalletSafe: jest.fn(),
    addAccountsToWallet: jest.fn(),
    importPublicCloudAccounts: jest.fn(),
  },
}));

jest.mock('../../dbs/simple/simpleDb', () => ({
  __esModule: true,
  default: {
    cloudSyncAccountIssues: {
      updateIssues: jest.fn(
        async ({ updates }: { updates: { issue?: string }[] }) => ({
          needsUpdate: updates.filter(
            (update) => update.issue === 'needsUpdate',
          ).length,
          pending: 0,
          conflicts: 0,
          rejected: 0,
        }),
      ),
    },
  },
}));

jest.mock('./botWalletCloudSyncUtils', () => ({
  filterBotWalletRecordsByCurrentKeylessSyncScope: jest.fn(),
}));

// Public synthetic keys used only by these in-memory crypto round trips.
const credential = {
  primeAccountSalt: '',
  securityPasswordR1: '',
  masterPasswordUUID: '',
  keylessCredential: {
    keylessWalletId: 'public-rebuild-test',
    signingPrivateKey: '11'.repeat(32),
    signingPublicKey: '02'.repeat(33),
    encryptionKey: '22'.repeat(32),
    pwdHash: 'keyless-public-rebuild-test',
  },
} satisfies ICloudSyncCredential;

type IRawFixture = {
  dataType: EPrimeCloudSyncDataType;
  rawKey: string;
  payload: {
    accountId: string;
    name: string;
    publicAccountSnapshot: unknown;
    futureField?: boolean;
  };
  futureField?: boolean;
};

function rawFixture(): IRawFixture {
  const snapshot = publicAccountTestSnapshot();
  const accountId = getPublicAccountSnapshotId(snapshot);
  return {
    dataType: EPrimeCloudSyncDataType.Account,
    rawKey: `Account >> ${accountId}`,
    payload: {
      accountId,
      name: snapshot.account.name,
      publicAccountSnapshot: snapshot,
    },
  };
}

function rawItem(raw = rawFixture()): IDBCloudSyncItem {
  return {
    id: sha512ProSync({ data: raw.rawKey }),
    dataType: EPrimeCloudSyncDataType.Account,
    rawKey: raw.rawKey,
    rawData: stringUtils.stableStringify(raw),
    data: undefined,
    dataTime: 1_750_000_000_000,
    isDeleted: true,
    pwdHash: '',
    localSceneUpdated: true,
    serverUploaded: false,
  };
}

async function makeRepairFixture(serverUploaded: boolean) {
  const hardware: ICloudSyncCredential = {
    ...credential,
    keylessCredential: {
      ...credential.keylessCredential,
      pwdHash: 'hw-dek-public-repair-fixture',
      source: {
        type: 'hardware',
        credentialId: credential.keylessCredential.keylessWalletId,
        derivationVersion: 1,
        deviceName: 'Public test hardware',
        deviceType: EDeviceType.Pro,
      },
    },
  };
  const dataType = EPrimeCloudSyncDataType.BrowserBookmark;
  const rawKey = 'BrowserBookmark >> https://repair.example.invalid';
  const lastGood = await cloudSyncItemBuilder.buildSyncItemFromRawDataJson({
    key: sha512ProSync({ data: rawKey }),
    rawDataJson: {
      dataType,
      rawKey,
      payload: {
        title: 'Public repair fixture',
        url: 'https://repair.example.invalid',
        logo: undefined,
        sortIndex: 1,
      },
    },
    syncCredential: hardware,
    dataTime: 1_750_000_000_000,
  });
  const damaged = {
    ...lastGood,
    data: '00'.repeat(32),
    rawData: serverUploaded ? '' : lastGood.rawData,
    serverUploaded,
    localSceneUpdated: !serverUploaded,
  };
  const { service } = harness([damaged], hardware);
  const row = { ...damaged };
  jest.spyOn(localDb, 'getSyncItemSafe').mockResolvedValue(row);
  const update = jest
    .spyOn(localDb, 'updateSyncItem')
    .mockImplementation(async ({ updater }) => {
      await updater(row);
    });
  return { service, hardware, lastGood, damaged, row, update };
}

function harness(
  items: IDBCloudSyncItem[],
  selected: ICloudSyncCredential | undefined = credential,
) {
  const writePool = jest.spyOn(localDb, 'addAndUpdateSyncItems');
  const getAccount = jest.spyOn(localDb, 'getAccountSafe');
  const getWallet = jest.spyOn(localDb, 'getWalletSafe');
  const createAccounts = jest.spyOn(localDb, 'addAccountsToWallet');
  const importAccounts = jest.spyOn(localDb, 'importPublicCloudAccounts');
  const getAllWallets = jest.fn(async () => ({ wallets: [], allDevices: [] }));
  const getAllAccounts = jest.fn(async () => ({ accounts: [] }));
  const getAllIndexedAccounts = jest.fn(
    async (): Promise<{ indexedAccounts: IDBIndexedAccount[] }> => ({
      indexedAccounts: [],
    }),
  );
  const service = new ServicePrimeCloudSync({
    backgroundApi: {
      localDb,
      serviceAccount: { getAllWallets, getAllAccounts, getAllIndexedAccounts },
      serviceKeylessCloudSync: { getCloudAccountImportGeneration: () => 0 },
    },
  });
  service.syncManagers.account.rawKeyToHashKey = (data) =>
    sha512ProSync({ data });
  const buildTarget = jest.fn(async () => undefined);
  service.syncManagers.account.buildSyncTargetByPayload = buildTarget;
  const getCredential = jest
    .spyOn(service, 'getSyncCredentialSafe')
    .mockResolvedValue(selected);
  const getItems = jest
    .spyOn(service, 'getAllLocalSyncItems')
    .mockResolvedValue({ items });
  const upload = jest
    .spyOn(service, 'apiUploadItems')
    .mockResolvedValue(undefined);
  return {
    service,
    buildTarget,
    getAllWallets,
    getAllAccounts,
    getAllIndexedAccounts,
    getItems,
    getCredential,
    upload,
    writePool,
    getAccount,
    getWallet,
    createAccounts,
    importAccounts,
  };
}

describe('ServicePrimeCloudSync reserved public snapshot rebuilding', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
  });
  afterEach(() => jest.restoreAllMocks());

  test.each(['replace', 'concurrent-write', 'older-cloud'] as const)(
    'requests just the acknowledged damaged record and checks the version before writing (%s)',
    async (scenario) => {
      const { service, hardware, lastGood, damaged, row, update } =
        await makeRepairFixture(true);
      const wire = service.convertLocalItemToServerItem({
        localItem: lastGood,
      });
      if (!wire) throw new OneKeyLocalError('Missing wire fixture');
      const check = jest
        .spyOn(service, 'apiCheckServerStatusKeyless')
        .mockImplementation(async () => {
          if (scenario === 'concurrent-write') {
            row.data = 'newer-local-ciphertext';
            row.dataTime = (damaged.dataTime ?? 0) + 1000;
            row.serverUploaded = false;
          }
          return {
            pwdHash: damaged.pwdHash,
            response: {
              status: 200,
              statusText: 'OK',
              headers: {},
              config: { headers: new AxiosHeaders() },
              data: {
                code: 0,
                message: '',
                data: {
                  pwdHash: damaged.pwdHash,
                  serverTime: 1_750_000_001_000,
                  diff: [],
                  deleted: [],
                  obsoleted: [],
                  updated: [
                    {
                      ...wire,
                      dataTimestamp:
                        scenario === 'older-cloud'
                          ? 1_749_999_999_000
                          : wire.dataTimestamp,
                    },
                  ],
                },
              },
            },
          };
        });
      const result = await service.repairUnreadableHardwareSyncItem({
        item: damaged,
        syncCredential: hardware,
      });
      expect(check).toHaveBeenCalledWith(
        expect.objectContaining({
          postData: expect.objectContaining({
            localData: [
              { key: damaged.id, dataType: damaged.dataType, dataTimestamp: 0 },
            ],
          }),
        }),
      );
      if (scenario === 'replace') {
        expect(result).toMatchObject({
          data: lastGood.data,
          dataTime: damaged.dataTime,
          serverUploaded: true,
        });
        expect(row.data).toBe(lastGood.data);
      } else {
        expect(result).toBeUndefined();
        if (scenario === 'older-cloud') {
          expect(row).toEqual(damaged);
          expect(update).not.toHaveBeenCalled();
        } else {
          expect(row).toMatchObject({
            data: 'newer-local-ciphertext',
            serverUploaded: false,
          });
        }
      }
    },
  );

  test('rebuilds pending local data at its original time without requesting a cloud copy', async () => {
    const { service, hardware, lastGood, damaged, row } =
      await makeRepairFixture(false);
    const check = jest.spyOn(service, 'apiCheckServerStatusKeyless');
    const result = await service.repairUnreadableHardwareSyncItem({
      item: damaged,
      syncCredential: hardware,
    });
    expect(result).toMatchObject({
      dataTime: damaged.dataTime,
      rawData: lastGood.rawData,
      serverUploaded: false,
    });
    expect(row.data).not.toBe(damaged.data);
    expect(check).not.toHaveBeenCalled();
  });

  test('only dispatches authoritative recovery to the requested data type', async () => {
    const { service, getAllWallets, getAllAccounts, getAllIndexedAccounts } =
      harness([]);
    const accounts = jest.fn(async () => []);
    const wallets = jest.fn(async () => []);
    const indexedAccounts = jest.fn(
      async (): Promise<IDBCloudSyncItem[]> => [],
    );
    service.syncManagers.account.buildHardwareRestoreLegacyAccountItems =
      accounts;
    service.syncManagers.wallet.buildInitSyncDBItems = wallets;
    service.syncManagers.indexedAccount.buildInitSyncDBItems = indexedAccounts;
    const accountCopy = { ...rawItem(), rawData: '', isDeleted: false };
    await service.buildHardwareRestoreBusinessItems(credential, [accountCopy]);
    expect(accounts).toHaveBeenCalledWith({
      items: [accountCopy],
      syncCredential: credential,
    });
    expect(getAllWallets).not.toHaveBeenCalled();
    expect(wallets).not.toHaveBeenCalled();
    expect(getAllAccounts).not.toHaveBeenCalled();
    expect(getAllIndexedAccounts).not.toHaveBeenCalled();
    accounts.mockClear();
    const walletCopy = {
      ...accountCopy,
      id: 'wallet-id',
      rawKey: 'Wallet >> known',
      dataType: EPrimeCloudSyncDataType.Wallet,
    };
    await service.buildHardwareRestoreBusinessItems(credential, [walletCopy]);
    expect(accounts).not.toHaveBeenCalled();
    expect(getAllWallets).toHaveBeenCalledTimes(1);
    expect(getAllAccounts).not.toHaveBeenCalled();
    expect(wallets).toHaveBeenCalledWith(
      expect.objectContaining({
        requiredSyncItems: new Map([[walletCopy.id, walletCopy.rawKey]]),
      }),
    );
    expect(getAllIndexedAccounts).not.toHaveBeenCalled();
    wallets.mockClear();
    const indexCopy = {
      ...accountCopy,
      id: 'indexed-account-id',
      rawKey: '',
      data: '',
      dataType: EPrimeCloudSyncDataType.IndexedAccount,
    };
    await service.buildHardwareRestoreBusinessItems(credential, [indexCopy]);
    expect(getAllIndexedAccounts).toHaveBeenCalledTimes(1);
    expect(indexedAccounts).toHaveBeenCalledWith({
      dbRecords: [],
      initDataTime: undefined,
      syncCredential: credential,
      requiredSyncItems: new Map([[indexCopy.id, undefined]]),
    });
    expect(accounts).not.toHaveBeenCalled();
    expect(wallets).not.toHaveBeenCalled();
  });

  test('reuses read-only business sources and requests only the missing metadata keys', async () => {
    const { service } = harness([]);
    const bookmark = {
      url: 'https://example.invalid',
      title: 'Public test bookmark',
      logo: undefined,
      sortIndex: undefined,
    };
    const address = {
      id: 'public-test-address-book-item',
      name: 'Public test contact',
      networkId: 'eth--1',
      address: '0x0000000000000000000000000000000000000001',
    };
    const readBookmarks = jest.fn(async () => [bookmark]);
    const fillBookmarks = jest.fn();
    const readAddressBook = jest.fn(async () => [address]);
    const readWatchList = jest.fn();
    Object.assign(service.backgroundApi, {
      serviceDiscovery: {
        getBrowserBookmarks: readBookmarks,
        getBrowserBookmarksWithFillingSortIndex: fillBookmarks,
      },
      serviceAddressBook: { getItemsByNetwork: readAddressBook },
      serviceMarketV2: { getMarketWatchListV2: readWatchList },
    });
    const bookmarkCopy = {
      ...rawItem(),
      id: 'public-test-bookmark',
      dataType: EPrimeCloudSyncDataType.BrowserBookmark,
      rawKey: '',
    };
    const addressCopy = {
      ...rawItem(),
      id: 'public-test-contact',
      dataType: EPrimeCloudSyncDataType.AddressBook,
      rawKey: 'AddressBook >> public-test-contact',
    };
    const buildBookmarks = jest.fn(async () => [bookmarkCopy]);
    const buildAddresses = jest.fn(async () => [addressCopy]);
    service.syncManagers.browserBookmark.buildInitSyncDBItems = buildBookmarks;
    service.syncManagers.addressBook.buildInitSyncDBItems = buildAddresses;

    await expect(
      service.buildHardwareRestoreBusinessItems(credential, [
        bookmarkCopy,
        addressCopy,
      ]),
    ).resolves.toEqual([bookmarkCopy, addressCopy]);
    expect(buildBookmarks).toHaveBeenCalledWith(
      expect.objectContaining({
        dbRecords: [bookmark],
        requiredSyncItems: new Map([[bookmarkCopy.id, undefined]]),
      }),
    );
    expect(buildAddresses).toHaveBeenCalledWith(
      expect.objectContaining({
        dbRecords: [address],
        requiredSyncItems: new Map([[addressCopy.id, addressCopy.rawKey]]),
      }),
    );
    expect(readBookmarks).toHaveBeenCalledTimes(1);
    expect(readAddressBook).toHaveBeenCalledWith({});
    expect(fillBookmarks).not.toHaveBeenCalled();
    expect(readWatchList).not.toHaveBeenCalled();
  });

  test('leaves a foreign business deletion under its original key during pool rebuild', async () => {
    const rawKey = 'public-deleted-bookmark';
    const ref = {
      dataType: EPrimeCloudSyncDataType.BrowserBookmark,
      rawKey,
      payload: { url: 'https://example.com/' },
    };
    const source: IDBCloudSyncItem = {
      ...rawItem(),
      id: sha512ProSync({ data: rawKey }),
      dataType: ref.dataType,
      rawKey,
      rawData: stringUtils.stableStringify(ref),
      pwdHash: 'keyless-previous-space',
      dataTime: 1_750_000_000_000,
      isDeleted: true,
      localSceneUpdated: true,
      serverUploaded: true,
    };
    const { service, writePool } = harness([source]);
    const rebuild = jest.fn(async () => undefined);
    service.syncManagers.browserBookmark.buildSyncItem = rebuild;

    await service.fillingSyncItemsMissingDataFromRawData({
      skipUploadToServer: true,
    });

    expect(rebuild).not.toHaveBeenCalled();
    expect(writePool).not.toHaveBeenCalled();
  });

  test('after reload, resolves a validated deletion only in its original Cloud space', async () => {
    const raw = rawFixture();
    const original = await cloudSyncItemBuilder.buildSyncItemFromRawDataJson({
      key: sha512ProSync({ data: raw.rawKey }),
      rawDataJson: JSON.parse(
        stringUtils.stableStringify(raw),
      ) as ICloudSyncRawDataJson,
      dataTime: 1_750_000_000_000,
      syncCredential: credential,
    });
    const deletedAt = 1_750_000_001_000;
    const pending: IDBCloudSyncItem = {
      ...original,
      rawData: '',
      serverUploaded: true,
      pendingPublicAccountDeletionAt: deletedAt,
      pendingPublicAccountDeletionHash: getPublicAccountSnapshotIdentityHash(
        publicAccountTestSnapshot(),
      ),
    };
    const { service, getCredential, writePool } = harness([cloneDeep(pending)]);
    expect(
      service.convertLocalItemToServerItem({ localItem: pending }),
    ).toBeNull();

    getCredential.mockResolvedValueOnce({
      ...credential,
      keylessCredential: {
        ...credential.keylessCredential,
        pwdHash: 'keyless-unrelated-space',
      },
    });
    await service.fillingSyncItemsMissingDataFromRawData({
      skipUploadToServer: true,
    });
    expect(writePool).not.toHaveBeenCalled();

    await service.fillingSyncItemsMissingDataFromRawData({
      skipUploadToServer: true,
    });
    expect(writePool).toHaveBeenCalledTimes(1);
    const [{ items }] = writePool.mock.calls[0];
    expect(items).toEqual([
      {
        ...pending,
        isDeleted: true,
        dataTime: deletedAt,
        localSceneUpdated: true,
        serverUploaded: false,
        pendingPublicAccountDeletionAt: undefined,
        pendingPublicAccountDeletionHash: undefined,
      },
    ]);
  });

  test('refuses a valid ciphertext whose public account does not match the deletion', async () => {
    const raw = rawFixture();
    const original = await cloudSyncItemBuilder.buildSyncItemFromRawDataJson({
      key: sha512ProSync({ data: raw.rawKey }),
      rawDataJson: JSON.parse(
        stringUtils.stableStringify(raw),
      ) as ICloudSyncRawDataJson,
      dataTime: 1_750_000_000_000,
      syncCredential: credential,
    });
    const pending = {
      ...original,
      pendingPublicAccountDeletionAt: 1_750_000_001_000,
      pendingPublicAccountDeletionHash: '0'.repeat(64),
    };
    const { service, writePool } = harness([pending]);
    await service.fillingSyncItemsMissingDataFromRawData({
      skipUploadToServer: true,
    });
    expect(writePool).not.toHaveBeenCalled();
  });

  test('keeps unverified pending ciphertext when the key cannot authenticate it', async () => {
    const pending: IDBCloudSyncItem = {
      ...rawItem(),
      data: 'synthetic-invalid-ciphertext',
      rawData: '',
      pwdHash: credential.keylessCredential.pwdHash,
      pendingPublicAccountDeletionAt: 1_750_000_001_000,
    };
    const previous = cloneDeep(pending);
    const { service, writePool } = harness([pending]);
    await service.fillingSyncItemsMissingDataFromRawData({
      skipUploadToServer: true,
    });
    expect(writePool).not.toHaveBeenCalled();
    expect(pending).toEqual(previous);
  });

  test('encrypts a rawData-only tombstone after its account and wallet are gone', async () => {
    const original = rawItem();
    const previous = cloneDeep(original);
    const {
      service,
      buildTarget,
      upload,
      writePool,
      getAccount,
      getWallet,
      createAccounts,
      importAccounts,
    } = harness([original]);
    await service.fillingSyncItemsMissingDataFromRawData({
      skipUploadToServer: true,
    });
    expect(writePool).toHaveBeenCalledTimes(1);
    const { items, skipUploadToServer } = writePool.mock.calls[0][0];
    expect(skipUploadToServer).toBe(true);
    expect(items).toHaveLength(1);
    const rebuilt = items[0];
    expect(rebuilt).toMatchObject({
      id: original.id,
      isDeleted: true,
      dataTime: original.dataTime,
      localSceneUpdated: true,
      serverUploaded: false,
      rawData: '',
      pwdHash: credential.keylessCredential?.pwdHash,
    });
    expect(rebuilt.data).toBeTruthy();
    const decrypted = await cloudSyncItemBuilder.decryptSyncItem({
      item: { ...rebuilt },
      syncCredential: credential,
    });
    expect(decrypted.rawDataJson).toEqual(rawFixture());
    expect(original).toEqual(previous);
    expect(buildTarget).not.toHaveBeenCalled();
    expect(getAccount).not.toHaveBeenCalled();
    expect(getWallet).not.toHaveBeenCalled();
    expect(createAccounts).not.toHaveBeenCalled();
    expect(importAccounts).not.toHaveBeenCalled();
    expect(upload).not.toHaveBeenCalled();
  });

  test.each([false, true])(
    'passes final local-row proof only for a never-uploaded live snapshot (deleted=%s)',
    async (isDeleted) => {
      const original = { ...rawItem(), isDeleted };
      const { service, writePool } = harness([original]);
      await service.fillingSyncItemsMissingDataFromRawData({
        skipUploadToServer: true,
      });
      const candidate = writePool.mock.calls[0]?.[0]?.items[0];
      expect(candidate).toBeDefined();
      if (!candidate) throw new OneKeyLocalError('Missing fixture raw fill');
      if (isDeleted) {
        expect(getOfflinePublicAccountSnapshotFill(candidate)).toBeUndefined();
      } else {
        expect(
          getOfflinePublicAccountSnapshotFill(candidate)?.previous,
        ).toEqual(original);
      }
    },
  );

  test.each([
    { dataType: EPrimeCloudSyncDataType.Wallet },
    { remoteHardwareAccountTombstoneProof: 'preserve-fixture-proof' },
  ] satisfies Partial<IDBCloudSyncItem>[])(
    'preserves a mismatched outer row or remote tombstone proof (%o)',
    async (patch) => {
      const original = { ...rawItem(), isDeleted: false, ...patch };
      const previous = cloneDeep(original);
      const { service, writePool, upload } = harness([original]);
      const encrypt = jest.spyOn(cloudSyncItemBuilder, 'encryptSyncItem');
      await service.fillingSyncItemsMissingDataFromRawData({
        skipUploadToServer: false,
      });
      expect(encrypt).not.toHaveBeenCalled();
      expect(writePool).not.toHaveBeenCalled();
      expect(upload).not.toHaveBeenCalled();
      expect(original).toEqual(previous);
    },
  );

  test.each([undefined, '', 'not-ciphertext', 'aa'])(
    'does not replace or cancel the original if encryption produced no valid envelope (%s)',
    async (encryptedData) => {
      const original = { ...rawItem(), isDeleted: false };
      const previous = cloneDeep(original);
      const { service, writePool, upload } = harness([original]);
      jest.spyOn(cloudSyncItemBuilder, 'encryptSyncItem').mockResolvedValue({
        rawData: original.rawData ?? '',
        encryptedData,
      });
      await service.fillingSyncItemsMissingDataFromRawData({
        skipUploadToServer: false,
      });
      expect(writePool).not.toHaveBeenCalled();
      expect(upload).not.toHaveBeenCalled();
      expect(original).toEqual(previous);
    },
  );

  test.each([
    [
      'future version',
      (raw: IRawFixture) => {
        raw.payload.publicAccountSnapshot = {
          ...publicAccountTestSnapshot(),
          version: 2,
        };
      },
    ],
    [
      'future capability',
      (raw: IRawFixture) => {
        raw.payload.publicAccountSnapshot = {
          ...publicAccountTestSnapshot(),
          capabilities: ['account-copy-v2'],
        };
      },
    ],
    [
      'unknown snapshot field',
      (raw: IRawFixture) => {
        raw.payload.publicAccountSnapshot = {
          ...publicAccountTestSnapshot(),
          futureField: true,
        };
      },
    ],
    [
      'unknown account field',
      (raw: IRawFixture) => {
        raw.payload.publicAccountSnapshot = {
          ...publicAccountTestSnapshot(),
          account: {
            ...publicAccountTestSnapshot().account,
            futureField: true,
          },
        };
      },
    ],
    [
      'unknown payload field',
      (raw: IRawFixture) => {
        raw.payload.futureField = true;
      },
    ],
    [
      'unknown raw envelope field',
      (raw: IRawFixture) => {
        raw.futureField = true;
      },
    ],
  ] as const)(
    'preserves %s unchanged without writes or an echo',
    async (_label, mutate) => {
      const raw = rawFixture();
      mutate(raw);
      const original = rawItem(raw);
      const previous = cloneDeep(original);
      const { service, buildTarget, upload, writePool } = harness([original]);
      const encrypt = jest.spyOn(cloudSyncItemBuilder, 'encryptSyncItem');
      await service.fillingSyncItemsMissingDataFromRawData({
        skipUploadToServer: true,
      });
      expect(original).toEqual(previous);
      expect(encrypt).not.toHaveBeenCalled();
      expect(writePool).not.toHaveBeenCalled();
      expect(buildTarget).not.toHaveBeenCalled();
      expect(upload).not.toHaveBeenCalled();
    },
  );

  test('does not migrate encrypted snapshots from another credential', async () => {
    const raw = rawFixture();
    const item = await cloudSyncItemBuilder.buildSyncItemFromRawDataJson({
      key: sha512ProSync({ data: raw.rawKey }),
      rawDataJson: raw as ICloudSyncRawDataJson,
      syncCredential: credential,
      dataTime: 1_750_000_000_000,
    });
    item.isDeleted = true;
    const previous = cloneDeep(item);
    const nextCredential: ICloudSyncCredential = {
      ...credential,
      keylessCredential: {
        ...credential.keylessCredential,
        encryptionKey: '33'.repeat(32),
        pwdHash: 'keyless-another-test-owner',
      },
    };
    const { service, buildTarget, upload, writePool } = harness(
      [item],
      nextCredential,
    );
    const encrypt = jest.spyOn(cloudSyncItemBuilder, 'encryptSyncItem');
    await service.fillingSyncItemsMissingDataFromRawData({
      skipUploadToServer: true,
    });
    expect(item).toEqual(previous);
    expect(encrypt).not.toHaveBeenCalled();
    expect(writePool).not.toHaveBeenCalled();
    expect(buildTarget).not.toHaveBeenCalled();
    expect(upload).not.toHaveBeenCalled();
  });

  test('without a credential neither scans nor changes local data', async () => {
    const original = rawItem();
    const previous = cloneDeep(original);
    const { service, getItems, getCredential, buildTarget, upload, writePool } =
      harness([original]);
    getCredential.mockResolvedValue(undefined);
    await service.fillingSyncItemsMissingDataFromRawData({
      skipUploadToServer: true,
    });
    expect(original).toEqual(previous);
    expect(getItems).not.toHaveBeenCalled();
    expect(writePool).not.toHaveBeenCalled();
    expect(buildTarget).not.toHaveBeenCalled();
    expect(upload).not.toHaveBeenCalled();
  });

  test('reports malformed reserved records as rejected while preserving their original bytes', async () => {
    const original = rawItem();
    original.rawData = 'malformed-public-json';
    const previous = cloneDeep(original);
    const { service, writePool, upload } = harness([original]);
    const publish = jest
      .spyOn(service, 'publishPublicAccountSnapshotStatus')
      .mockResolvedValue(undefined);
    const encrypt = jest.spyOn(cloudSyncItemBuilder, 'encryptSyncItem');
    await service.fillingSyncItemsMissingDataFromRawData({
      skipUploadToServer: true,
    });
    expect(publish).toHaveBeenCalledWith(
      expect.objectContaining({
        updates: [{ id: original.id, issue: 'rejected' }],
      }),
    );
    expect(original).toEqual(previous);
    expect(encrypt).not.toHaveBeenCalled();
    expect(writePool).not.toHaveBeenCalled();
    expect(upload).not.toHaveBeenCalled();
  });

  test('cancelling during the initial pool scan prevents encryption and all late writes', async () => {
    const original = rawItem();
    const { service, getItems, writePool, upload } = harness([original]);
    let resumeScan: (() => void) | undefined;
    let startedScan: (() => void) | undefined;
    const scanned = new Promise<void>((resolve) => {
      startedScan = resolve;
    });
    const pendingScan = new Promise<void>((resolve) => {
      resumeScan = resolve;
    });
    getItems.mockImplementationOnce(async () => {
      startedScan?.();
      await pendingScan;
      return { items: [original] };
    });
    const encrypt = jest.spyOn(cloudSyncItemBuilder, 'encryptSyncItem');
    const fill = service.fillingSyncItemsMissingDataFromRawData({
      skipUploadToServer: true,
    });
    await scanned;
    await service.cancelPublicAccountSnapshotImport();
    resumeScan?.();
    await expect(fill).rejects.toThrow('cancelled');
    expect(encrypt).not.toHaveBeenCalled();
    expect(writePool).not.toHaveBeenCalled();
    expect(upload).not.toHaveBeenCalled();
  });

  test('cancelling during encryption cannot let the final writer capture a fresh generation', async () => {
    const original = rawItem();
    const { service, writePool, upload } = harness([original]);
    let resumeBuild: (() => void) | undefined;
    let startedBuild: (() => void) | undefined;
    const started = new Promise<void>((resolve) => {
      startedBuild = resolve;
    });
    const pendingBuild = new Promise<void>((resolve) => {
      resumeBuild = resolve;
    });
    const build =
      cloudSyncItemBuilder.buildSyncItemFromRawDataJson.bind(
        cloudSyncItemBuilder,
      );
    jest
      .spyOn(cloudSyncItemBuilder, 'buildSyncItemFromRawDataJson')
      .mockImplementationOnce(async (params) => {
        startedBuild?.();
        await pendingBuild;
        return build(params);
      });
    const fill = service.fillingSyncItemsMissingDataFromRawData({
      skipUploadToServer: true,
    });
    await started;
    await service.cancelPublicAccountSnapshotImport();
    resumeBuild?.();
    await expect(fill).rejects.toThrow('cancelled');
    expect(writePool).not.toHaveBeenCalled();
    expect(upload).not.toHaveBeenCalled();
  });
});
